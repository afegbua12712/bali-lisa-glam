// Only ephemeral in-memory PostgreSQL. Never connects to Supabase.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
const read = file => readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
const admin = '00000000-0000-4000-8000-000000000001', customer = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003'
test('gallery and review authorization contracts in isolated PostgreSQL', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;`)
  const base = read('20260828160000_bali_lisa_glam.sql')
  await db.exec(base.slice(base.indexOf('create type public.app_role'), base.indexOf('create or replace function public.handle_new_user')))
  await db.exec(base.slice(base.indexOf('create or replace function public.is_admin()'), base.indexOf('create or replace function public.create_order(')))
  await db.exec(`insert into auth.users values('${admin}'),('${customer}'),('${other}');
    insert into profiles(id,email,role) values('${admin}','admin@example.test','admin'),('${customer}','customer@example.test','customer'),('${other}','other@example.test','customer');
    alter table products enable row level security;
    create policy product_read on products for select using(is_active or public.is_admin());
    grant select on products to anon,authenticated;
    insert into products(name,slug,description,price_cents,image_url,shades) values('Original','original','Fixture',1000,'https://example.test/original.png','["Rose","Nude"]'),('Other','other','Fixture',1000,'https://example.test/other.png','["Universal"]');`)
  await db.exec(read('20260911190000_product_options.sql'))
  await db.exec(read('20260918180000_product_galleries_and_reviews.sql'))
  const user = async (uid, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('test.uid',$1,false)",[uid]); await db.exec(`set role ${role}`) }
  const owner = async () => db.exec('reset role')
  const inspect = async sql => { await owner(); return (await db.query(sql)).rows }
  const data = { name:'Original',slug:'original',price_cents:1000,inventory_quantity:5,image_url:'https://example.test/original.png',description:'',is_active:true }
  const [g] = await inspect('select id from product_option_groups where product_id=1')
  const vals = await inspect('select id,label,display_order,active,color from product_option_values order by display_order')
  const groups = [{...g,name:'Shade',required:true,display_order:0,values:vals}]
  const original = (await inspect('select * from product_images where product_id=1'))[0]
  const foreign = (await inspect('select * from product_images where product_id=2'))[0]
  const image = {id:randomUUID(),url:'https://example.test/rose.png',alt_text:'Rose',option_value_id:vals[0].id}
  const save = (images, opts=groups) => db.query('select save_product_with_gallery(1,$1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(data),JSON.stringify(opts),JSON.stringify(images)])
  await t.test('legacy image backfill, atomic primary/order/association and safe removal', async () => {
    assert.equal(original.url,data.image_url)
    await user(admin); await save([image,original])
    assert.equal((await db.query('select image_url from products where id=1')).rows[0].image_url,image.url)
    assert.deepEqual((await db.query('select id from product_images where product_id=1 order by display_order')).rows.map(r=>r.id),[image.id,original.id])
    await save([original,image]); assert.equal((await db.query('select image_url from products where id=1')).rows[0].image_url,original.url)
    await save([image]); assert.equal((await db.query('select count(*)::int n from product_images where product_id=1')).rows[0].n,1)
    assert.equal((await db.query('select count(*)::int n from product_images where product_id=2')).rows[0].n,1)
  })
  await t.test('gallery writes reject customers, foreign IDs/options and malformed batches atomically',async()=>{
    await user(customer); await assert.rejects(save([image]),/Administrator required/)
    await assert.rejects(db.query('delete from product_images'),/permission denied/)
    await user(admin)
    await assert.rejects(save([foreign]),/Invalid product gallery/)
    await assert.rejects(save([image,image]),/Invalid product gallery/)
    await assert.rejects(save([]),/Invalid product gallery/)
    await assert.rejects(save([{...image,url:'javascript:alert(1)'}]),/Invalid product gallery/)
    await assert.rejects(save([{...image,option_value_id:randomUUID()}]),/Invalid image option association/)
    assert.equal((await db.query('select image_url from products where id=1')).rows[0].image_url,image.url)
    assert.equal((await db.query('select inventory_quantity from products where id=1')).rows[0].inventory_quantity,5)
    // Removed option values lose only their photo association, not the photo.
    await save([{...image,option_value_id:null}],[])
    assert.equal((await db.query('select option_value_id from product_images where id=$1',[image.id])).rows[0].option_value_id,null)
  })
  let reviewId, stamp
  await t.test('anonymous submission denied; ownership is server-derived and one row is retained',async()=>{
    await user('','anon'); await assert.rejects(db.query("select submit_product_review(1,5,'A lovely fixture review')"),/permission denied/)
    await user(customer)
    reviewId=(await db.query("select submit_product_review(1,5,'A lovely fixture review') id")).rows[0].id
    assert.equal((await db.query("select submit_product_review(1,4,'My updated fixture review') id")).rows[0].id,reviewId)
    await assert.rejects(db.query("select submit_product_review(1,6,'Invalid star fixture review')"),/Invalid review/)
    await assert.rejects(db.query("select submit_product_review(1,5,'short')"),/Invalid review/)
    await assert.rejects(db.query(`insert into product_reviews(product_id,customer_id,rating,body,status) values(1,'${other}',5,'Impersonation attempt','approved')`),/permission denied/)
    await assert.rejects(db.query("update product_reviews set status='approved'"),/permission denied/)
    await assert.rejects(db.query('delete from product_reviews'),/permission denied/)
    assert.equal((await db.query('select * from my_product_review(1)')).rows[0].status,'pending')
    await user(other); assert.equal((await db.query('select * from my_product_review(1)')).rows.length,0)
    const [row]=await inspect('select customer_id,count(*) over()::int n from product_reviews');assert.equal(row.customer_id,customer);assert.equal(row.n,1)
  })
  await t.test('pending/rejected reviews and owner IDs are private; moderation is admin-only',async()=>{
    await user('','anon');assert.equal((await db.query('select id,rating,body from product_reviews')).rows.length,0)
    assert.equal((await db.query('select * from product_review_stats()')).rows.length,0)
    await assert.rejects(db.query('select customer_id from product_reviews'),/permission denied/)
    await user(customer);await assert.rejects(db.query('select * from admin_product_reviews()'),/Administrator required/)
    await assert.rejects(db.query("select moderate_product_review($1,'approved',now())",[reviewId]),/Administrator required/)
    await user(admin);stamp=(await db.query('select * from admin_product_reviews()')).rows[0].updated_at
    await db.query("select moderate_product_review($1,'rejected',$2)",[reviewId,stamp])
    await user('','anon');assert.equal((await db.query('select id from product_reviews')).rows.length,0)
    assert.equal((await db.query('select * from product_review_stats()')).rows.length,0)
  })
  await t.test('only approved ratings count, edits reset moderation, stale decisions fail',async()=>{
    await user(admin);stamp=(await db.query('select * from admin_product_reviews()')).rows[0].updated_at
    await db.query("select moderate_product_review($1,'approved',$2)",[reviewId,stamp])
    await user('','anon');assert.equal((await db.query('select id from product_reviews')).rows.length,1)
    let stats=(await db.query('select * from product_review_stats()')).rows[0];assert.equal(Number(stats.average_rating),4);assert.equal(Number(stats.review_count),1)
    await user(admin);stamp=(await db.query('select * from admin_product_reviews()')).rows[0].updated_at
    await user(customer);await db.query("select submit_product_review(1,1,'Changed after moderation loaded')")
    await user(admin);await assert.rejects(db.query("select moderate_product_review($1,'approved',$2)",[reviewId,stamp]),/Review changed/)
    await user('','anon');assert.equal((await db.query('select * from product_review_stats()')).rows.length,0)
    await user(admin);stamp=(await db.query('select * from admin_product_reviews()')).rows[0].updated_at
    await db.query("select moderate_product_review($1,'approved',$2)",[reviewId,stamp])
    await user(other);await db.query("select submit_product_review(1,5,'Second pending fixture review')")
    await user('','anon');stats=(await db.query('select * from product_review_stats()')).rows[0];assert.equal(Number(stats.average_rating),1);assert.equal(Number(stats.review_count),1)
    await user(admin);stamp=(await db.query('select * from admin_product_reviews()')).rows.find(r=>r.id===reviewId).updated_at
    await db.query("select moderate_product_review($1,'remove',$2)",[reviewId,stamp])
    await user('','anon');assert.equal((await db.query('select * from product_review_stats()')).rows.length,0)
    const state=await inspect("select relrowsecurity from pg_class where oid in ('product_reviews'::regclass,'product_images'::regclass)");assert.ok(state.every(row=>row.relrowsecurity))
  })
  await t.test('inactive products hide galleries, approved reviews and statistics from visitors', async () => {
    await user(admin)
    const pending = (await db.query('select * from admin_product_reviews()')).rows[0]
    await db.query("select moderate_product_review($1,'approved',$2)", [pending.id, pending.updated_at])
    await owner(); await db.exec('update products set is_active=false where id=1')
    await user('', 'anon')
    assert.equal((await db.query('select id from product_images where product_id=1')).rows.length, 0)
    assert.equal((await db.query('select id from product_reviews where product_id=1')).rows.length, 0)
    assert.equal((await db.query('select * from product_review_stats()')).rows.length, 0)
    await user(customer)
    await assert.rejects(db.query("select submit_product_review(1,5,'Unavailable product review')"), /unavailable/)
    await user(admin)
    assert.equal((await db.query('select id from product_images where product_id=1')).rows.length, 1)
    assert.equal((await db.query('select * from admin_product_reviews()')).rows.length, 1)
  })
})
