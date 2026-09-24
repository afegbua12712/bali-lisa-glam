import assert from 'node:assert/strict'
import test from 'node:test'
import {read,compile} from './order-view-fixtures.mjs'
const options=compile(read('src/lib/product-options.ts'))
const helpers=compile(read('src/lib/storefront.ts'),{'./product-options':options})
const {browseProducts,storefrontCategories,emptyFilters,priceRangeError,bagItemIssue,refreshBagPrices,inStock}=helpers
const make=(id,overrides={})=>({id,name:`Product ${id}`,description:'Comforting daily care',category:'Lips',categoryActive:true,categoryOrder:2,image:'/fixture.svg',price:12,inventory:5,rating:0,reviews:0,createdAt:'2026-09-01',options:[],...overrides})
const catalog=[make(1,{name:'Rose Lip Oil',price:18,rating:4.5,reviews:3,createdAt:'2026-09-03'}),make(2,{category:'Eyes',categoryOrder:1,price:9,rating:5,reviews:0}),make(3,{price:24,inventory:0,rating:4.5,reviews:8,createdAt:'2026-09-04'}),make(4,{category:'Retired',categoryActive:false})]
const ids=(filters,rows=catalog)=>browseProducts(rows,{...emptyFilters,...filters}).map(p=>p.id)
test('search normalizes case/whitespace and combines real name, category and description terms',()=>{
  assert.deepEqual(ids({query:'  ROSE   lip   '}),[1])
  assert.deepEqual(ids({query:'eyes daily'}),[2])
  assert.deepEqual(ids({query:'retired'}),[])
  assert.deepEqual(ids({query:'absent'}),[])
  assert.deepEqual(ids(emptyFilters),[1,2,3,4])
})
test('category, price and availability combine; clear filters preserve only explicitly retained search',()=>{
  assert.deepEqual(ids({category:'Lips',minPrice:'18',maxPrice:'25',availability:'in-stock'}),[1])
  assert.deepEqual(ids({category:'Lips',availability:'out-of-stock'}),[3])
  assert.deepEqual(ids({minPrice:'20',maxPrice:'10'}),[])
  assert.match(priceRangeError('20','10'),/Minimum/);assert.match(priceRangeError('-1',''),/zero/)
  assert.deepEqual(ids({...emptyFilters,query:'Rose'}),[1])
  assert.deepEqual(storefrontCategories([...catalog,catalog[0]]).map(c=>c.name),['Eyes','Lips'])
})
test('sort runs after filtering, uses approved rating counts and real dates without mutating catalog',()=>{
  const before=structuredClone(catalog)
  assert.deepEqual(ids({sort:'Price: low to high'}),[2,4,1,3])
  assert.deepEqual(ids({sort:'Price: high to low',category:'Lips'}),[3,1])
  assert.deepEqual(ids({sort:'Top rated'}),[3,1,2,4])
  assert.deepEqual(ids({sort:'Newest'}),[3,1,2,4])
  assert.deepEqual(catalog,before)
})
test('bag messages enforce shared stock, missing products and changed option selections',()=>{
  const line={id:1,price:10,quantity:2,selected_options:[]}
  assert.equal(bagItemIssue(line,catalog,[line]),'')
  assert.match(bagItemIssue(line,[],[line]),/No longer available/)
  assert.match(bagItemIssue({...line,id:3},catalog,[]),/Out of stock/)
  assert.match(bagItemIssue(line,catalog,[line,{...line,quantity:4}]),/exceeds current stock/)
  const group={id:'shade',name:'Shade',required:true,values:[{id:'rose',label:'Rose',active:true}]}
  const product={...catalog[0],options:[group]}
  assert.match(bagItemIssue(line,[product],[line]),/options have changed/)
  const selected={...line,selected_options:[{group_id:'shade',value_id:'rose',name:'Shade',value:'Rose'}]}
  assert.equal(bagItemIssue(selected,[product],[selected]),'')
  assert.match(bagItemIssue(selected,[{...product,options:[]}],[selected]),/options have changed/)
  assert.equal(inStock(undefined),false);assert.equal(inStock(0),false)
})
test('bag price refresh retains identity, options and quantity and leaves unknown products intact',()=>{
  const line={id:1,price:10,quantity:2,shade:'Rose',selected_options:[]},missing={id:99,price:3,quantity:1}
  const bag=[line,missing],next=refreshBagPrices(bag,catalog)
  assert.equal(next[0].price,18);assert.equal(next[0].previousPrice,10)
  assert.equal(next[0].quantity,2);assert.equal(next[0].selected_options,line.selected_options)
  assert.equal(options.cartLineKey(next[0]),options.cartLineKey(line));assert.equal(next[1],missing)
  assert.equal(line.price,10);assert.equal(refreshBagPrices(next,catalog),next)
})
test('catalog service selects active products and carries real category/date data without extra card queries',async()=>{
  let queries=0,stats=0,fields;const filters=[]
  const supabase={from:table=>{assert.equal(table,'products');queries++;const q={select:value=>{fields=value;return q},eq:(...args)=>{filters.push(args);return q},order:async()=>({data:[{id:1,name:'Rose',price_cents:1800,image_url:'/fixture.svg',description:'Care',shades:[],inventory_quantity:5,created_at:'2026-09-01',categories:{name:'Hidden',is_active:false,sort_order:1},product_images:[],product_option_groups:[]}]})};return q}}
  const images=compile(read('src/lib/product-images.ts'))
  const api=compile(read('src/lib/store.ts'),{'./supabase':{supabase},'./product-options':options,'./product-images':images,'./reviews':{fetchReviewStats:async()=>{stats++;return[]}}})
  const result=await api.fetchProducts()
  assert.deepEqual(filters,[['is_active',true]]);assert.equal(queries,1);assert.equal(stats,1)
  assert.match(fields,/created_at/);assert.match(fields,/categories\(name,is_active,sort_order,image_url\)/)
  assert.equal(result[0].categoryActive,false);assert.deepEqual(storefrontCategories(result),[]);assert.equal(result[0].createdAt,'2026-09-01')
})
