import assert from 'node:assert/strict'

// Uses the existing actual-App server and intercepted synthetic session. Never
// submits an order, saves customer data, sends a reset email or signs up a user.
export async function launchAccountChecks({call,evaluate,until,signedOut=false}) {
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  let count=0
  const check=async(selector)=>{
    const result=await evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(selector)});const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';return {overflow:document.documentElement.scrollWidth>innerWidth+1,fields:[...root.querySelectorAll('input,select,textarea')].filter(visible).every(e=>e.labels?.length||e.getAttribute('aria-label')),bounds:[...root.querySelectorAll('input,select,button')].filter(visible).every(e=>e.getBoundingClientRect().right<=innerWidth+1&&e.getBoundingClientRect().left>=-1)}})()`)
    assert.deepEqual(result,{overflow:false,fields:true,bounds:true},selector);count++
  }
  const setField=(label,value)=>evaluate(`(()=>{const e=[...document.querySelectorAll('.delivery-fields label')].find(e=>e.firstChild.textContent.trim()===${JSON.stringify(label)}).querySelector('input,select');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`)
  for(const width of [1280,1024,768,390,320])for(const theme of ['light','dark','default']) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='default'?'dark':theme}]})
    await evaluate(`window.blgAppearance.setPreference('${theme}')`)
    await click('.header [aria-label="Account"]')
    if(signedOut){
      await until('!!document.querySelector(".auth-tabs")')
      await evaluate('[...document.querySelectorAll(".auth-tabs button")].find(e=>e.textContent==="Sign In").click()');await check('.account-card')
      await evaluate('[...document.querySelectorAll(".auth-tabs button")].find(e=>e.textContent==="Create Account").click()');await check('.account-card')
      await evaluate('[...document.querySelectorAll(".account-switch button")].find(e=>e.textContent==="Forgot password?").click()');await check('.account-card')
      continue
    }
    await until('!!document.querySelector(".customer-portal")')
    for(const tab of ['Overview','Orders','Wishlist','Delivery Details','Profile','Security']){
      await evaluate(`[...document.querySelectorAll('.customer-portal nav button')].find(e=>e.textContent===${JSON.stringify(tab)}).click()`)
      await check('.customer-portal')
    }
    await click('.brand-logo');await until('!!document.querySelector(".hero")');await click('.hero .btn');await until('!!document.querySelector(".shop")')
    await click('[aria-label="View Product 1"]');await until('!!document.querySelector(".purchase")');await click('.purchase > .btn')
    await click('.header .bag');await until('!!document.querySelector(".cart-total .btn")');await click('.cart-total .btn');await until('!!document.querySelector(".delivery-fields")')
    await check('.checkout')
    for(const [label,value] of Object.entries({'First name':'Test','Last name':'Customer','Email':'test@example.test','Phone':'+14165550100','Address':'1 Fixture Street','Province / territory':'Ontario','City':'Toronto','Postal code':'M5V 2T6'}))await setField(label,value)
    await evaluate('document.querySelector(".checkout form").requestSubmit()')
    await until('document.querySelector(".checkout h1")?.textContent==="Choose payment contact"')
    await check('.checkout')
    // Leave the final order button untouched.
    await click('.header .bag');await until('!!document.querySelector(".drawer.open")');await click('[aria-label="Remove Product 1 from bag"]')
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    await until('!document.querySelector(".drawer.open")')
  }
  console.log(`${count} actual-App ${signedOut?'sign-in/signup/reset':'account/checkout'} layout and form-label scenarios passed; no submissions to production.`)
}
