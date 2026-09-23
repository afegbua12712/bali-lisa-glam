import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
export const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
export function compile(source, dependencies = {}) {
  const exports = {}
  new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,name => name in dependencies ? dependencies[name] : require(name))
  return exports
}
export const fulfillment = compile(read('src/lib/order-fulfillment.ts'))
export const progress = compile(read('src/OrderProgress.tsx'),{'./lib/order-fulfillment':fulfillment})
export const fixture = {
  id:'00000000-0000-4000-8000-000000000001',order_reference:'BL-100000',created_at:'2026-09-20T10:00:00Z',
  status:'processing',payment_status:'paid',paid_at:'2026-09-20T11:00:00Z',processing_at:'2026-09-20T12:00:00Z',shipped_at:null,delivered_at:null,
  inventory_reservation_status:'committed',payment_method:'manual_email',currency:'CAD',subtotal_cents:1000,shipping_cents:1000,total_cents:2000,
  profiles:{first_name:'Test',last_name:'Customer',email:'customer@example.test'},shipping_address:{address:'1 Test Street',city:'Toronto',country:'Canada'},
  order_items:[{product_name:'Fixture product',shade:'Shade: Rose',quantity:1,unit_price_cents:1000}],order_notifications:[],
}
export function viewSource(name) {
  const source=read('src/App.tsx'); const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)
  if(!node) throw Error('Missing mounted order view')
  return node.getText(ast)
}
export function views(expanded = false) {
  const React=require('react')
  const {OrderFulfillmentAction}=compile(read('src/OrderFulfillmentAction.tsx'),{'./lib/admin':{advanceOrderFulfillment:async()=>{}},'./lib/order-fulfillment':fulfillment})
  const source=`import {useState,useEffect,useMemo,useRef} from 'react';
    import {OrderProgress,OrderFulfillmentAction,orderStatusLabel} from 'fixture';
    const orderMoney=(cents,currency)=>new Intl.NumberFormat('en-CA',{style:'currency',currency}).format(cents/100);
    const paymentStatusLabel=s=>({paid:'Paid',awaiting_payment:'Awaiting Payment',cancelled:'Cancelled'})[s];
    const paymentMethodLabel=()=> 'Email'; const expiredReservation=()=>false;
    const PaymentConfirmationEmailAction=()=>null;
    export ${viewSource('CustomerOrders')}
    export ${viewSource('AdminOrders')}`
  const dependencies={'fixture':{...progress,OrderFulfillmentAction,...fulfillment}}
  return Object.fromEntries(['CustomerOrders','AdminOrders'].map(name=>{
    let stateIndex=0
    const react=expanded?{...React,useState:initial=>React.useState(stateIndex++===(name==='CustomerOrders'?1:11)?fixture.id:initial)}:React
    const View=compile(source,{react,...dependencies})[name]
    return [name,props=>{stateIndex=0;return View(props)}]
  }))
}
