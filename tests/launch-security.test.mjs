import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {compile,read,viewSource} from './order-view-fixtures.mjs'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
const admin='00000000-0000-4000-8000-000000000001', customer='00000000-0000-4000-8000-000000000002', other='00000000-0000-4000-8000-000000000003'

test('blocked or full session storage preserves in-tab checkout retry identity and cleanup',()=>{
 const {resilientSessionStorage}=compile(read('src/lib/session-storage.ts'))
 for(const provider of [()=>{throw Error('blocked')},()=>({getItem:()=>null,setItem:()=>{throw Error('quota')},removeItem:()=>{throw Error('blocked')}})]){
  const store=resilientSessionStorage(provider)
  assert.equal(store.getItem('retry'),null);store.setItem('retry','same-key');assert.equal(store.getItem('retry'),'same-key');store.removeItem('retry');assert.equal(store.getItem('retry'),null)
 }
 const data=new Map([['retry','persisted']]);const store=resilientSessionStorage(()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}))
 assert.equal(store.getItem('retry'),'persisted');store.setItem('retry','next');assert.equal(data.get('retry'),'next');store.removeItem('retry');assert.equal(data.has('retry'),false)
})

test('active Studio guard immediately discards privileged UI when verified session is revoked',()=>{
 const {AdminGuard}=compile("const Admin=()=> <p>PRIVATE STUDIO</p>; const ArrowRight=()=>null; export "+viewSource('AdminGuard'))
 const render=isAdmin=>renderToStaticMarkup(createElement(AdminGuard,{user:'admin@example.test',isAdmin}))
 assert.ok(render(true).includes('PRIVATE STUDIO'));assert.ok(!render(false).includes('PRIVATE STUDIO'))
 assert.match(read('src/App.tsx'),/isAdmin=\{authReady && isAdmin\}/)
})

test('product saves send the original stock snapshot separately from the edited quantity',async()=>{
 let payload
 const {saveAdminProduct}=compile(read('src/lib/admin.ts'),{'./supabase':{supabase:{rpc:async(name,args)=>{payload=args;return{data:1}}}},'./product-options':{},'./product-images':{}})
 await saveAdminProduct({name:'Fixture',slug:'fixture',description:'',price_cents:1000,inventory_quantity:12,expected_inventory_quantity:9,image_url:'/fixture.png',options:[],images:[]},1)
 assert.equal(payload.product_data.inventory_quantity,12)
 assert.equal(payload.product_data.expected_inventory_quantity,9)
 assert.match(read('src/App.tsx'),/expected_inventory_quantity: p.inventory_quantity/)
})

