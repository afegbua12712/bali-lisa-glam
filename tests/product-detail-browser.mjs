// Run npm.cmd run build first, then node tests/product-detail-browser.mjs.
// Exercise the built, unmodified main.tsx -> App.tsx in Chrome. Every external
// request is intercepted: catalog/review data are synthetic; no production access.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
const output=resolve('node_modules/.tmp/product-detail-browser'),dist=resolve('dist')
await mkdir(output,{recursive:true})
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#e5d4ce"/><rect x="155" y="150" width="90" height="200" rx="12" fill="#b07468"/></svg>'
const row=(id,category='Lips',stock=10)=>({id,name:`Product ${id}`,price_cents:1800,image_url:'/fixture.svg',description:'Synthetic product for full application rendering.',shades:[],inventory_quantity:stock,categories:{name:category},product_option_groups:[],product_images:[]})
const original=[row(1),row(2),row(3,'Lips',0),row(4,'Eyes'),row(5,'Skin'),row(6,'Beauty')]
const storefrontMode=process.argv.includes('--storefront')
if(storefrontMode) {
  original.forEach((product,index)=>{product.created_at=`2026-09-${String(index+1).padStart(2,'0')}`;product.price_cents=1000+index*500;product.categories.is_active=true;product.categories.sort_order=index;product.inventory_quantity=product.id===3?0:2})
  original[5].categories.is_active=false
  original[4].product_option_groups=[{id:'00000000-0000-4000-8000-000000000001',name:'Shade',required:true,display_order:0,product_option_values:[{id:'00000000-0000-4000-8000-000000000002',label:'Rose',active:true,display_order:0,color:'#a95943'}]}]
}
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
      if(path==='/rest/v1/products'){await new Promise(r=>setTimeout(r,250));body=JSON.stringify(failCatalog?{message:'Fixture failure'}:rows);status=failCatalog?503:200}
      else if(storefrontMode&&path==='/rest/v1/rpc/product_review_stats')body=JSON.stringify([{product_id:2,average_rating:4.8,review_count:3},{product_id:1,average_rating:4.2,review_count:2}])
      else if(resourceType==='Image'){body=svg;type='image/svg+xml'}
      else if(!path.startsWith('/rest/v1/')&&request.method!=='OPTIONS'){await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return}
      await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:type},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(request.method==='OPTIONS'?'':body).toString('base64')})
    }catch(error){errors.push(error.message)}
  }
  const evaluate=async expression=>{const reply=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(reply.exceptionDetails)throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);return reply.result.value}
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}console.log(await evaluate('JSON.stringify({active:document.activeElement?.outerHTML.slice(0,300),menu:document.querySelector(".mobile-menu")?.outerHTML.slice(0,500),menuDisplay:document.querySelector(".mobile-menu")&&getComputedStyle(document.querySelector(".mobile-menu")).display,headerInert:document.querySelector("header")?.inert,mainInert:document.querySelector("main")?.inert})'));throw Error('Did not become true: '+expression)}
  await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("blg-recent-products-v1", "[4,2]")'})
  await call('Page.navigate',{url:origin})
  await until('document.querySelectorAll(".product-img").length === 4')
  if(process.argv.includes('--header')) {
    const {runHeaderChecks}=await import('./header-browser-checks.mjs')
    await runHeaderChecks({call,evaluate,until})
    assert.deepEqual(errors,[])
    assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||(r.method==='POST'&&r.path==='/rest/v1/rpc/product_review_stats')))
  } else if(storefrontMode) {
    const {runStorefrontChecks}=await import('./storefront-browser-checks.mjs')
    await runStorefrontChecks({call,evaluate,until,output,original,setCatalog:value=>{rows=value},setFailure:value=>{failCatalog=value}})
  } else {
  await evaluate('document.querySelector(".product-img").click()')
  await until('document.querySelector(".details h1")?.textContent === "Product 1" && !!document.querySelector(".discovery-shelf")')
  const names=title=>evaluate(`JSON.stringify([...document.querySelectorAll('[aria-label="${title}"] .product-info button')].map(e=>e.textContent))`).then(JSON.parse)
  assert.deepEqual(await names('You may also like'),['Product 2','Product 4','Product 5','Product 6'])
  assert.deepEqual(await names('Recently viewed'),['Product 4','Product 2'])
  const results=[]
  for(const width of [1280,1024,768,390,320])for(const preference of ['light','dark','default']) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:preference==='default'?'dark':preference}]})
    await evaluate(`window.blgAppearance.setPreference('${preference}')`)
    const result=await evaluate(`(()=>{const shelves=[...document.querySelectorAll('.discovery-shelf')];return {width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,shelves:shelves.map(e=>({title:e.querySelector('h2').textContent,cards:e.querySelectorAll('.card').length,visible:getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0})),footerClear:document.querySelector('footer').getBoundingClientRect().top>=shelves.at(-1).getBoundingClientRect().bottom,overflow:[...document.querySelectorAll('.discovery-shelf .card,.discovery-shelf .product-img,.discovery-shelf .product-info')].filter(e=>{const r=e.getBoundingClientRect();return r.left < -1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+2}).length}})()`)
    assert.equal(result.theme,preference==='default'?'dark':preference);assert.ok(result.shelves.every(s=>s.visible));assert.equal(result.shelves.length,2);assert.equal(result.footerClear,true);assert.equal(result.overflow,0);assert.ok(result.scroll<=width+1)
    results.push({width,preference,...result})
    if(width===320&&preference!=='default')await writeFile(`${output}/detail-${preference}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
  }
  await evaluate('document.querySelector(".discovery-shelf .product-img").click()')
  await until('document.querySelector(".details h1")?.textContent === "Product 2"')
  assert.ok((await names('Recently viewed')).includes('Product 1'))
  rows=[row(2),row(3,'Lips',0)];await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))')
  await until('!document.querySelector(".discovery-status") && !document.querySelector(".discovery-shelf")')
  rows=[row(2),row(4,'Eyes')];await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))')
  await until('document.querySelector(".discovery-shelf .product-info button")?.textContent === "Product 4"')
  failCatalog=true;await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))')
  await until('document.querySelector(".discovery-status")?.textContent.includes("temporarily unavailable")')
  failCatalog=false;await evaluate('document.querySelector(".discovery-status button").click()')
  await until('!!document.querySelector(".discovery-shelf")')
  assert.deepEqual(errors,[])
  assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||(r.method==='POST'&&r.path==='/rest/v1/rpc/product_review_stats')))
  await writeFile(output+'/results.json',JSON.stringify({results,requests,errors},null,2))
  console.log('15 actual App product-detail layout/theme scenarios passed; real card navigation, recent history, zero candidates, fallback and catalog error/retry passed. All external requests intercepted.')
  }
  assert.deepEqual(errors,[])
  assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||(r.method==='POST'&&r.path==='/rest/v1/rpc/product_review_stats')))
  await call('Browser.close')
}finally{socket?.close();chrome.kill();server.close()}
