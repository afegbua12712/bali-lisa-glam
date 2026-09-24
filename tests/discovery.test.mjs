import assert from 'node:assert/strict'
import test from 'node:test'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {read,compile,catalog,favorites,components,FavoriteButton,discoveryFixture} from './discovery-fixtures.mjs'
const discovery=compile(read('src/lib/discovery.ts'))

test('related products exclude current/unavailable, prioritize category, deduplicate and fall back deterministically',()=>{
  const rows=[...catalog,catalog[1],{...catalog[3],id:5,is_active:false},{...catalog[3],id:6,inventory:undefined}]
  assert.deepEqual(discovery.relatedProducts(catalog[0],rows).map(p=>p.id),[2,4])
  assert.deepEqual(discovery.relatedProducts(catalog[0],[...rows].reverse()).map(p=>p.id),[2,4])
  assert.equal(discovery.relatedProducts(catalog[0],rows,1).length,1)
})
test('recent IDs are bounded, newest first, unique, validated and resilient to corrupt/blocked storage',()=>{
  let ids=[];for(let id=1;id<=12;id++)ids=discovery.rememberProduct(ids,id)
  assert.deepEqual(ids,[12,11,10,9,8,7,6,5]);assert.deepEqual(discovery.rememberProduct(ids,8),[8,12,11,10,9,7,6,5])
  for(const text of ['{','null','{}','"oops"'])assert.deepEqual(discovery.readRecent({getItem:()=>text}),[])
  assert.deepEqual(discovery.readRecent({getItem(){throw Error('blocked')}}),[])
  assert.deepEqual(discovery.readRecent({getItem:()=>JSON.stringify([1,1,2,-1,'3',null,1.5])}),[1,2])
  assert.deepEqual(discovery.recentProducts([1,3,999,2,4,2],catalog,1).map(p=>p.id),[2,4])
})
test('wishlist service authenticates each operation and only reads/writes owner associations',async()=>{
  let user={id:'a'},last;const calls=[]
  const supabase={auth:{getUser:async()=>({data:{user}})},from:table=>{
    assert.equal(table,'wishlists');last={filters:[]};calls.push(last)
    const q={select:fields=>{last.fields=fields;return q},eq:(...filter)=>{last.filters.push(filter);return q},order:async()=>({data:[{product_id:1},{product_id:1},{product_id:2}]}),upsert:(data,options)=>{last.data=data;last.options=options;return q},delete:()=>{last.deleted=true;return q},then:resolve=>Promise.resolve(resolve({error:null}))};return q
  }}
  const api=compile(read('src/lib/wishlist.ts'),{'./supabase':{supabase}})
  assert.deepEqual(await api.getWishlist('a'),[1,2]);assert.deepEqual(last.filters,[['customer_id','a']]);assert.equal(last.fields,'product_id')
  await api.setFavorite(1,true,'a');assert.deepEqual(last.data,{customer_id:'a',product_id:1});assert.deepEqual(last.options,{onConflict:'customer_id,product_id',ignoreDuplicates:true})
  await api.setFavorite(1,false,'a');assert.equal(last.deleted,true);assert.deepEqual(last.filters,[['customer_id','a'],['product_id',1]])
  const before=calls.length;await assert.rejects(api.setFavorite(1,true,'b'));user=null;await assert.rejects(api.getWishlist('a'));await assert.rejects(api.setFavorite(1,false,'a'));assert.equal(calls.length,before)
})
test('shared cards route option products to details and preserve simple add / out-of-stock behavior',()=>{
  let shown=0,added=0
  for(const p of catalog.slice(0,3)) {
    const tree=components.Card({p,favorites,show:()=>shown++,add:()=>added++,favoriteSignIn(){}})
    const button=tree.props.children.at(-1).props.children.at(-1)
    if(p.id===1){assert.equal(button.props.children,'Choose options');button.props.onClick()}
    if(p.id===2){assert.equal(button.props.children,'Add to bag');button.props.onClick()}
    if(p.id===3)assert.equal(button.props.disabled,true)
  }
  assert.equal(shown,1);assert.equal(added,1)
})
test('wishlist handles missing catalog records and empty/loading/errors; hearts expose state and auth path',()=>{
  const html=renderToStaticMarkup(discoveryFixture('wishlist'))
  for(const text of ['Your wishlist','Choose options','Out of stock','Product no longer available','Remove unavailable product from wishlist','18.00'])assert.ok(html.includes(text),text)
  assert.match(renderToStaticMarkup(discoveryFixture('empty')),/Tap a heart/)
  assert.match(renderToStaticMarkup(discoveryFixture('loading')),/role="status"/)
  assert.match(renderToStaticMarkup(discoveryFixture('error')),/Try again/)
  assert.match(renderToStaticMarkup(discoveryFixture('prompt')),/Sign in to save your favorites/)
  const saved=renderToStaticMarkup(createElement(FavoriteButton,{id:1,name:'Rose',favorites,signIn(){}}));assert.match(saved,/aria-pressed="true"/);assert.match(saved,/Remove Rose from wishlist/)
  const pending=renderToStaticMarkup(createElement(FavoriteButton,{id:1,name:'Rose',favorites:{...favorites,loading:true,ids:[]},signIn(){}}));assert.match(pending,/disabled/);assert.match(pending,/aria-busy="true"/)
})