test('Phase 7 privilege and RPC hardening preserves production workflows in isolated PostgreSQL',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;
 `)
 const base=migration('20260828160000_bali_lisa_glam.sql')
 await db.exec(base.slice(base.indexOf('create type public.app_role'),base.indexOf('-- Seed catalog')))
 await db.exec(`insert into auth.users values('${admin}','admin@example.test','{}'),('${customer}','customer@example.test','{}'),('${other}','other@example.test','{}');
 update profiles set role='admin' where id='${admin}';
 create table website_settings(id boolean primary key,free_shipping_threshold_cents integer,standard_shipping_cents integer,updated_at timestamptz);
 insert into website_settings values(true,7500,1000,now());
 alter table website_settings enable row level security;
 create policy read_settings on website_settings for select using(true);
 create policy admin_settings on website_settings for all using(public.is_admin()) with check(public.is_admin());
 insert into products(name,slug,description,price_cents,image_url,inventory_quantity) values('Fixture','fixture','',1000,'https://example.test/p.png',100);
 grant all on all tables in schema public to anon,authenticated;
 grant all on all sequences in schema public to anon,authenticated;`)
 for(const name of ['20260901120000_stripe_checkout.sql','20260901130000_manual_payment.sql','20260901160000_order_archiving.sql','20260903120000_safe_order_contract.sql','20260911190000_product_options.sql','20260901170000_customer_account.sql','20260918120000_checkout_authorization_boundary.sql','20260918150000_protect_reserved_product_deletion.sql','20260918180000_product_galleries_and_reviews.sql','20260923130000_order_references_and_fulfillment.sql','20260903130000_order_notifications.sql','20260924180000_shipping_and_shipments.sql'])await db.exec(migration(name))
 await db.exec('grant all on customer_addresses,wishlists,order_notifications to authenticated;grant all on customer_addresses,wishlists to anon;')
 const before=(await db.query('select id,inventory_quantity from products')).rows
 await db.exec(migration('20260924210000_launch_security_hardening.sql'))
 assert.deepEqual((await db.query('select id,inventory_quantity from products')).rows,before)
 const owner=()=>db.exec('reset role')
 const user=async(id,role='authenticated')=>{await owner();await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role '+role)}
 const create=(lines='[{"product_id":1,"quantity":1,"selected_options":[]}]',method='manual_email',key=randomUUID())=>db.query(`select * from create_manual_order_with_reference($1,'{"country":"Canada"}',$2,$3)`,[lines,method,key])
 let order
 await t.test('whole-table, sequence and direct protected writes are denied',async()=>{
  for(const role of ['anon','authenticated']){
   await user('',role)
   for(const table of ['profiles','orders','order_items','products','customer_addresses','wishlists','website_settings','order_notifications','categories'])await assert.rejects(db.exec('truncate '+table+' cascade'),/permission denied/)
   for(const seq of ['products_id_seq','orders_order_number_seq','order_items_id_seq','categories_id_seq'])await assert.rejects(db.query('select setval($1,1)',[seq]),/permission denied/)
  }
  await user(customer)
  for(const sql of ["update profiles set role='admin'","update orders set payment_status='paid'","update orders set tracking_number='fake'","update orders set total_cents=0","update products set inventory_quantity=900","insert into order_notifications(order_id,event_type) values(gen_random_uuid(),'order_created')"] )await assert.rejects(db.exec(sql),/permission denied/)
 })
 await t.test('null/empty/malformed checkout rejects without stock changes; retry is idempotent',async()=>{
  await user(customer)
  for(const lines of [null,'null','[]','{}','[{"product_id":1,"quantity":0}]'])await assert.rejects(create(lines))
  await assert.rejects(create(undefined,null),/Unsupported payment/)
  const key=randomUUID();order=(await create(undefined,undefined,key)).rows[0]
  assert.equal((await create(undefined,undefined,key)).rows[0].order_id,order.order_id)
  assert.equal(order.total_cents,2000);assert.match(order.order_reference,/^BL-/)
  await owner();assert.equal((await db.query('select inventory_quantity from products where id=1')).rows[0].inventory_quantity,99)
 })
 await t.test('customer ownership, contact editing, address and wishlist operations remain usable',async()=>{
  await user(customer);assert.equal((await db.query('select * from orders')).rows.length,1)
  await db.exec(`update profiles set first_name='Updated' where id='${customer}';insert into customer_addresses(customer_id,first_name,last_name,address,city,province,postal_code,country) values('${customer}','Test','Customer','1 Test','Toronto','Ontario','M5V2T6','Canada');insert into wishlists(customer_id,product_id) values('${customer}',1) on conflict do nothing;delete from wishlists where product_id=1;`)
  await user(other);assert.equal((await db.query('select * from orders')).rows.length,0);assert.equal((await db.query('select * from customer_addresses')).rows.length,0)
  await user('','anon');await assert.rejects(db.exec('select * from orders'),/permission denied/);assert.equal((await db.query('select * from products')).rows.length,1)
 })
 await t.test('admin payment, fulfillment, archive and settings contracts survive; cancellation restores once',async()=>{
  await user(customer);await assert.rejects(db.query('select confirm_manual_payment($1)',[order.order_id]),/Administrator/)
  const unpaid=(await create()).rows[0]
  await user(admin);await db.query('select confirm_manual_payment($1)',[order.order_id]);await assert.rejects(db.query('select confirm_manual_payment($1)',[order.order_id]),/active unpaid/)
  for(const [from,to] of [['paid','processing'],['processing','shipped'],['shipped','delivered']])await db.query('select record_order_shipment($1,$2,$3,$4,$5)',[order.order_id,from,to,to==='shipped'?'Fixture carrier':'',to==='shipped'?'REF':''])
  await assert.rejects(db.query("select record_order_shipment($1,'processing','shipped','','')",[order.order_id]),/Order changed/)
  await db.query('update orders set archived_at=now() where id=$1',[order.order_id]);await db.exec('update products set is_active=false;update products set is_active=true;update website_settings set standard_shipping_cents=1000')
  await db.query("select cancel_unpaid_order($1,'Fixture')",[unpaid.order_id]);await db.query("select cancel_unpaid_order($1,'Fixture')",[unpaid.order_id]);await owner();assert.equal((await db.query('select inventory_quantity from products where id=1')).rows[0].inventory_quantity,99)
 })
 await t.test('all notification events block stale/ambiguous duplicates but allow known pre-acceptance retries',async()=>{
  for(const event of ['order_created','payment_confirmed','order_shipped','order_delivered']){
   await user(event==='order_created'?customer:admin)
   const claim=()=>db.query('select * from claim_order_notification($1,$2)',[order.order_id,event])
   assert.equal((await claim()).rows[0].should_send,true)
   await owner();await db.query("update order_notifications set last_attempt_at=now()-interval '2 days' where order_id=$1 and event_type=$2",[order.order_id,event])
   await user(admin);assert.equal((await claim()).rows[0].should_send,false)
   await owner();await db.query("update order_notifications set status='failed',last_error='Transactional email failed' where order_id=$1 and event_type=$2",[order.order_id,event])
   await user(admin);assert.equal((await claim()).rows[0].should_send,false)
   await owner();await db.query("update order_notifications set status='failed',last_error='Email provider returned HTTP 429' where order_id=$1 and event_type=$2",[order.order_id,event])
   await user(admin);assert.equal((await claim()).rows[0].should_send,true)
  }
 })
 await t.test('review submission and admin gallery save still use trusted functions',async()=>{
  await user(customer);await db.query("select submit_product_review(1,5,'A useful fixture review.')")
  await user(admin);const gallery=[{id:randomUUID(),url:'https://example.test/a.png',alt_text:'Fixture'}]
  const data={name:'Fixture',slug:'fixture',description:'',price_cents:1000,inventory_quantity:99,expected_inventory_quantity:99,is_active:true}
  const save=input=>db.query('select save_product_with_gallery(1,$1,$2,$3)',[JSON.stringify(input),JSON.stringify([]),JSON.stringify(gallery)])
  await assert.rejects(save({...data,inventory_quantity:100,expected_inventory_quantity:100}),/Product stock changed/)
  assert.equal((await db.query('select inventory_quantity from products where id=1')).rows[0].inventory_quantity,99)
  await save(data)
  const review=(await db.query('select * from admin_product_reviews()')).rows[0];await db.query("select moderate_product_review($1,'approved',$2)",[review.id,review.updated_at])
  await user('','anon');assert.equal((await db.query('select rating,body from product_reviews')).rows.length,1);await assert.rejects(db.exec('select customer_id from product_reviews'),/permission denied/)
 })
})

