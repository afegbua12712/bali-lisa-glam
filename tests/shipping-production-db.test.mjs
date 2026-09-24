// Only an ephemeral PostgreSQL WASM database; never connects to production.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
const admin = '00000000-0000-4000-8000-000000000001', customer = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003'

test('Phase 4 shipping snapshots, shipment authorization and notification claims', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;`)
  const base = read('20260828160000_bali_lisa_glam.sql')
  await db.exec(base.slice(base.indexOf('create type public.app_role'), base.indexOf('create or replace function public.handle_new_user')))
  await db.exec(base.slice(base.indexOf('create or replace function public.is_admin()'), base.indexOf('create or replace function public.create_order(')))
  await db.exec(`insert into auth.users values('${admin}'),('${customer}'),('${other}');
    insert into profiles(id,email,role) values('${admin}','admin@example.test','admin'),('${customer}','customer@example.test','customer'),('${other}','other@example.test','customer');
    create table website_settings(id boolean primary key,free_shipping_threshold_cents integer,standard_shipping_cents integer);
    insert into website_settings values(true,7500,1000);
    alter table orders enable row level security; alter table order_items enable row level security; alter table profiles enable row level security;
    grant all on orders,order_items to anon,authenticated;
    grant update(status),insert(customer_id) on orders to authenticated;
    grant select on profiles to anon,authenticated;
    insert into products(name,slug,description,price_cents,image_url,inventory_quantity) values('Fixture','fixture','',1000,'/fixture.png',100);`)
  await db.exec(base.split('\n').filter(line => line.startsWith('create policy') && /on public.(profiles|orders|order_items) /.test(line)).join('\n'))
  for (const file of ['20260901120000_stripe_checkout.sql','20260901130000_manual_payment.sql','20260901160000_order_archiving.sql','20260903120000_safe_order_contract.sql','20260911190000_product_options.sql']) await db.exec(read(file))
  await db.exec(read('20260901170000_customer_account.sql'))
  await db.exec('grant select,insert,update,delete on customer_addresses to anon,authenticated;')
  await db.exec(read('20260918120000_checkout_authorization_boundary.sql'))
  await db.exec(`insert into orders(customer_id,status,payment_status,subtotal_cents,total_cents,shipping_address)
    values('${customer}','fulfilled','paid',1000,1000,'{}'),('${customer}','cancelled','cancelled',1000,1000,'{}');`)
  const before = (await db.query('select id,order_number,status from orders order by order_number')).rows
  await db.exec(read('20260923130000_order_references_and_fulfillment.sql'))
  await db.exec(read('20260903130000_order_notifications.sql'))
  await db.exec(read('20260924180000_shipping_and_shipments.sql'))
  const owner = () => db.exec('reset role')
  const user = async (id, role='authenticated') => { await owner(); await db.query("select set_config('test.uid',$1,false)",[id]); await db.exec(`set role ${role}`) }
  const inspect = async sql => { await owner(); return (await db.query(sql)).rows }
  const create = key => db.query(`select * from create_manual_order_with_reference('[{"product_id":1,"quantity":1,"selected_options":[]}]','{"country":"Canada"}','manual_email',$1)`,[key ?? randomUUID()])
  const advance = (id, from, to) => db.query('select advance_order_fulfillment($1,$2,$3)',[id,from,to])

  await user(customer)
  const placed=(await create()).rows[0]
  assert.equal(placed.shipping_cents,1000)
  let row=(await db.query('select * from orders where id=$1',[placed.order_id])).rows[0]
  assert.equal(row.shipping_method,'Standard Shipping')
  await owner(); await db.exec('update website_settings set standard_shipping_cents=2000,international_standard_shipping_cents=3500,international_free_shipping_threshold_cents=5000')
  assert.equal((await db.query('select shipping_cents from orders where id=$1',[placed.order_id])).rows[0].shipping_cents,1000)
  await user(customer)
  const international=async quantity=>db.query(`select * from create_manual_order_with_reference('[{"product_id":1,"quantity":${quantity},"selected_options":[]}]','{"country":"Nigeria","shipping_cents":0}','manual_email',$1)`,[randomUUID()])
  const foreign=(await international(1)).rows[0];assert.equal(foreign.shipping_cents,3500)
  assert.equal((await international(5)).rows[0].shipping_cents,0)
  assert.equal((await db.query('select shipping_method from orders where id=$1',[foreign.order_id])).rows[0].shipping_method,'International Shipping')
  await owner();await assert.rejects(db.exec('update website_settings set international_standard_shipping_cents=-1'),/check constraint/)
  await user(customer)
  const canadaFree=(await db.query(`select * from create_manual_order_with_reference('[{"product_id":1,"quantity":8,"selected_options":[]}]','{"country":"Canada"}','manual_email',$1)`,[randomUUID()])).rows[0];assert.equal(canadaFree.shipping_cents,0)
  for(const sql of ["update orders set shipment_carrier='Fake'","update orders set tracking_number='Fake'","update orders set shipping_cents=0"])await assert.rejects(db.exec(sql),/permission denied/)
  const ship=(from,to,carrier='',tracking='')=>db.query('select record_order_shipment($1,$2,$3,$4,$5)',[placed.order_id,from,to,carrier,tracking])
  await assert.rejects(ship('pending','processing'),/Administrator/)
  await user(admin);await assert.rejects(ship('pending','processing'),/Confirmed payment/)
  await db.query('select confirm_manual_payment($1)',[placed.order_id])
  await assert.rejects(ship('paid','shipped'),/Invalid fulfillment/)
  await ship('paid','processing');await assert.rejects(ship('processing','shipped','x'.repeat(121)),/Invalid shipment/)
  await ship('processing','shipped','Local delivery','REF-123')
  await assert.rejects(ship('processing','shipped'),/Order changed/)
  const claim=event=>db.query('select * from claim_order_notification($1,$2)',[placed.order_id,event])
  assert.equal((await claim('order_shipped')).rows[0].should_send,true)
  assert.equal((await claim('order_shipped')).rows[0].should_send,false)
  await assert.rejects(claim('order_delivered'),/Shipment status/)
  await ship('shipped','delivered');assert.equal((await claim('order_delivered')).rows[0].should_send,true)
  await assert.rejects(ship('delivered','processing'),/Invalid fulfillment/)
  await user(customer);row=(await db.query('select * from orders where id=$1',[placed.order_id])).rows[0]
  assert.equal(row.tracking_number,'REF-123');assert.equal(row.shipment_carrier,'Local delivery');assert.equal(row.shipping_cents,1000)
  await assert.rejects(claim('order_shipped'),/administrator/)
  await user(other);assert.equal((await db.query('select * from orders where id=$1',[placed.order_id])).rows.length,0)
  await user('','anon');assert.equal((await db.query('select * from orders where id=$1',[placed.order_id])).rows.length,0)
  await assert.rejects(ship('delivered','processing'),/permission denied/)
  await user(admin);await db.query('select confirm_manual_payment($1)',[foreign.order_id]);await advance(foreign.order_id,'paid','processing');await advance(foreign.order_id,'processing','shipped')
  assert.equal((await db.query('select tracking_number from orders where id=$1',[foreign.order_id])).rows[0].tracking_number,null)
})
