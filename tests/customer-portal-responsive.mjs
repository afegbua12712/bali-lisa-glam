// Mounted account markup with synthetic data; no production requests or writes.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {portal,read} from './customer-portal-fixtures.mjs'
const output=resolve('node_modules/.tmp/customer-portal-browser')
await mkdir(output,{recursive:true})
const css=['index.css','App.css','readability.css','mobile.css','product-options.css','appearance.css','layout-spacing.css','product-media-reviews.css','order-fulfillment.css','checkout-polish.css','customer-portal.css'].map(f=>read('src/'+f)).join('\n').replace(/^@import.*$/gm,'')
const scenarios=[['Overview','populated'],['Profile','populated'],['Addresses','populated'],['My Orders','populated'],['My Orders','details'],['My Orders','reorder'],['My Orders','empty'],['Overview','error'],['Overview','loading']]
const markup=scenarios.map(([tab,state])=>renderToStaticMarkup(createElement(portal(tab,state))))
const server=createServer((req,res)=>{
  const scenario=Number(new URL(req.url,'http://localhost').searchParams.get('scenario')??0)
  res.setHeader('Content-Type','text/html; charset=utf-8')
  res.end(`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"><div class="app"><section class="account-page">${markup[scenario]}</section></div></div><script>${read('public/appearance.js')}</script></body></html>`)
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const profile=output+'/profile-'+Date.now()
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let socket
try{
  let port
  for(let i=0;i<100;i++){try{port=(await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];break}catch{await new Promise(r=>setTimeout(r,100))}}
  assert.ok(port,'Chrome debugging endpoint unavailable')
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j})
  let id=0;const pending=new Map()
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result)}}
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}))})
  const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true})).result.value
  await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['https://*']})
  const results=[]
  for(const width of [1280,1024,768,390,320])for(const preference of ['light','dark','default'])for(const [scenario,[tab,state]]of scenarios.entries()){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:preference==='default'?'dark':preference}]})
    await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?scenario=${scenario}`})
    for(let i=0;i<50;i++){if(await evaluate('document.readyState === "complete" && !!window.blgAppearance'))break;await new Promise(r=>setTimeout(r,20))}
    await evaluate(`window.blgAppearance.setPreference('${preference}')`)
    const value=JSON.parse(await evaluate(`JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,
      overflow:[...document.querySelectorAll('.customer-portal input,.customer-portal button,.historical-items li,.historical-totals,.reorder-result,.portal-card')].filter(e=>{if(!e.getClientRects().length)return false;const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 || e.scrollWidth > e.clientWidth+2}).map(e=>e.className+':'+e.textContent.slice(0,60))})`))
    assert.equal(value.theme,preference==='default'?'dark':preference)
    results.push({width,preference,tab,state,...value})
    if(width===320&&preference!=='default'&&[0,1,2,4,5].includes(scenario)){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`${output}/${scenario}-${preference}-320.png`,Buffer.from(shot.data,'base64'))}
  }
  await writeFile(output+'/results.json',JSON.stringify(results,null,2))
  assert.deepEqual(results.filter(r=>r.scroll>r.width+1||r.overflow.length),[])
  console.log(`${results.length} account checks passed at five widths in Light/Dark/Default: overview, profile, delivery, history, details, reorder feedback, empty, error and loading. Synthetic fixtures only.`)
  await call('Browser.close')
}finally{socket?.close();chrome.kill();server.close()}
