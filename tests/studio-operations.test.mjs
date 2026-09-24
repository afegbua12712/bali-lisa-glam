import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {compile,read,viewSource} from './order-view-fixtures.mjs'
const ops=compile(read('src/lib/studio-operations.ts'))
const order={customer_id:'a',status:'processing',payment_status:'paid',inventory_reservation_status:'committed',currency:'CAD',total_cents:3000,created_at:'2026-09-20'}
const products=[{name:'Rose',is_active:true,inventory_quantity:3,categories:{name:'Lips'}},{name:'Empty',is_active:true,inventory_quantity:0},{name:'Archived',is_active:false,inventory_quantity:1}]
test('confirmed sales exclude unpaid, uncommitted and refunded orders and never mix currencies',()=>{
 const rows=[order,{...order,payment_status:'awaiting_payment'},{...order,inventory_reservation_status:'reserved'},{...order,inventory_reservation_status:null},{...order,status:'refunded'},{...order,status:'cancelled'},{...order,currency:'USD',total_cents:500}]
 assert.deepEqual(ops.confirmedTotals(rows),[['CAD',3000],['USD',500]])
 const m=ops.studioMetrics(products,rows,[{role:'customer'},{role:'admin'}]);assert.equal(m.customers,1);assert.equal(m.lowStock,1);assert.equal(m.outOfStock,1);assert.equal(m.activeProducts,2);assert.equal(m.totalOrders,7)
})
test('inventory filters combine case/whitespace search with active low/out/archive states',()=>{
 assert.deepEqual(ops.filterStudioProducts(products,' LIPS ','low').map(p=>p.name),['Rose'])
 assert.deepEqual(ops.filterStudioProducts(products,'','out').map(p=>p.name),['Empty'])
 assert.deepEqual(ops.filterStudioProducts(products,'','archived').map(p=>p.name),['Archived'])
 assert.equal(ops.filterStudioProducts(products,'missing','all').length,0)
})
test('customer activity is owner-scoped and uses confirmed spend with latest persisted order date',()=>{
 const result=ops.customerActivity('a',[order,{...order,created_at:'2026-09-24',payment_status:'awaiting_payment'},{...order,customer_id:'b',total_cents:999999}]);assert.equal(result.count,2);assert.equal(result.latest,'2026-09-24');assert.deepEqual(result.totals,[['CAD',3000]])
})
test('actual mounted customer view labels confirmed spend and exposes only operational fields',()=>{
 const {AdminCustomers}=compile("import {useState} from 'react'; import {customerActivity} from 'ops'; const orderMoney=(c,currency)=>currency+' '+c/100; export "+viewSource('AdminCustomers'),{ops})
 const html=renderToStaticMarkup(createElement(AdminCustomers,{customers:[{id:'a',first_name:'Test',email:'test@example.test',phone:'123',role:'customer',created_at:'2026-09-01'}],orders:[order]}));assert.ok(html.includes('CAD 30'));assert.ok(html.includes('Latest order'));assert.ok(html.includes('Phone:'));assert.ok(!html.includes('999999'))
})
test('settings lock repeated submissions and retain friendly errors after failure',async()=>{
 const hooks=[];let cursor=0,calls=0,reject;const waiting=new Promise((_,r)=>reject=r);const jsx=(type,props)=>({type,props});
 const {AdminSettings}=compile("import {useState,useRef} from 'react'; export "+viewSource('AdminSettings'),{react:{useRef:v=>hooks[cursor++]??={current:v},useState:v=>{const i=cursor++;if(!(i in hooks))hooks[i]=v;return[hooks[i],n=>hooks[i]=n]}},'react/jsx-runtime':{jsx,jsxs:jsx}})
 const render=()=>{cursor=0;return AdminSettings({settings:{},setSettings(){},save:()=>{calls++;return waiting}})}
 const form=render();const pending=form.props.onSubmit({preventDefault(){}});await form.props.onSubmit({preventDefault(){}});assert.equal(calls,1);assert.equal(render().props.children.at(-1).props.disabled,true);reject(Error('private database detail'));await pending;assert.equal(render().props.children.at(-1).props.disabled,false);assert.ok(JSON.stringify(render()).includes('Settings could not be saved'));assert.ok(!JSON.stringify(render()).includes('private database detail'))
})
test('admin orders and profiles paginate beyond API row caps with stable ordering',async()=>{
 const calls=[];const chain={select(){return this},order(){return this},range:async(from,to)=>{calls.push([from,to]);return{data:Array.from({length:from===0?500:2},()=>({id:'fixture'})),error:null}}};
 const {fetchAdminOrders,fetchCustomers}=compile(read('src/lib/admin.ts'),{'./supabase':{supabase:{from:()=>chain}},'./product-options':{},'./product-images':{}})
 assert.equal((await fetchAdminOrders()).length,502);assert.equal((await fetchCustomers()).length,502);assert.deepEqual(calls,[[0,499],[500,999],[0,499],[500,999]])
})
