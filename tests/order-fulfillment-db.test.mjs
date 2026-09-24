// Only an ephemeral PostgreSQL WASM database; never connects to production.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
const admin = '00000000-0000-4000-8000-000000000001', customer = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003'

test('persistent references and secure fulfillment against the existing order contract', async t => {
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
  const owner = () => db.exec('reset role')
  const user = async (id, role='authenticated') => { await owner(); await db.query("select set_config('test.uid',$1,false)",[id]); await db.exec(`set role ${role}`) }
  const inspect = async sql => { await owner(); return (await db.query(sql)).rows }
  const create = key => db.query(`select * from create_manual_order_with_reference('[{"product_id":1,"quantity":1,"selected_options":[]}]','{"country":"Canada"}','manual_email',$1)`,[key ?? randomUUID()])
  const advance = (id, from, to) => db.query('select advance_order_fulfillment($1,$2,$3)',[id,from,to])
  let order
  await t.test('deterministic backfill preserves UUIDs, numbering and unknown historical dates', async () => {
    const rows = await inspect('select id,order_number,status,order_reference,processing_at,shipped_at,delivered_at from orders order by order_number')
    rows.forEach((row,i) => { assert.deepEqual({id:row.id,order_number:row.order_number,status:row.status},before[i]); assert.equal(row.order_reference,`BL-${String(row.order_number).padStart(5,'0')}`); assert.equal(row.delivered_at,null); assert.equal(row.shipped_at,null); assert.equal(row.processing_at,null) })
    await assert.rejects(db.query('update orders set order_number=999 where id=$1',[rows[0].id]), /DEFAULT/)
    await assert.rejects(db.query('update orders set order_number=DEFAULT where id=$1',[rows[0].id]), /permanent/)
    await assert.rejects(db.query('update orders set id=$1 where id=$2',[randomUUID(),rows[0].id]), /permanent/)
    await assert.rejects(db.query("update orders set order_reference='BL-99999'"), /DEFAULT/)
  })
  await t.test('identity allocation is unique, expands past five digits, and retries reserve stock once', async () => {
    await owner(); await db.exec('alter table orders alter column order_number restart with 99999')
    await user(customer)
    const key=randomUUID(); order=(await create(key)).rows[0]
    assert.equal(order.order_reference,'BL-99999')
    const retry=(await create(key)).rows[0]; assert.equal(retry.order_reference,order.order_reference); assert.equal(retry.order_id,order.order_id); assert.equal(retry.already_existed,true)
    const replies=await Promise.all(Array.from({length:5},()=>create()))
    const refs=replies.map(r=>r.rows[0].order_reference)
    assert.equal(new Set(refs).size,5); assert.equal(refs[0],'BL-100000')
    assert.equal((await inspect('select inventory_quantity from products where id=1'))[0].inventory_quantity,94)
    // PGlite serializes requests. The actual concurrency primitive is the
    // pre-existing PostgreSQL identity sequence, backed by both unique keys.
    const [identity]=await inspect("select is_identity,identity_generation from information_schema.columns where table_name='orders' and column_name='order_number'")
    assert.deepEqual(identity,{is_identity:'YES',identity_generation:'ALWAYS'})
  })
  await t.test('browser grants, ownership RLS and admin RPC authorization reject customer writes',async()=>{
    await user(customer)
    for(const sql of ["update orders set status='delivered'",'update orders set delivered_at=now()',"update orders set payment_status='paid'",`insert into orders(customer_id,subtotal_cents,total_cents,shipping_address) values('${customer}',0,0,'{}')`]) await assert.rejects(db.exec(sql),/permission denied/)
    await assert.rejects(advance(order.order_id,'pending','processing'),/Administrator required/)
    await user(other); assert.equal((await db.query('select * from orders where id=$1',[order.order_id])).rows.length,0)
    await assert.rejects(advance(order.order_id,'pending','processing'),/Administrator required/)
    await user('','anon'); await assert.rejects(advance(order.order_id,'pending','processing'),/permission denied/); await assert.rejects(create(),/permission denied/)
    await user(admin); await assert.rejects(db.exec("update orders set status='processing'"),/permission denied/)
    await db.query('update orders set archived_at=now() where id=$1',[order.order_id]); await db.query('update orders set archived_at=null where id=$1',[order.order_id])
  })
  await t.test('unpaid and skipped transitions fail, payment confirmation retains its reservation behavior',async()=>{
    await user(admin)
    for(const next of ['processing','shipped','delivered']) await assert.rejects(advance(order.order_id,'pending',next),/Confirmed payment/)
    await db.query('select confirm_manual_payment($1)',[order.order_id])
    await assert.rejects(db.query('select confirm_manual_payment($1)',[order.order_id]),/not an active unpaid/)
    for(const next of ['shipped','delivered','paid',null]) await assert.rejects(advance(order.order_id,'paid',next),/Invalid fulfillment/)
  })
  await t.test('ordered progression sets timestamps without changing items, money, reference or inventory',async()=>{
    const snapshot=async()=>({orders:await inspect(`select id,order_reference,customer_id,payment_status,paid_at,inventory_reservation_status,total_cents,subtotal_cents,shipping_cents,shipping_address from orders where id='${order.order_id}'`),items:await inspect('select * from order_items order by id'),stock:await inspect('select id,inventory_quantity from products order by id')})
    const original=await snapshot()
    for(const [from,to] of [['paid','processing'],['processing','shipped'],['shipped','delivered']]) {
      await user(admin); await advance(order.order_id,from,to)
      await assert.rejects(advance(order.order_id,from,to),/Order changed/)
    }
    assert.deepEqual(await snapshot(),original)
    await user(admin); await assert.rejects(advance(order.order_id,'delivered','processing'),/Invalid fulfillment/)
    await user('','anon'); await user(customer)
    const current=(await db.query('select * from orders where id=$1',[order.order_id])).rows[0]
    assert.equal(current.status,'delivered'); assert.equal(current.order_reference,order.order_reference)
    assert.ok(current.processing_at >= current.paid_at); assert.ok(current.shipped_at >= current.processing_at); assert.ok(current.delivered_at >= current.shipped_at)
    await user(admin); assert.equal((await db.query('select status from orders where id=$1',[order.order_id])).rows[0].status,current.status)
  })
  await t.test('unpaid cancellation restores stock exactly once; legacy completion cannot restart',async()=>{
    await user(customer); const pending=(await create()).rows[0]
    const stock=(await inspect('select inventory_quantity from products'))[0].inventory_quantity
    await user(admin); await db.query('select cancel_unpaid_order($1)',[pending.order_id]); await db.query('select cancel_unpaid_order($1)',[pending.order_id])
    await assert.rejects(advance(pending.order_id,'cancelled','processing'),/Confirmed payment/)
    await assert.rejects(advance(before[0].id,'fulfilled','processing'),/Invalid fulfillment/)
    assert.equal((await inspect('select inventory_quantity from products'))[0].inventory_quantity,stock+1)
  })
  await t.test('saved addresses are owner-only and changing them leaves order snapshots untouched',async()=>{
    const put=id=>db.query(`insert into customer_addresses(customer_id,first_name,last_name,address,city,province,postal_code,country)
      values($1,'Test','Customer','1 Original Street','Toronto','Ontario','M5V 2T6','Canada')
      on conflict(customer_id) do update set address=excluded.address`,[id])
    await user(customer);await put(customer)
    const saved=(await db.query('select * from customer_addresses')).rows
    assert.equal(saved.length,1);assert.equal(saved[0].customer_id,customer)
    const placed=(await db.query(`select * from create_manual_order_with_reference('[{"product_id":1,"quantity":1,"selected_options":[]}]',$1::jsonb,'manual_email',$2)`,[JSON.stringify(saved[0]),randomUUID()])).rows[0]
    await db.query("update customer_addresses set address='2 Updated Street' where customer_id=$1",[customer])
    assert.equal((await db.query('select address from customer_addresses')).rows[0].address,'2 Updated Street')
    assert.equal((await db.query('select shipping_address from orders where id=$1',[placed.order_id])).rows[0].shipping_address.address,'1 Original Street')
    await assert.rejects(db.exec("update profiles set role='admin'"),/permission denied/)
    await user(other)
    assert.equal((await db.query('select * from customer_addresses where customer_id=$1',[customer])).rows.length,0)
    assert.equal((await db.query("update customer_addresses set address='Intrusion' where customer_id=$1 returning *",[customer])).rows.length,0)
    await assert.rejects(put(customer),/row-level security/)
    await put(other)
    await assert.rejects(db.query('update customer_addresses set customer_id=$1',[customer]),/row-level security/)
    await user('','anon')
    assert.equal((await db.query('select * from customer_addresses')).rows.length,0)
    await assert.rejects(put(customer),/row-level security/)
    await user(admin);assert.equal((await db.query('select * from customer_addresses')).rows.length,2)
  })
  await t.test('account profile and nested order-item reads stay private without weakening permitted profile updates',async()=>{
    await user(customer)
    assert.deepEqual((await db.query('select id from profiles')).rows,[{id:customer}])
    await db.query("update profiles set first_name='Updated',last_name='Customer',phone='1234567890' where id=$1",[customer])
    assert.equal((await db.query('select first_name from profiles')).rows[0].first_name,'Updated')
    assert.equal((await db.query("update profiles set first_name='Forbidden' where id=$1 returning id",[other])).rows.length,0)
    await assert.rejects(db.exec("update profiles set role='admin'"),/permission denied/)
    const ownedItems=(await db.query('select * from order_items')).rows
    assert.ok(ownedItems.length>0)
    await user(other)
    assert.deepEqual((await db.query('select id from profiles')).rows,[{id:other}])
    assert.equal((await db.query('select * from orders')).rows.length,0)
    assert.equal((await db.query('select * from order_items')).rows.length,0)
    await user('','anon')
    assert.equal((await db.query('select * from profiles')).rows.length,0)
    assert.equal((await db.query('select * from orders')).rows.length,0)
    assert.equal((await db.query('select * from order_items')).rows.length,0)
  })
  await t.test('wishlist ownership, uniqueness and cascading catalog deletion use existing RLS', async()=>{
    await owner()
    await db.exec('grant select,insert,update,delete on wishlists to authenticated,anon;')
    await user(customer)
    await db.query('insert into wishlists(customer_id,product_id) values($1,1)',[customer])
    await assert.rejects(db.query('insert into wishlists(customer_id,product_id) values($1,1)',[customer]),/duplicate key/)
    await assert.rejects(db.query('insert into wishlists(customer_id,product_id) values($1,1)',[other]),/row-level security/)
    await assert.rejects(db.query('update wishlists set customer_id=$1',[other]),/row-level security/)
    await user(other)
    assert.equal((await db.query('select * from wishlists')).rows.length,0)
    assert.equal((await db.query('delete from wishlists where customer_id=$1 returning *',[customer])).rows.length,0)
    await db.query('insert into wishlists(customer_id,product_id) values($1,1)',[other])
    await user('','anon')
    assert.equal((await db.query('select * from wishlists')).rows.length,0)
    await assert.rejects(db.query('insert into wishlists(customer_id,product_id) values($1,1)',[customer]),/row-level security/)
    assert.equal((await db.query('delete from wishlists returning *')).rows.length,0)
    await user(customer)
    assert.equal((await db.query('delete from wishlists where customer_id=$1 and product_id=1 returning *',[customer])).rows.length,1)
    await user(other)
    assert.equal((await db.query('select * from wishlists')).rows.length,1)
    await user(admin)
    assert.equal((await db.query('select * from wishlists')).rows.length,1)
    await owner()
    const product=(await db.query("insert into products(name,slug,description,price_cents,image_url,inventory_quantity) values('Temporary fixture','wishlist-fixture','',100,'/fixture.png',1) returning id")).rows[0]
    await user(customer)
    await db.query('insert into wishlists(customer_id,product_id) values($1,$2)',[customer,product.id])
    await owner();await db.query('update products set is_active=false where id=$1',[product.id])
    await user(customer);assert.equal((await db.query('select * from wishlists')).rows.length,1)
    await owner();await db.query('delete from products where id=$1',[product.id])
    await user(customer);assert.equal((await db.query('select * from wishlists')).rows.length,0)
  })

})
