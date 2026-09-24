import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import {read,compile} from './order-view-fixtures.mjs'
const options=compile(read('src/lib/product-options.ts'))
const {planReorder}=compile(read('src/lib/reorder.ts'),{'./product-options':options})
const product={id:1,name:'Lip Oil',price:17,inventory:8,shades:['Rose'],options:[{id:'shade',name:'Shade',required:true,values:[{id:'rose',label:'Rose',active:true},{id:'red',label:'Red',active:true}]}]}
const choice={group_id:'shade',value_id:'rose',name:'Shade',value:'Rose'}
const item={product_id:1,product_name:'Historical Lip Oil',quantity:2,unit_price_cents:1500,shade:'Shade: Rose',selected_options:[choice]}
const line={...product,price:14,quantity:1,shade:'Shade: Rose',selected_options:[choice]}
test('reorder merges by cart identity at current prices while preserving old snapshots and unrelated bag items',()=>{
  const other={...line,id:2,name:'Existing product'}
  const before=structuredClone({item,product,line,other})
  const result=planReorder([item],[product],[line,other])
  assert.equal(result.cart.length,2);assert.equal(result.cart[0].quantity,3);assert.equal(result.cart[0].price,17)
  assert.deepEqual(result.cart[0].selected_options,[choice]);assert.equal(result.cart[1],other)
  assert.match(result.notices.join(' '),/price has changed/)
  assert.deepEqual({item,product,line,other},before)
})
test('missing products, zero stock, changed option identities/labels and new required options are never substituted',()=>{
  for(const catalog of [[],[{...product,inventory:0}],[{...product,inventory:undefined}],[{...product,options:[]}],
    [{...product,options:[{...product.options[0],values:[{id:'rose',label:'Rose',active:false}]}]}],
    [{...product,options:[{...product.options[0],values:[{id:'rose',label:'Different shade',active:true}]}]}],
    [{...product,options:[{...product.options[0],id:'replacement'}]}],
    [{...product,options:[...product.options,{id:'size',name:'Size',required:true,values:[{id:'m',label:'M',active:true}]}]}]]) {
    const bag=[line],result=planReorder([item],catalog,bag)
    assert.equal(result.added,0);assert.equal(result.cart,bag);assert.equal(result.notices.length,1)
  }
})
test('stock is shared across options, earlier reordered items and existing bag quantities',()=>{
  const red={...line,quantity:4,shade:'Shade: Red',selected_options:[{...choice,value_id:'red',value:'Red'}]}
  const result=planReorder([{...item,quantity:6},item],[product],[red])
  assert.equal(result.added,4);assert.equal(result.cart.reduce((sum,row)=>sum+row.quantity,0),8)
  assert.match(result.notices.join(' '),/added 4 of 6/);assert.match(result.notices.join(' '),/no more stock/)
})
test('plain products and unambiguous legacy Shade choices work; ambiguous legacy options fail closed',()=>{
  assert.equal(planReorder([{...item,selected_options:[],shade:'Universal'}],[{...product,options:[],shades:['Universal']}],[]).added,2)
  assert.deepEqual(planReorder([{...item,selected_options:null,shade:'Rose'}],[product],[]).cart[0].selected_options,[choice])
  assert.equal(planReorder([{...item,selected_options:null,shade:'Shade: Rose · Size: M'}],[product],[]).added,0)
  assert.equal(planReorder([{...item,selected_options:[{name:'Shade',value:'Rose'}]}],[product],[]).added,2)
  assert.equal(planReorder([{...item,quantity:-1}],[product],[]).added,0)
})

const source=read('src/App.tsx'),ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let callback
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='reorder')callback=node.initializer.getText(ast);ts.forEachChild(node,visit)}visit(ast)
const execute=context=>new Function(...Object.keys(context),ts.transpileModule(`return (${callback})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(context))
test('mounted reorder refreshes catalog, uses the latest bag, opens bag only on success and never writes an order/payment',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve});let currentUser='a',opened=0,writes=0
  const context={reorderLock:{current:false},reorderOwner:{current:'a'},latestBag:{current:[]},products:[],
    getReorderItems:async(id,owner)=>{assert.equal(id,'old-order');assert.equal(owner,'a');return[item]},fetchProducts:async()=>{await pending;return[product]},
    supabase:{auth:{getUser:async()=>({data:{user:{id:currentUser}}})},rpc:()=>{throw Error('No RPC allowed')},from:()=>{throw Error('No mutation allowed')}},
    planReorder,setCatalogVersion(){},setCart:bag=>{writes++;context.latestBag.current=bag},setReorderResult(){},setCartOpen:()=>{opened++}}
  const reorder=execute(context),request=reorder('old-order','a')
  await assert.rejects(reorder('old-order','a'))
  context.latestBag.current=[line];release();await request
  assert.equal(context.latestBag.current[0].quantity,3);assert.equal(writes,1);assert.equal(opened,1)
  currentUser='b';await assert.rejects(reorder('old-order','a'),/Sign in required/);assert.equal(writes,1)
  currentUser='a';context.fetchProducts=async()=>[]
  const unavailable=await execute(context)('old-order','a');assert.equal(unavailable.added,0);assert.equal(writes,1);assert.equal(opened,1)
})
