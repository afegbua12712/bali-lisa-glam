import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { read,compile,fixture,fulfillment,progress,views } from './order-view-fixtures.mjs'

test('progress separates payment from fulfillment and never invents historical delivery',()=>{
  assert.deepEqual(fulfillment.orderProgress({...fixture,status:'pending',payment_status:'awaiting_payment'}).map(s=>s.complete),[true,false,false,false,false])
  for(const [status,complete] of [['paid',2],['processing',3],['shipped',4],['delivered',5]]) assert.equal(fulfillment.orderProgress({...fixture,status}).filter(s=>s.complete).length,complete)
  for(const status of ['fulfilled','cancelled','refunded']) {
    const html=renderToStaticMarkup(createElement(progress.OrderProgress,{order:{...fixture,status}}))
    assert.ok(!html.includes('Delivered'))
    assert.equal(fulfillment.nextFulfillmentStatus({...fixture,status}),null)
  }
  assert.equal(fulfillment.nextFulfillmentStatus({...fixture,payment_status:'awaiting_payment'}),null)
  assert.equal(fulfillment.nextFulfillmentStatus({...fixture,inventory_reservation_status:'restored'}),null)
})

test('actual mounted customer and Studio views share the persisted reference/status',()=>{
  const {CustomerOrders,AdminOrders}=views(true)
  for(const View of [CustomerOrders,AdminOrders]) {
    const html=renderToStaticMarkup(createElement(View,{orders:[fixture],refresh:async()=>{},refreshEmails:async()=>{},note:()=>{}}))
    assert.ok(html.includes('BL-100000')); assert.ok(html.includes('Processing')); assert.ok(html.includes('Payment: Paid'))
    assert.ok(!html.includes('Order #')); assert.ok(html.includes('Order progress'))
  }
  for(const path of ['src/lib/admin.ts','src/lib/customer.ts','src/lib/manual-payment.ts','supabase/functions/send-order-email/index.ts']) assert.ok(read(path).includes('order_reference'))
  assert.ok(!read('src/App.tsx').includes('order_number'))
})

test('fulfillment action locks repeated clicks and sends expected persisted status',async()=>{
  let resolve; const wait=new Promise(r=>resolve=r); let calls=0,refreshes=0
  const hooks=[];let cursor=0
  const jsx=(type,props)=>({type,props})
  const oldWindow=globalThis.window; globalThis.window={confirm:()=>true}
  try {
    const {OrderFulfillmentAction}=compile(read('src/OrderFulfillmentAction.tsx'),{
      react:{useRef:v=>hooks[cursor++]??={current:v},useState:v=>{const i=cursor++;if(!(i in hooks))hooks[i]=v;return[hooks[i],v=>hooks[i]=v]}},
      'react/jsx-runtime':{jsx,jsxs:jsx},'./lib/order-fulfillment':fulfillment,
      './lib/admin':{advanceOrderFulfillment:async(...args)=>{assert.deepEqual(args,[fixture.id,'processing','shipped']);calls++;await wait}},
    })
    const render=()=>{cursor=0;return OrderFulfillmentAction({order:fixture,refresh:async()=>{refreshes++}})}
    const button=render().props.children[0]; const pending=button.props.onClick(); await button.props.onClick()
    assert.equal(calls,1);assert.equal(render().props.children[0].props.disabled,true)
    resolve();await pending;assert.equal(refreshes,1);assert.equal(render().props.children[0].props.disabled,false)
  } finally {globalThis.window=oldWindow}
})

test('checkout wrapper and summary return the database reference, never a client sequence',async()=>{
  const data={order_id:fixture.id,order_reference:fixture.order_reference}
  const {createManualOrder,getManualOrderSummary}=compile(read('src/lib/manual-payment.ts'),{'./supabase':{supabase:{
    rpc:async(name,args)=>{assert.equal(name,'create_manual_order_with_reference');assert.equal(args.idempotency_key,'stable-key');return{data:[data]}},
    from:()=>({select:fields=>{assert.ok(fields.includes('order_reference'));return{eq:()=>({single:async()=>({data})})}}}),
  }}})
  assert.equal((await createManualOrder([],{},'manual_email','stable-key')).order_reference,fixture.order_reference)
  assert.equal((await getManualOrderSummary(fixture.id)).order_reference,fixture.order_reference)
})
