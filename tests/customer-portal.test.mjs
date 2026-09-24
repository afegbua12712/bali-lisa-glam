import assert from 'node:assert/strict'
import test from 'node:test'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {read,compile,fixture,views} from './order-view-fixtures.mjs'
import {portal} from './customer-portal-fixtures.mjs'

test('customer service scopes every read and reorder lookup to the authenticated owner',async()=>{
  let user={id:'customer-a',email:'account@example.test'};const reads=[];let update
  const supabase={auth:{getUser:async()=>({data:{user}})},from:table=>{
    const entry={table,filters:[]};reads.push(entry)
    const reply=()=>({data:table==='orders'?{order_items:fixture.order_items}:table==='profiles'?{first_name:'Test'}:null})
    const query={select:fields=>{entry.fields=fields;return query},eq:(key,value)=>{entry.filters.push([key,value]);return query},single:async()=>reply(),maybeSingle:async()=>reply(),order:async(_key,opts)=>{assert.equal(opts.ascending,false);return{data:[]}},update:payload=>{update=payload;return query},then:resolve=>Promise.resolve(resolve({}))}
    return query
  }}
  const api=compile(read('src/lib/customer.ts'),{'./supabase':{supabase}})
  await api.getCustomerAccount()
  for(const entry of reads)assert.ok(entry.filters.some(([key,id])=>key===(entry.table==='profiles'?'id':'customer_id')&&id==='customer-a'))
  assert.ok(!reads[0].fields.includes('role'))
  await api.getReorderItems('previous-order','customer-a')
  assert.deepEqual(reads.at(-1).filters,[['id','previous-order'],['customer_id','customer-a']])
  await api.saveCustomerProfile({first_name:'First',last_name:'Last',phone:'123',role:'admin',email:'forged',id:'other'},'customer-a')
  assert.deepEqual(Object.keys(update).sort(),['first_name','last_name','phone','updated_at'])
  user={id:'customer-b'};await assert.rejects(api.saveCustomerProfile({},'customer-a'));await assert.rejects(api.getReorderItems('previous-order','customer-a'))
  user=null;const count=reads.length;await assert.rejects(api.getCustomerAccount());await assert.rejects(api.getReorderItems('previous-order','customer-a'));assert.equal(reads.length,count)
})
test('order views sort newest first and render historical prices, structured options, delivery and payment without admin controls',()=>{
  const {CustomerOrders}=views(true)
  const old={...fixture,id:'old',order_reference:'BL-00001',created_at:'2020-01-01T00:00:00Z'}
  const order={...fixture,order_items:[{product_id:1,product_name:'Historical product',quantity:2,unit_price_cents:1500,selected_options:[{name:'Shade',value:'Old Rose'}]}],shipping_address:{address:'Historical Street',city:'Toronto',country:'Canada'}}
  const html=renderToStaticMarkup(createElement(CustomerOrders,{orders:[old,order],refresh:async()=>{},reorder:async()=>{},goShop(){}}))
  assert.ok(html.indexOf('BL-100000')<html.indexOf('BL-00001'))
  for(const text of ['2 items','Historical product','Old Rose','Historical Street','15.00','30.00','Payment method: Email','Order progress','Reorder'])assert.ok(html.includes(text),text)
  for(const text of ['Advance fulfillment','Confirm payment','Archive order',fixture.id])assert.ok(!html.includes(text),text)
  assert.match(html,/aria-expanded="true"/)
  const empty=renderToStaticMarkup(createElement(CustomerOrders,{orders:[],refresh(){},goShop(){}}));assert.match(empty,/Your order history starts here/)
})
test('portal overview, profile, delivery, loading and retry states expose customer information only',()=>{
  const render=(tab,scenario)=>renderToStaticMarkup(createElement(portal(tab,scenario)))
  const overview=render('Overview');assert.match(overview,/Alexandra/);assert.match(overview,/Recent orders/);assert.match(overview,/Edit saved delivery details/)
  const profile=render('Profile');assert.match(profile,/<p>customer@example.test<\/p>/);assert.match(profile,/sign-in email is read-only/);assert.ok(!profile.includes('role="admin"'));assert.ok(!profile.includes('>customer-a<'))
  const delivery=render('Addresses');assert.match(delivery,/Saved delivery details/);assert.ok(delivery.indexOf('>country')<delivery.indexOf('Province / territory'))
  assert.match(render('Overview','loading'),/Loading your account/)
  assert.match(render('Overview','error'),/Account temporarily unavailable/);assert.match(render('Overview','error'),/>Retry</)
})
