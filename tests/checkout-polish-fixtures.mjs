import * as React from 'react'
import ts from 'typescript'
import { read, compile, viewSource } from './order-view-fixtures.mjs'
export { read, compile }
export const app = read('src/App.tsx')
export const ast = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
export function findNode(predicate) {
  let found
  function visit(node) { if (predicate(node)) found = node; else ts.forEachChild(node, visit) }
  visit(ast)
  if (!found) throw Error('Mounted source fixture not found')
  return found.getText(ast)
}
export const authEffect = findNode(n => ts.isCallExpression(n) && n.expression.getText(ast) === 'useEffect' && n.arguments[0]?.getText(ast).includes('expectedUserId'))
const mobile = findNode(n => ts.isJsxExpression(n) && n.expression?.getText(ast).startsWith('menu &&') && n.getText(ast).includes('mobile-menu-scrim')).slice(1,-1)
export const payment = compile(read('src/PaymentMethodOptions.tsx'))
const support = compile(read('src/lib/support-pages.ts'))
export const journey = compile(read('src/lib/checkout-journey.ts'), { './support-pages': support })
const emailState = compile(read('src/lib/payment-email-state.ts'))
export const email = compile(read('src/PaymentConfirmationEmailAction.tsx'), {
  './lib/payment-email-state': emailState, './lib/order-email': {}, './lib/supabase': {},
})
const dependencies = { ...payment, ...journey, ...compile('const window = {};\n' + read('src/AppearanceControl.tsx')), ...compile(read('src/CartButton.tsx')) }
const constants = ast.statements.filter(n => ts.isVariableStatement(n) && /^(const checkoutCountries|const canadianProvinces)/.test(n.getText(ast))).map(n => n.getText(ast)).join('\n')
const source = `import {useState,useEffect,useRef} from 'react';
  import {ArrowLeft,ArrowRight,Menu,Search,UserRound,X} from 'lucide-react';
  import {PaymentMethodOptions,checkoutAddressRules,readCheckoutDraft,paymentContact,AppearanceControl,CartButton} from 'fixture';
  const sessionStorage={getItem:()=>null};const money=n=>'$'+n.toFixed(2);
  ${constants}
  export ${viewSource('Checkout')}
  export ${viewSource('Header')}
  export function Mobile({isAdmin}) { const menu=true,page='home',setMenu=()=>{},go=()=>{},setCategory=()=>{};return <>${'{'}${mobile}${'}'}</> }
`
export function views(step = 1, country = 'Canada', savedDelivery = false) {
  let index=0
  const address={first_name:'Test',last_name:'Customer',email:'customer@example.test',phone:'+14165550100',address:'1 Test Street',city:'Toronto',country,province:country==='Canada'?'Ontario':'',postal_code:country==='Canada'?'M5V 2T6':''}
  const overrides=[step,address,'manual_whatsapp',{business_email:'support@example.test',whatsapp_number:'+14165550100',standard_shipping_cents:1000,international_standard_shipping_cents:2000}]
  const react={...React,useState:initial=>{const i=index++;return React.useState(i<overrides.length?overrides[i]:i===11&&savedDelivery?'Using your saved delivery details. You can edit any field below.':initial)}}
  const result=compile(source,{react,fixture:dependencies})
  const Checkout=result.Checkout
  return {...result,Checkout:props=>{index=0;return Checkout(props)}}
}

export function addressAccount(country = 'Canada') {
  let index=0
  const {CustomerDashboard}=compile(`import {useState,useEffect,useCallback} from 'react';import {checkoutAddressRules} from 'fixture';export ${viewSource('CustomerDashboard')}`,{
    fixture:journey,react:{...React,useState:initial=>{const i=index++;return React.useState(i===0?{user:{id:'customer-a',email:'customer@example.test'},profile:{first_name:'Test'},address:{first_name:'Test',last_name:'Customer',phone:'+14165550100',address:'1 Saved Street',country,province:country==='Canada'?'Ontario':'',city:'Toronto',postal_code:country==='Canada'?'M5V 2T6':''}}:i===1?'Addresses':i===5?false:initial)}},
  })
  return props=>{index=0;return CustomerDashboard(props)}
}
