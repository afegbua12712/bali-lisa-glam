import * as React from 'react'
import {read,compile,viewSource,fixture,views,fulfillment} from './order-view-fixtures.mjs'
import {journey} from './checkout-polish-fixtures.mjs'
export {read}
export const historical={...fixture,order_reference:'BL-100000000000000001',order_items:[{product_id:1,product_name:'Radiant Rose Everyday Lip Oil with a long historical product name',shade:'Shade: Rose',selected_options:[{name:'Shade',value:'Rose'},{name:'Size',value:'Full size'}],quantity:2,unit_price_cents:1500}],subtotal_cents:3000,total_cents:4000}
const orderMoney=(cents,currency='CAD')=>new Intl.NumberFormat('en-CA',{style:'currency',currency}).format(cents/100)
export function portal(tab='Overview',scenario='populated') {
  let index=0
  const result=scenario==='reorder'?{message:'2 items added to your bag at current prices. Review your bag before checkout.',notices:['Radiant Rose Everyday Lip Oil: added 2 of 4 requested because of current stock.','The previous shade for another product is no longer available. Please choose again from the shop.']}:null
  const {CustomerOrders}=views(scenario==='details'||scenario==='reorder',result)
  const data={user:{id:'customer-a',email:'customer@example.test'},profile:{first_name:'Alexandra',last_name:'Customer',phone:'+14165550100'},address:{first_name:'Alexandra',last_name:'Customer',address:'1 Saved Street',unit:'Suite 12',city:'Toronto',province:'Ontario',postal_code:'M5V 2T6',country:'Canada',phone:'+14165550100'},orders:scenario==='empty'?[]:[historical],wishlist:[]}
  const react={...React,useState:initial=>{const i=index++;return React.useState(i===0?data:i===1?tab:i===5?scenario==='loading':i===6?scenario==='error':initial)}}
  const {CustomerDashboard}=compile(`import {useState,useEffect,useCallback} from 'react';import {CustomerOrders,checkoutAddressRules,orderMoney,orderStatusLabel} from 'fixture';export ${viewSource('CustomerDashboard')}`,{react,fixture:{CustomerOrders,...journey,...fulfillment,orderMoney}})
  return props=>{index=0;return CustomerDashboard({setUser(){},note(){},add(){},goShop(){},reorder:async()=>result,...props})}
}
