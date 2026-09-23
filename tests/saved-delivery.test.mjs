import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { read, compile, viewSource } from './order-view-fixtures.mjs'
import { journey, views } from './checkout-polish-fixtures.mjs'

const checkout=viewSource('Checkout')
const ast=ts.createSourceFile('checkout.tsx',checkout,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let prefillEffect
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0].getText(ast).includes('getCustomerDelivery'))prefillEffect=node.arguments[0].getText(ast);ts.forEachChild(node,visit)}
visit(ast)
const evaluate=(source,context)=>new Function(...Object.keys(context),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(context))
const saved={first_name:'Saved',last_name:'Customer',address:'1 Saved Street',unit:'Suite 2',country:'United States',province:'California',city:'Los Angeles',postal_code:'90210',phone:'+12135550100'}
function prefill({draft=null,customerId='a'}={}) {
  const state={address:draft??{country:'Canada'},notice:''};let resolve,reject,calls=0
  const context={customerId,deliverySession:{current:false},deliveryEdited:{current:Boolean(draft)},getCustomerDelivery:()=>{calls++;return new Promise((r,j)=>{resolve=r;reject=j})},setAddress:v=>{state.address=v},setDeliveryNotice:v=>{state.notice=v}}
  const cleanup=evaluate(`return (${prefillEffect})()`,context)
  return {state,context,cleanup,get calls(){return calls},load:async(address=saved,id='a')=>{resolve({user:{id,email:'account@example.test'},profile:{first_name:'Profile',last_name:'Customer',phone:'1234567890'},address});await Promise.resolve()},fail:async()=>{reject(Error('offline'));await Promise.resolve();await Promise.resolve()}}
}
test('returning customer prefill uses the saved country/address and remains editable; first-time customers get profile defaults',async()=>{
  const fixture=prefill();await fixture.load()
  assert.deepEqual(fixture.state.address,{...saved,email:'account@example.test'})
  assert.match(fixture.state.notice,/Using your saved/)
  fixture.context.deliveryEdited.current=true;fixture.state.address.address='Edited delivery'
  assert.equal(fixture.state.address.address,'Edited delivery')
  const first=prefill();await first.load(null)
  assert.equal(first.state.address.first_name,'Profile');assert.equal(first.state.address.country,'Canada');assert.equal(first.state.notice,'')
  const html=renderToStaticMarkup(createElement(views().Checkout,{cart:[],subtotal:10,user:'account@example.test',customerId:'a'}))
  assert.doesNotMatch(html,/readOnly|readonly/);assert.match(html,/Save these delivery details for future orders/)
  const loading=renderToStaticMarkup(createElement(views().Checkout,{cart:[],subtotal:10,user:'account@example.test',customerId:null}))
  assert.match(loading,/Loading your delivery details/);assert.doesNotMatch(loading,/<input/)
})
test('active drafts, edits during loading, unmounts and other identities cannot be overwritten by late saved-address responses',async()=>{
  for(const situation of ['draft','editing','unmounted','different-owner']) {
    const fixture=prefill({draft:situation==='draft'?{country:'Hong Kong',address:'Draft',province:'',postal_code:''}:null})
    if(situation==='editing'){fixture.context.deliveryEdited.current=true;fixture.state.address={country:'Canada',address:'Typing'}}
    if(situation==='unmounted')fixture.cleanup()
    const before={...fixture.state.address}
    await fixture.load(saved,situation==='different-owner'?'b':'a')
    assert.deepEqual(fixture.state.address,before,situation)
  }
  const signedOut=prefill({customerId:null});assert.equal(signedOut.calls,0)
  const failed=prefill();await failed.fail();assert.match(failed.state.notice,/unavailable/)
})
test('draft recovery is scoped to the authenticated identity and never adopts an unowned legacy draft',()=>{
  const storage={getItem:key=>({'blg-checkout-draft:a':JSON.stringify(saved),'blg-checkout-draft':JSON.stringify({address:'Legacy private address'})})[key]??null}
  assert.deepEqual(journey.readCheckoutDraft(storage,'a'),saved)
  assert.deepEqual(journey.readCheckoutDraft(storage,'b'),{country:'Canada'})
  assert.match(read('src/App.tsx'),/key=\{customerId \?\? "signed-out"\}/)
})
test('existing retry keys survive the move to account-scoped storage without reusing another scoped key',()=>{
  let initializer
  function find(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='checkoutIdempotencyKey')initializer=node.initializer.getText(ast);ts.forEachChild(node,find)}
  find(ast)
  const get=(values,customerId='a')=>evaluate(`return ${initializer}`,{customerId,idempotencyStorageKey:`blg-checkout-idempotency-key:${customerId}`,sessionStorage:{getItem:key=>values[key]??null},useRef:value=>value,crypto:{randomUUID:()=> 'new-key'}})
  assert.equal(get({'blg-checkout-idempotency-key':'existing-key'}),'existing-key')
  assert.equal(get({'blg-checkout-idempotency-key:a':'scoped-key','blg-checkout-idempotency-key':'existing-key'}),'scoped-key')
  assert.equal(get({'blg-checkout-idempotency-key:a':'private-key'},'b'),'new-key')
  assert.equal(get({'blg-checkout-idempotency-key':'existing-key'},null),'new-key')
})
test('delivery API derives ownership, allowlists columns, persists updates, and rejects signed-out or switched-account calls',async()=>{
  let currentUser={id:'a',email:'account@example.test'};const rows=new Map();const queried=[]
  const supabase={auth:{getUser:async()=>({data:{user:currentUser}})},from:table=>{
    queried.push(table)
    return {
      upsert:async(row,options)=>{assert.equal(table,'customer_addresses');assert.equal(options.onConflict,'customer_id');rows.set(row.customer_id,row);return{}},
      select:()=>({eq:(column,id)=>({single:async()=>({data:{first_name:'Profile'}}),maybeSingle:async()=>{assert.equal(column,'customer_id');assert.equal(id,currentUser.id);return{data:rows.get(id)??null}}})}),
    }
  }}
  const api=compile(read('src/lib/customer.ts'),{'./supabase':{supabase}})
  await api.saveCustomerAddress({...saved,email:'delivery@example.test',customer_id:'b',role:'admin',id:'forged'},'a')
  const row=rows.get('a');assert.equal(row.customer_id,'a');assert.ok(!('email'in row));assert.ok(!('role'in row));assert.ok(!('id'in row))
  assert.equal((await api.getCustomerDelivery('a')).address.address,saved.address)
  await api.saveCustomerAddress({...saved,address:'2 Updated Street'},'a')
  assert.equal((await api.getCustomerDelivery('a')).address.address,'2 Updated Street')
  assert.equal(rows.size,1)
  currentUser={id:'b'}
  await assert.rejects(api.saveCustomerAddress(saved,'a'),/Sign in required/)
  await assert.rejects(api.getCustomerDelivery('a'),/Sign in required/)
  currentUser=null
  await assert.rejects(api.saveCustomerAddress(saved,'a'),/Sign in required/)
  await assert.rejects(api.getCustomerDelivery('a'),/Sign in required/)
  assert.ok(queried.every(table=>['profiles','customer_addresses'].includes(table)))
})
