// Run npm.cmd run build first, then node tests/studio-operations-browser.mjs.
// Exercise the built, unmodified main.tsx -> App.tsx in Chrome. Every external
// request is intercepted: catalog/review data are synthetic; no production access.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {launchAccountChecks} from './launch-browser-checks.mjs'
const output=resolve('node_modules/.tmp/studio-operations-browser'),dist=resolve('dist')
await mkdir(output,{recursive:true})
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#e5d4ce"/><rect x="155" y="150" width="90" height="200" rx="12" fill="#b07468"/></svg>'
const row=(id,category='Lips',stock=10)=>({id,name:`Product ${id}`,price_cents:1800,image_url:'/fixture.svg',description:'Synthetic product for full application rendering.',shades:[],inventory_quantity:stock,categories:{name:category},product_option_groups:[],product_images:[]})
const original=[row(1),row(2),row(3,'Lips',0),row(4,'Eyes'),row(5,'Skin'),row(6,'Beauty')]
original.forEach((p,i)=>{p.is_active=i!==5;p.created_at='2026-09-20';p.inventory_quantity=i===0?3:i===1?0:10})
const user={"id":"00000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated","aud":"authenticated"}
const customers=[{...user,first_name:'Studio',last_name:'Admin',role:'admin',created_at:'2026-09-01'},{id:'00000000-0000-4000-8000-000000000002',first_name:'Test',last_name:'Customer',email:'customer@example.test',phone:'123456789',role:'customer',created_at:'2026-09-01'}]
const orders=[{id:'00000000-0000-4000-8000-000000000003',customer_id:customers[1].id,order_reference:'BL-100001',status:'processing',payment_status:'paid',inventory_reservation_status:'committed',total_cents:3000,subtotal_cents:2000,shipping_cents:1000,currency:'CAD',created_at:'2026-09-20',paid_at:'2026-09-20',processing_at:'2026-09-21',profiles:customers[1],order_items:[],order_notifications:[],shipping_address:{country:'Canada'}}]
let failSettings=false,failLoad=false,settingsWrites=0
let rows=original,failCatalog=false
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname
    if(path==='/fixture.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(svg);return}
    const file=resolve(dist,'.'+(path==='/'?'/index.html':path));assert.ok(file.startsWith(dist+sep))
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)]??'application/octet-stream')
    res.end(await readFile(file))
  }catch{res.statusCode=404;res.end()}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin=`http://127.0.0.1:${server.address().port}`
