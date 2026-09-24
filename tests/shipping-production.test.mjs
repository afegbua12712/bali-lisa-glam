import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {views} from './checkout-polish-fixtures.mjs'
import {compile,read} from './order-view-fixtures.mjs'
const render=(C,p)=>renderToStaticMarkup(createElement(C,p))
test('actual checkout selects destination method, rate and estimate without guaranteed delivery',()=>{
  for(const [country,label,charge] of [['Canada','Standard Shipping','CA$10.00'],['Nigeria','International Shipping','CA$20.00']]){
    const {Checkout}=views(1,country)
    const html=render(Checkout,{cart:[],subtotal:10,user:'fixture',customerId:'fixture'})
    assert.ok(html.includes(label));assert.ok(html.includes(charge));assert.ok(html.includes('not guarantees'))
    if(country!=='Canada')assert.ok(html.includes('customs'))
  }
})
test('shared shipment display uses persisted data and safely escapes arbitrary tracking text',()=>{
  const {ShipmentDetails}=compile(read('src/ShipmentDetails.tsx'))
  const html=render(ShipmentDetails,{order:{status:'shipped',shipping_method:'International Shipping',shipment_carrier:'Custom service',tracking_number:'<script>bad</script>'}})
  assert.ok(html.includes('International Shipping'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<a '))
  assert.ok(render(ShipmentDetails,{order:{status:'shipped'}}).includes('No tracking provided'))
  assert.ok(render(ShipmentDetails,{order:{status:'fulfilled'}}).includes('historical order'))
})
test('shipment emails use the existing escaped BL-reference templates and provider idempotency',()=>{
  const source=read('supabase/functions/send-order-email/index.ts')
  assert.ok(source.includes('order_shipped'));assert.ok(source.includes('order_delivered'))
  assert.ok(source.includes('escapeHtml(shipmentText)'));assert.ok(source.includes('order.order_reference'))
  assert.ok(source.includes('Idempotency-Key'));assert.ok(!source.includes('order.order_number'))
})

test('local Edge handler renders escaped shipment data and sends no internal identifiers',async()=>{
  const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch,oldInfo=console.info
  let handler,delivery
  const order={id:'internal-order-id',order_reference:'BL-100001',status:'shipped',payment_status:'paid',shipment_carrier:'Service <unsafe>',tracking_number:'REF<&>',shipped_at:'2026-09-24T10:00:00Z',shipping_address:{email:'customer@example.test',country:'Canada'},currency:'CAD',subtotal_cents:1000,shipping_cents:1000,total_cents:2000,order_items:[]}
  const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>({data:[{notification_id:'internal-notification-id',should_send:true}]}),from:table=>({select:()=>({eq:()=>({single:async()=>({data:table==='orders'?order:{business_name:'Fixture',business_email:'support@example.test'}})})}),update:()=>({eq:async()=>({error:null})})})}
  try{
    console.info=()=>{}
    globalThis.Deno={env:{get:()=> 'synthetic-value'},serve:fn=>{handler=fn}}
    globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');delivery=JSON.parse(options.body);assert.ok(options.headers['Idempotency-Key'].endsWith('order_shipped'));return Response.json({id:'synthetic-provider'})}
    compile(read('supabase/functions/send-order-email/index.ts'),{'https://esm.sh/@supabase/supabase-js@2.112.4':{createClient:()=>client}})
    const response=await handler(new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({order_id:order.id,event_type:'order_shipped'})}))
    assert.equal(response.status,200);assert.ok(delivery.subject.includes('BL-100001'));assert.ok(delivery.html.includes('Service &lt;unsafe&gt;'));assert.ok(delivery.text.includes('REF<&>'))
    for(const value of [delivery.subject,delivery.html,delivery.text])assert.ok(!value.includes('internal-order-id'))
  }finally{globalThis.Deno=oldDeno;globalThis.fetch=oldFetch;console.info=oldInfo}
})
