// Local synthetic markup from the mounted components; no production requests.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { read, views, email } from './checkout-polish-fixtures.mjs'
const output=resolve('node_modules/.tmp/checkout-polish-browser')
await mkdir(output,{recursive:true})
const css=['index.css','App.css','readability.css','mobile.css','product-options.css','appearance.css','layout-spacing.css','product-media-reviews.css','order-fulfillment.css','checkout-polish.css'].map(f=>read('src/'+f)).join('\n').replace(/^@import.*$/gm,'')
const render=(View,props)=>renderToStaticMarkup(createElement(View,props))
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),step=Number(url.searchParams.get('step')||1),admin=url.searchParams.get('admin')==='true',mobile=url.searchParams.get('mobile')==='true'
  const {Checkout,Header,Mobile}=views(step)
  const html=render(Header,{count:0,page:'home',isAdmin:admin})+(mobile?render(Mobile,{isAdmin:admin}):'')+render(Checkout,{cart:[],subtotal:10,user:'customer@example.test'})+`<section class="admin"><main class="admin-main"><div class="order-actions">${render(email.PaymentConfirmationEmailAction,{orderId:'fixture',paymentStatus:'paid',notification:{status:'sent'},refresh:async()=>{}})}</div></main></section>`
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"><div class="app">${html}</div></div><script>${read('public/appearance.js')}</script></body></html>`)
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const profile=`${output}/profile-${Date.now()}`
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let socket
try {
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
  for(const width of [1280,1024,768,390,320]) for(const preference of ['light','dark','default']) for(const step of [1,2]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:preference==='default'?'dark':preference}]})
    await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?step=${step}`})
    for(let i=0;i<50;i++){if(await evaluate('document.readyState === "complete" && !!window.blgAppearance'))break;await new Promise(r=>setTimeout(r,20))}
    await evaluate(`window.blgAppearance.setPreference('${preference}')`)
    const value=JSON.parse(await evaluate(`JSON.stringify({
      width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,
      overflow:[...document.querySelectorAll('.payment-method-card,.payment-email-note,.checkout input,.checkout select')].filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 || e.scrollWidth > e.clientWidth+2}).map(e=>e.className+':'+e.textContent.slice(0,40)),
      fields:[...document.querySelectorAll('.checkout [autocomplete]')].map(e=>e.autocomplete),
      noteSize:getComputedStyle(document.querySelector('.payment-email-note')).fontSize,
      studio:[...document.querySelectorAll('.header nav button')].some(e=>e.textContent==='Studio')
    })`))
    assert.equal(value.studio,false)
    assert.equal(value.noteSize,'12px')
    assert.equal(value.theme,preference==='default'?'dark':preference)
    if(step===1) assert.deepEqual(value.fields,['country-name','address-level1','address-level2','postal-code'])
    if(step===2) {
      await evaluate(`document.querySelector('input[value="manual_whatsapp"]').focus()`)
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.payment-method-card')).outlineStyle`),'solid')
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40})
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40})
      assert.equal(await evaluate(`document.activeElement.value`),'manual_email')
      assert.equal(await evaluate(`document.querySelector('.coming-soon input').disabled`),true)
    }
    results.push({width,preference,step,...value})
    if(width===320&&preference!=='default') {const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`${output}/step-${step}-${preference}-320.png`,Buffer.from(shot.data,'base64'))}
  }
  for(const width of [1280,1024,768,390,320]) for(const admin of [false,true]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?mobile=true&admin=${admin}`})
    for(let i=0;i<50;i++){if(await evaluate('document.readyState === "complete" && !!document.querySelector(".mobile-menu")'))break;await new Promise(r=>setTimeout(r,20))}
    for(const selector of ['.header nav','.mobile-menu']) assert.equal(await evaluate(`[...document.querySelectorAll('${selector} button')].some(e=>e.textContent==='Studio')`),admin)
  }
  await writeFile(output+'/results.json',JSON.stringify(results,null,2))
  assert.deepEqual(results.filter(r=>r.scroll>r.width+1||r.overflow.length),[])
  console.log('30 checkout/theme/width checks and 10 desktop/mobile navigation scenarios passed; native radio keyboard focus passed. Synthetic SSR fixtures, no live checkout or auth requests.')
  await call('Browser.close')
} finally {socket?.close();chrome.kill();server.close()}