const profile=output+'/profile-'+Date.now()
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let socket
try {
  let port;for(let i=0;i<100;i++){try{port=(await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];break}catch{await new Promise(r=>setTimeout(r,100))}}
  assert.ok(port,'Chrome debugging endpoint unavailable')
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j})
  let id=0;const pending=new Map(),errors=[],requests=[]
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('Timeout '+method))},15000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}))})
  socket.onmessage=async e=>{
    const m=JSON.parse(e.data)
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p){clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}return}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)
    if(m.method!=='Fetch.requestPaused')return
    const {requestId,request,resourceType}=m.params
    try {
      if(request.url.startsWith(origin+'/')){await call('Fetch.continueRequest',{requestId});return}
      const path=new URL(request.url).pathname;requests.push({method:request.method,path})
      let body='[]',status=200,type='application/json'
      if(path==='/auth/v1/user')body=JSON.stringify(user)
      else if(path==='/rest/v1/profiles')body=JSON.stringify(new URL(request.url).searchParams.has('id')?customers[0]:customers)
      else if(path==='/rest/v1/orders')body=JSON.stringify(new URL(request.url).searchParams.has('customer_id')?[]:orders)
      else if(path==='/rest/v1/customer_addresses')body='null'
      else if(path==='/rest/v1/categories')body=JSON.stringify([{id:1,name:'Lips',slug:'lips'}])
      else if(path==='/rest/v1/website_settings') {if(request.method==='POST'){settingsWrites++;status=failSettings?503:200;body='{}'}else{status=failLoad?503:200;body=JSON.stringify({id:true,business_name:'Fixture',business_email:'support@example.test',whatsapp_number:'+14165550100',standard_shipping_cents:800,free_shipping_threshold_cents:7500,international_standard_shipping_cents:2500,international_free_shipping_threshold_cents:null})}}
      else if(path==='/rest/v1/products'){await new Promise(r=>setTimeout(r,250));body=JSON.stringify(failCatalog?{message:'Fixture failure'}:rows);status=failCatalog?503:200}
      else if(resourceType==='Image'){body=svg;type='image/svg+xml'}
      else if(!path.startsWith('/rest/v1/')&&request.method!=='OPTIONS'){await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return}
      await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:type},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(request.method==='OPTIONS'?'':body).toString('base64')})
    }catch(error){errors.push(error.message)}
  }
  const evaluate=async expression=>{const reply=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(reply.exceptionDetails)throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);return reply.result.value}
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}console.log(await evaluate('JSON.stringify({active:document.activeElement?.outerHTML.slice(0,300),menu:document.querySelector(".mobile-menu")?.outerHTML.slice(0,500),menuDisplay:document.querySelector(".mobile-menu")&&getComputedStyle(document.querySelector(".mobile-menu")).display,headerInert:document.querySelector("header")?.inert,mainInert:document.querySelector("main")?.inert})'));throw Error('Did not become true: '+expression)}
  await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem(\"sb-zoaymppxmnilfyzfytcj-auth-token\",\"{\\\"access_token\\\":\\\"synthetic.access.token\\\",\\\"refresh_token\\\":\\\"synthetic-refresh\\\",\\\"expires_at\\\":4102444800,\\\"expires_in\\\":99999999,\\\"token_type\\\":\\\"bearer\\\",\\\"user\\\":{\\\"id\\\":\\\"00000000-0000-4000-8000-000000000001\\\",\\\"email\\\":\\\"admin@example.test\\\",\\\"role\\\":\\\"authenticated\\\",\\\"aud\\\":\\\"authenticated\\\"}}\")"})
  await call('Page.navigate',{url:origin})
  await until('!![...document.querySelectorAll(".header nav button")].find(e=>e.textContent==="Studio")')
  await evaluate('[...document.querySelectorAll(".header nav button")].find(e=>e.textContent==="Studio").click()')
  await until('!!document.querySelector(".stats")')
  const click=label=>evaluate(`[...document.querySelectorAll('.admin-nav button')].find(e=>e.textContent===${JSON.stringify(label)}).click()`)
  const value=(selector,text)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`)
  const results=[]
  for(const width of [1280,1024,768,390,320])for(const theme of ['light','dark','default']) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='default'?'dark':theme}]})
    await evaluate(`window.blgAppearance.setPreference('${theme}')`)
    for(const view of ['Overview','Products','Orders','Customers','Reviews','Settings']) {
      await click(view);await new Promise(r=>setTimeout(r,100))
      const measured=await evaluate(`(()=>{const root=document.querySelector('.admin');return{width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,nav:[...root.querySelectorAll('.admin-nav>button:not(.wordmark)')].every(e=>e.getClientRects().length&&e.getBoundingClientRect().height>=44),overflow:[...root.querySelectorAll('.stat,.studio-customers article,input,select,.product-table-row,.order-card,.account-card')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+2}).map(e=>e.className||e.tagName)}})()`)
      assert.ok(measured.scroll<=width+1,view);assert.deepEqual(measured.overflow,[],width+' '+theme+' '+view);assert.equal(measured.nav,true);assert.equal(measured.theme,theme==='default'?'dark':theme);results.push({view,...measured})
      const navContrast=await evaluate(`(()=>{const lum=color=>{const c=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};return [...document.querySelectorAll('.admin-nav>button:not(.wordmark)')].every(e=>{const s=getComputedStyle(e),bg=s.backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(e.parentElement).backgroundColor:s.backgroundColor;const a=lum(s.color),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5})})()`)
      assert.equal(navContrast,true,'Studio navigation contrast '+theme)
      if(view==='Overview')assert.ok(await evaluate('document.querySelector(".stats").textContent.includes("30.00")'))
      if(view==='Products') {await value('.product-search',' product 1 ');await until('document.querySelectorAll(".product-table-row").length===1');await value('[aria-label="Inventory visibility"]','out');await until('document.querySelectorAll(".product-table-row").length===0');await value('.product-search','');await until('document.querySelectorAll(".product-table-row").length===1')}
      if(view==='Products') {
        await evaluate('document.querySelector(".product-table-action").focus(); document.querySelector(".product-table-action").click()')
        await until('!!document.querySelector(".product-editor") && document.querySelector(".product-editor").contains(document.activeElement)')
        assert.equal(await evaluate('document.querySelector(".product-editor").closest("[inert]")'),null)
        assert.equal(await evaluate('document.querySelector(".product-editor").getAttribute("role")'),'dialog')
        assert.ok(await evaluate('document.querySelector(".product-editor").getBoundingClientRect().right <= innerWidth + 1'))
        await evaluate('document.querySelector(".product-editor-close").focus()')
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8})
        assert.equal(await evaluate('document.activeElement.textContent'),'Save product')
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
        assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Close product editor')
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
        await until('!document.querySelector(".product-editor")')
        assert.equal(await evaluate('document.activeElement.textContent'),'Edit')
      }
      if(view==='Customers') {await value('.studio-customers input','customer@');await until('document.querySelectorAll(".studio-customers article").length===1');assert.ok(await evaluate('document.querySelector(".studio-customers").textContent.includes("30.00")'))}
      if(width===320&&theme==='dark')await writeFile(output+'/'+view+'.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
    }
  }
  await click('Products')
  await evaluate('document.querySelector(".product-search").focus()')
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Inventory visibility')
  assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'),'solid')
  await click('Settings')
  failSettings=true
  await evaluate('document.querySelector(".account-card").requestSubmit()');await until('!!document.querySelector(".account-card [role=alert]")');assert.equal(settingsWrites,1);assert.equal(await evaluate('document.querySelector(".account-card button").disabled'),false)
  failLoad=true;await evaluate('[...document.querySelectorAll(".admin-main header button")].find(e=>e.textContent==="Refresh Studio").click()');await until('document.querySelector(".admin-main .empty")?.textContent.includes("could not be loaded")')
  failLoad=false;await evaluate('document.querySelector(".admin-main .empty button").click()');await until('!!document.querySelector(".account-card")')
  if(process.argv.includes('--launch')) {
    await launchAccountChecks({call,evaluate,until})
    await evaluate('[...document.querySelectorAll(".header nav button")].find(e=>e.textContent==="Studio").click()')
    await until('!!document.querySelector(".admin")')
  }
  await evaluate('localStorage.removeItem("sb-zoaymppxmnilfyzfytcj-auth-token"); const c=new BroadcastChannel("sb-zoaymppxmnilfyzfytcj-auth-token"); c.postMessage({event:"SIGNED_OUT",session:null}); setTimeout(()=>c.close(),100)')
  await until('!document.querySelector(".admin") && !!document.querySelector(".admin-gate")')
  if(process.argv.includes('--launch'))await launchAccountChecks({call,evaluate,until,signedOut:true})
  assert.deepEqual(errors,[])
  assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||(r.method==='POST'&&['/rest/v1/rpc/product_review_stats','/rest/v1/rpc/my_product_review','/rest/v1/rpc/admin_product_reviews','/rest/v1/website_settings'].includes(r.path))),JSON.stringify(requests.filter(r=>!['GET','OPTIONS'].includes(r.method))))
  await writeFile(output+'/results.json',JSON.stringify({results,requests},null,2));console.log(results.length+' actual-App Studio responsive scenarios and 15 editor keyboard scenarios passed; search, stock filtering, customer spend, settings failure, refresh retry and logout isolation passed. All external requests intercepted.')
  await call('Browser.close')
}finally{socket?.close();chrome.kill();server.close()}
