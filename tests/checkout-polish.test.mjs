import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { read, compile, views, payment, email, authEffect } from './checkout-polish-fixtures.mjs'
const render=(Component,props)=>renderToStaticMarkup(createElement(Component,props))

test('mounted checkout places country before region, city and postal fields for each destination',()=>{
  for(const country of ['Canada','United States','Hong Kong']) {
    const html=render(views(1,country).Checkout,{cart:[],subtotal:10,user:'customer@example.test',customerId:'customer-a'})
    const names=['country-name','address-level1','address-level2','postal-code']
    const positions=names.map(name=>html.indexOf(`autoComplete="${name}"`))
    assert.ok(positions.every((n,i)=>n>=0&&(!i||n>positions[i-1])))
  }
})

test('desktop and mobile Studio links require the resolved admin role',()=>{
  const {Header,Mobile}=views()
  for(const isAdmin of [false,true]) for(const Component of [Header,Mobile]) {
    const html=render(Component,{isAdmin,count:0,page:'home'})
    assert.equal(html.includes('>Studio</button>'),isAdmin)
  }
})

test('auth loading hides Studio, accepts multiple admin identities and ignores stale admin responses',async()=>{
  const requests=[];let listener;let timer;let admin=false;let user;let customerId=null;let authReady=false
  const context={setAuthReady:v=>{authReady=v},setCustomerId:v=>{customerId=typeof v==='function'?v(customerId):v},useEffect:fn=>fn(),getProfile:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),setUser:v=>{user=v},setIsAdmin:v=>{admin=v},setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{timer=undefined},supabase:{auth:{onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}}}}},window:{location:{hash:'',search:''}},URLSearchParams}
  const js=ts.transpileModule(authEffect,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  new Function(...Object.keys(context),js)(...Object.values(context))
  assert.equal(admin,false)
  const settle=async(profile,id)=>{requests.shift().resolve({user:id?{id,email:id+'@example.test'}:null,profile});await Promise.resolve()}
  await settle(null,null);assert.equal(admin,false);assert.equal(authReady,true)
  for(const [index,role] of ['customer','admin','admin'].entries()) {
    const id='identity-'+index
    listener('SIGNED_IN',{user:{id,email:id+'@example.test'}});assert.equal(admin,false);assert.equal(customerId,null);assert.equal(authReady,false);timer()
    await settle({id,role},id);assert.equal(admin,role==='admin');assert.equal(customerId,id);assert.equal(authReady,true)
  }
  listener('SIGNED_IN',{user:{id:'old-admin'}});timer()
  listener('SIGNED_OUT',null);await settle({id:'old-admin',role:'admin'},'old-admin')
  assert.equal(admin,false);assert.equal(user,null);assert.equal(customerId,null)
  listener('SIGNED_IN',{user:{id:'customer'}});timer()
  await settle({id:'different-user',role:'admin'},'customer');assert.equal(admin,false)
  listener('SIGNED_IN',{user:{id:'customer'}});timer();requests.shift().reject(Error('offline'));await Promise.resolve();assert.equal(admin,false)
})

test('manual cards select existing methods; Stripe remains disabled and has no handler',()=>{
  const jsx=(type,props)=>({type,props})
  const {PaymentMethodOptions}=compile(read('src/PaymentMethodOptions.tsx'),{'react/jsx-runtime':{jsx,jsxs:jsx}})
  const selected=[]
  const tree=PaymentMethodOptions({method:'manual_whatsapp',onChange:v=>selected.push(v),whatsappAvailable:true,emailAvailable:true})
  for(const card of tree.props.children[1]) card.props.children[0].props.onChange()
  assert.deepEqual(selected,['manual_whatsapp','manual_email'])
  const disabled=tree.props.children[2].props.children[0].props
  assert.equal(disabled.disabled,true);assert.equal(disabled.onChange,undefined)
  const html=render(payment.PaymentMethodOptions,{method:'manual_email',onChange(){},whatsappAvailable:true,emailAvailable:true})
  assert.ok(html.indexOf('WhatsApp Payment')<html.indexOf('Email Payment'))
  assert.match(html,/Stripe — Coming soon/)
  assert.match(html,/checked="" value="manual_email"/)
})

test('sent email notice is concise and keeps sending disabled',()=>{
  const html=render(email.PaymentConfirmationEmailAction,{orderId:'synthetic',paymentStatus:'paid',notification:{status:'sent'},refresh:async()=>{}})
  assert.match(html,/disabled=""/)
  assert.match(html,/class="payment-email-note" role="status" aria-live="polite">Duplicate sending is disabled\./)
})
