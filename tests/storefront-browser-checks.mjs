import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'

// Invoked by product-detail-browser.mjs --storefront; uses its real-App server
// and strict request interception. No alternate storefront is rendered here.
export async function runStorefrontChecks({call,evaluate,until,output,original,setCatalog,setFailure}) {
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const value=(selector,text)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`)
  const key=async(key,code=key,modifiers=0)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:key==='Tab'?9:key==='Escape'?27:13,modifiers});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers})}
  const names=()=>evaluate(`JSON.stringify([...document.querySelectorAll('.shop > .product-grid .product-info button')].map(e=>e.textContent))`).then(JSON.parse)
  const shop=async()=>{await click('.brand-logo');await until('!!document.querySelector(".hero")');await click('.hero .btn');await until('!!document.querySelector(".shop")')}
  const show=async id=>{await shop();await click(`.shop [aria-label="View Product ${id}"]`);await until(`document.querySelector('.details h1')?.textContent === 'Product ${id}'`)}
  const bag=async()=>{await click('.header .bag');await until('document.querySelector(".drawer")?.getAttribute("aria-hidden") === "false"')}
  const closeBag=async()=>{await key('Escape');await until('document.querySelector(".drawer")?.getAttribute("aria-hidden") === "true"')}
  const results=[]
  let width,preference
  const check=async view=>{
    await until('!document.querySelector(".drawer.open") || document.querySelector(".drawer.open").getBoundingClientRect().right <= innerWidth + 1')
    await new Promise(r=>setTimeout(r,80))
    const result=await evaluate(`(()=>{const modal=document.querySelector('.drawer.open,.mobile-menu');const root=modal??document.querySelector('main');const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';return {theme:document.documentElement.dataset.theme,width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...root.querySelectorAll('.shop-controls,.shop-filters,.card,.product-img,.quantity,.purchase,.line,.cart-total,.mini-qty,input,select')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+2}).map(e=>e.className||e.id),hearts:[...root.querySelectorAll('.wishlist-toggle')].filter(visible).every(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44&&e.getAttribute('aria-label')),footerClear:!!modal||document.querySelector('footer').getBoundingClientRect().top>=document.querySelector('main').getBoundingClientRect().bottom}})()`)
    assert.equal(result.theme,preference==='default'?'dark':preference,view);assert.ok(result.scroll<=width+1,view);assert.deepEqual(result.overflow,[],`${width} ${preference} ${view}`);assert.equal(result.hearts,true,view);assert.equal(result.footerClear,true,view)
    results.push({view,width,preference,...result})
    if(width===320&&preference==='dark'&&['shop-filtered','options','bag-populated'].includes(view))await writeFile(`${output}/storefront-${view}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
  }
  for(width of [1280,1024,768,390,320])for(preference of ['light','dark','default']) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:preference==='default'?'dark':preference}]})
    await evaluate(`window.blgAppearance.setPreference('${preference}')`)
    await click('.brand-logo');await until('!!document.querySelector(".hero")');await check('home')
    if(width<768){await click('[aria-label="Open menu"]');await until('document.activeElement?.getAttribute("aria-label") === "Close navigation menu"');await key('Tab','Tab',8);assert.equal(await evaluate('!!document.activeElement.closest(".mobile-menu")'),true);await check('navigation');await key('Escape');await until('!document.querySelector(".mobile-menu")')}
    await shop();assert.deepEqual(await names(),original.map(p=>p.name));await check('shop-default')
    const categories=JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.shop-category option')].map(e=>e.textContent))`));assert.ok(!categories.includes('Beauty'));assert.ok(categories.includes('Eyes'))
    await value('#shop-search','  PRODUCT   2  ');await until('document.querySelectorAll(".shop > .product-grid .card").length === 1');assert.deepEqual(await names(),['Product 2']);await check('shop-search')
    await click('[aria-label="Clear search"]');await until('document.querySelectorAll(".shop > .product-grid .card").length === 6')
    await value('.shop-category select','Lips');await click('.shop-filters summary');await value('.shop-filters input','12');await value('.shop-filters select','in-stock');await until('document.querySelectorAll(".shop > .product-grid .card").length === 1');assert.deepEqual(await names(),['Product 2']);await check('shop-filtered')
    await value('#shop-search','nothing matches');await until('!!document.querySelector(".storefront-empty button")');await check('shop-no-results')
    await click('.storefront-empty button');await until('document.querySelectorAll(".shop > .product-grid .card").length === 6')
    for(const [sort,first]of [['Price: low to high','Product 1'],['Price: high to low','Product 6'],['Top rated','Product 2'],['Newest','Product 6']]){await value('.shop-sort select',sort);await until(`document.querySelector('.shop > .product-grid .product-info button')?.textContent === '${first}'`)}
    await click('.shop .wishlist-toggle');await until('!!document.querySelector(".favorite-message")');await check('favorite-prompt')
    await show(1);await check('detail-discovery');assert.equal(await evaluate('document.querySelectorAll(".discovery-shelf").length'),2)
    await bag();await check('bag-empty');await closeBag()
    await click('.purchase > .btn');await bag();await until('document.querySelectorAll(".drawer .line").length === 1')
    await click('[aria-label="Increase quantity of Product 1"]');await until('document.querySelector(".mini-qty output")?.textContent === "2"');assert.equal(await evaluate('document.querySelector(".mini-qty button:last-child").disabled'),true)
    await check('bag-populated');await key('Tab','Tab',8);assert.equal(await evaluate('!!document.activeElement.closest(".drawer")'),true)
    await click('[aria-label="Decrease quantity of Product 1"]');await click('[aria-label="Remove Product 1 from bag"]');await until('!!document.querySelector(".empty-cart")');await closeBag()
    await show(5);assert.equal(await evaluate('document.querySelector(".purchase > .btn").disabled'),true);await check('options')
    await click('.option-values button');await until('!document.querySelector(".purchase > .btn").disabled');await click('.purchase > .btn');await bag();assert.ok(await evaluate('document.querySelector(".drawer .line").textContent.includes("Shade: Rose")'));await click('[aria-label="Remove Product 5 from bag"]');await closeBag()
    await show(3);assert.equal(await evaluate('document.querySelector(".purchase > .btn").disabled'),true);await check('out-of-stock')
  }
  // Exercise current-catalog changes against a populated bag and an open detail.
  await show(1);await click('.purchase > .btn');await bag()
  setCatalog(original.map(p=>p.id===1?{...p,price_cents:2200,inventory_quantity:0}:p));await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))')
  await until('document.querySelector(".bag-item-notice")?.textContent.includes("Price updated")');assert.ok(await evaluate('document.querySelector(".drawer .line").textContent.includes("Out of stock")'));assert.equal(await evaluate('document.querySelector(".cart-total .btn").disabled'),true)
  await click('[aria-label="Remove Product 1 from bag"]');await closeBag();setCatalog(original.filter(p=>p.id!==1));await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))');await until('document.querySelector(".storefront-empty h1")?.textContent === "Product unavailable"');await check('product-unavailable')
  setCatalog([]);await shop();await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))');await until('document.querySelector(".storefront-empty h2")?.textContent === "The collection is being refreshed"');await check('catalog-empty')
  setFailure(true);await evaluate('window.dispatchEvent(new Event("blg:catalog-updated"))');await until('document.querySelector(".discovery-status")?.textContent.includes("temporarily unavailable")');await check('catalog-error')
  setFailure(false);setCatalog(original);await click('.discovery-status button');await until('document.querySelectorAll(".shop > .product-grid .card").length === 6')
  await click('.header [aria-label="Search"]');await value('#header-search',' EYES ');await evaluate('document.querySelector("#header-search").focus()');await key('Enter');await until('document.querySelectorAll(".shop > .product-grid .card").length === 1');assert.deepEqual(await names(),['Product 4'])
  await writeFile(output+'/storefront-results.json',JSON.stringify(results,null,2))
  console.log(`${results.length} actual-App storefront responsive/theme scenarios passed, including search/filter/sort, options, stock, bag quantity/removal, focus, catalog changes and retry. Synthetic requests only.`)
}