// Exercise the real hook with controlled effects and deferred service responses.
function hookHarness(source, dependencies={}) {
  const cells=[];let index=0,effects=[]
  const react={
    useState(initial){const i=index++;if(!cells[i])cells[i]={value:typeof initial==='function'?initial():initial};return[cells[i].value,value=>{cells[i].value=typeof value==='function'?value(cells[i].value):value}]},
    useRef(initial){const i=index++;return cells[i]??(cells[i]={current:initial})},
    useEffect(fn,deps){const i=index++,old=cells[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){effects.push(()=>{old?.cleanup?.();cells[i]={deps,cleanup:fn()}})}}
  }
  const api=compile(source,{...dependencies,react})
  return {render(name,...args){index=0;return api[name](...args)},flush(){const work=effects;effects=[];work.forEach(fn=>fn())}}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('favorites lock duplicate requests, retain state on failure, retry, and discard responses after account changes',async()=>{
  const first=deferred(),write=deferred();let mutations=0
  const service={getWishlist:owner=>owner==='a'?first.promise:Promise.resolve([2]),setFavorite:()=>{mutations++;return write.promise}}
  const h=hookHarness(read('src/useFavorites.ts'),{'./lib/wishlist':service})
  let value=h.render('useFavorites','a',false);h.flush();assert.deepEqual(value.ids,[]);assert.equal(value.loading,true)
  first.resolve([1]);await settle();value=h.render('useFavorites','a',true);assert.deepEqual(value.ids,[1])
  const pending=value.toggle(1);await value.toggle(1);assert.equal(mutations,1)
  value=h.render('useFavorites','a',true);assert.deepEqual(value.pending,[1]);assert.deepEqual(value.ids,[1])
  write.reject(Error('offline'));await pending;value=h.render('useFavorites','a',true);assert.deepEqual(value.ids,[1]);assert.match(value.errors[1],/try again/)
  const late=deferred();service.setFavorite=()=>late.promise;const stale=value.toggle(1)
  value=h.render('useFavorites','b',true);assert.deepEqual(value.ids,[]);h.flush();await settle()
  late.resolve();await stale;value=h.render('useFavorites','b',true);assert.deepEqual(value.ids,[2]);assert.deepEqual(value.pending,[])
  service.setFavorite=async()=>{};await value.toggle(2);value=h.render('useFavorites','b',true);assert.deepEqual(value.ids,[])
  await value.toggle(4);value=h.render('useFavorites','b',true);assert.deepEqual(value.ids,[4])
  value=h.render('useFavorites',null,true);assert.deepEqual(value.ids,[]);h.flush()
})
test('favorites discard old loads and a failed load offers retry without enabling blind writes',async()=>{
  const first=deferred();let count=0
  const service={getWishlist:()=>++count===1?first.promise:Promise.resolve([2]),setFavorite:()=>assert.fail('must not write while loading/error')}
  const h=hookHarness(read('src/useFavorites.ts'),{'./lib/wishlist':service})
  h.render('useFavorites','a',true);h.flush()
  h.render('useFavorites','b',true);h.flush();await settle()
  first.resolve([1]);await settle();let value=h.render('useFavorites','b',true);assert.deepEqual(value.ids,[2])
  service.getWishlist=async()=>{throw Error('offline')};value.retry();h.render('useFavorites','b',true);h.flush();await settle()
  value=h.render('useFavorites','b',true);assert.match(value.error,/could not be loaded/);await value.toggle(1)
  service.getWishlist=async()=>[3];value.retry();h.render('useFavorites','b',true);h.flush();await settle();assert.deepEqual(h.render('useFavorites','b',true).ids,[3])
})
test('signed-out heart opens a sign-in prompt without a wishlist write and provides a working auth action',()=>{
  let signedIn=0
  const props={id:1,name:'Rose',favorites:{...favorites,ids:[],signedIn:false,toggle:()=>assert.fail('anonymous write')},signIn:()=>signedIn++}
  const h=hookHarness(read('src/FavoriteButton.tsx'))
  let tree=h.render('FavoriteButton',props);tree.props.children[0].props.onClick()
  tree=h.render('FavoriteButton',props);assert.equal(tree.props.children[1].props.role,'status')
  tree.props.children[1].props.children[1].props.onClick();assert.equal(signedIn,1)
})
