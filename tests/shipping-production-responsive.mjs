// Run manually: node tests/order-fulfillment-responsive.mjs
// Real mounted order-view markup, synthetic data only, no Supabase requests.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {views as checkoutViews} from './checkout-polish-fixtures.mjs'
import { read, fixture, views, compile, viewSource } from './order-view-fixtures.mjs'
const output=resolve('node_modules/.tmp/shipping-production-browser')
await mkdir(output,{recursive:true})
const {CustomerOrders,AdminOrders}=views(true)
const {AdminSettings}=compile('export '+viewSource('AdminSettings'))
const css=['index.css','App.css','readability.css','mobile.css','product-options.css','appearance.css','layout-spacing.css','product-media-reviews.css','order-fulfillment.css'].map(f=>read('src/'+f)).join('\n').replace(/^@import.*$/gm,'')
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');const view=url.searchParams.get('view'),status=url.searchParams.get('status')??'processing'
  const order={...fixture,shipping_method:'International Shipping',shipment_carrier:'Independent delivery service',tracking_number:'TRACKING'.repeat(25),status,payment_status:status==='pending'?'awaiting_payment':'paid',inventory_reservation_status:status==='pending'?'reserved':'committed',shipped_at:status==='shipped'||status==='delivered'?'2026-09-21T10:00:00Z':null,delivered_at:status==='delivered'?'2026-09-22T10:00:00Z':null}
  const orderHtml=renderToStaticMarkup(createElement(view==='admin'?AdminOrders:CustomerOrders,{orders:[order],refresh:async()=>{},refreshEmails:async()=>{},note:()=>{}}))
  const {Checkout}=checkoutViews(1,view==='international'?'Nigeria':'Canada')
  const html=view==='canada'||view==='international'?renderToStaticMarkup(createElement(Checkout,{cart:[],subtotal:10,user:'fixture',customerId:'fixture'})):view==='settings'?renderToStaticMarkup(createElement(AdminSettings,{settings:{standard_shipping_cents:1000,free_shipping_threshold_cents:7500,international_standard_shipping_cents:2000},setSettings:()=>{},save:()=>{}})):orderHtml
  const shell=view==='admin'?`<section class="admin"><aside class="admin-nav"><p>ADMIN STUDIO</p><button>Orders</button></aside><main class="admin-main"><header><h1>Orders</h1></header>${html}</main></section>`:`<section class="account-page"><section class="customer-account"><header><h1>My Orders</h1></header><main>${html}</main></section></section>`
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"><div class="app">${shell}</div></div><script>${read('public/appearance.js')}</script></body></html>`)
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const profile=`${output}/profile-${Date.now()}`
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let socket
try {
  let port
  for(let i=0;i<100;i++) {try {port=(await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];break}catch{await new Promise(r=>setTimeout(r,100))}}
  assert.ok(port,'Chrome debugging endpoint unavailable')
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j})
  let id=0;const pending=new Map()
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result)}}
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}))})
  await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['https://*']})
  const results=[]
  for(const width of [1280,1024,768,390,320]) for(const theme of ['light','dark','default']) for(const view of (process.argv.includes('--keyboard-only')?['admin']:['customer','admin','canada','international','settings'])) for(const status of (process.argv.includes('--keyboard-only')?['processing']:['pending','processing','shipped','delivered'])) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='default'?'dark':theme}]})
    await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?view=${view}&status=${status}`})
    for(let i=0;i<50;i++){const r=await call('Runtime.evaluate',{expression:'document.readyState === "complete" && !!window.blgAppearance',returnByValue:true});if(r.result.value)break;await new Promise(r=>setTimeout(r,20))}
    await call('Runtime.evaluate',{expression:`window.blgAppearance.setPreference('${theme}')`})
    if(view==='admin'&&status==='processing')await call('Runtime.evaluate',{expression:'document.querySelector(".shipment-dialog").showModal()'})
    const measured=await call('Runtime.evaluate',{expression:`JSON.stringify({
      width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,
      reference:document.body.innerText.includes('BL-100000'),
      overflow:[...document.querySelectorAll('.order-progress li,.order-card-header,.order-actions button,.order-open,.fulfillment-action button,.shipping-method,.shipment-details,.shipment-dialog input,.summary,.account-card input')].filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 || e.scrollWidth > e.clientWidth+2}).map(e=>e.className+':'+e.textContent.slice(0,60)),
      progress:document.querySelectorAll('.order-progress li.complete').length
    })`,returnByValue:true})
    if(view==='admin'&&status==='processing') {
      const focused=await call('Runtime.evaluate',{expression:'document.activeElement === document.querySelector(".shipment-dialog input")',returnByValue:true});assert.equal(focused.result.value,true)
      for(let tab=0;tab<6;tab++){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});const inside=await call('Runtime.evaluate',{expression:'document.activeElement === document.body || !!document.activeElement.closest(".shipment-dialog")',returnByValue:true});assert.equal(inside.result.value,true)}
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
      const closed=await call('Runtime.evaluate',{expression:'!document.querySelector(".shipment-dialog").open',returnByValue:true});assert.equal(closed.result.value,true)
    }
    const value=JSON.parse(measured.result.value);results.push({width,preference:theme,view,status,...value})
    if(width===320&&status==='processing'&&theme!=='default') {const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`${output}/${view}-${theme}-320.png`,Buffer.from(shot.data,'base64'))}
  }
  await writeFile(output+'/results.json',JSON.stringify(results,null,2))
  const failures=results.filter(r=>r.scroll>r.width+1||r.overflow.length||(['customer','admin'].includes(r.view)&&!r.reference)||r.theme!==(r.preference==='default'?'dark':r.preference)||(['customer','admin'].includes(r.view)&&r.progress!==({pending:1,processing:3,shipped:4,delivered:5})[r.status]))
  assert.deepEqual(failures,[],JSON.stringify(failures,null,2))
  console.log(`${results.length} responsive checks passed at 1280, 1024, 768, 390, 320 in Light/Dark/Default. Synthetic markup only. Screenshots: ${output}`)
  await call('Browser.close')
} finally {socket?.close();chrome.kill();server.close()}
