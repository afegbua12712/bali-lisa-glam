// Executes only in an ephemeral WASM PostgreSQL instance. No connection URLs,
// production data, Supabase credentials, filesystem database, or email calls.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const admin = '00000000-0000-4000-8000-000000000010'
const customer = '00000000-0000-4000-8000-000000000011'
const product = { name: 'Fixture', slug: 'fixture-options', description: '', price_cents: 1000, inventory_quantity: 20, category_id: null, image_url: '', is_active: true }
const group = (name, required = true) => ({ id: randomUUID(), name, required, display_order: 0, values: [{ id: randomUUID(), label: 'First', active: true, display_order: 0, color: null }] })

test('product option SQL contract in isolated PostgreSQL', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id', true), '')::uuid$$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`)
  const base = read('20260828160000_bali_lisa_glam.sql')
  await db.exec(base.slice(base.indexOf('create type public.app_role'), base.indexOf('create or replace function public.handle_new_user')))
  await db.exec(base.slice(base.indexOf('create or replace function public.is_admin()'), base.indexOf('create or replace function public.create_order(')))
  await db.exec(`insert into auth.users values ('${admin}'), ('${customer}');
    insert into public.profiles(id,email,role) values ('${admin}','','admin'),('${customer}','','customer');
    create table public.website_settings(id boolean primary key, free_shipping_threshold_cents integer, standard_shipping_cents integer,
      international_free_shipping_threshold_cents integer, international_standard_shipping_cents integer);
    insert into public.website_settings values(true,7500,1000,null,null);
    alter table public.orders add column payment_method text, add column payment_status text,
      add column payment_expires_at timestamptz, add column checkout_idempotency_key uuid, add column inventory_reservation_status text;
    create unique index on public.orders(customer_id, checkout_idempotency_key);
    alter table public.products enable row level security;
    create policy fixture_product_read on public.products for select using (is_active or public.is_admin());
    grant select on public.products to anon, authenticated;
    insert into public.products(name,slug,description,price_cents,image_url,inventory_quantity,shades)
      values ('Legacy fixture','legacy','','1000','',20,'["Rose", "Ruby"]'), ('Plain fixture','plain','',1000,'',20,'["Universal"]');
    insert into public.orders(customer_id,subtotal_cents,total_cents,shipping_address) values ('${customer}',1000,1000,'{}');
    insert into public.order_items(order_id,product_id,product_name,shade,unit_price_cents,quantity)
      select id,1,'Legacy fixture','Original historical shade',1000,1 from public.orders;`)
  // This is a test-only in-memory database, never a linked Supabase project.
  await db.exec(read('20260911190000_product_options.sql'))
  const safe = read('20260903120000_safe_order_contract.sql')
  await db.exec(safe.slice(safe.indexOf('create or replace function public.create_manual_order('), safe.indexOf('create or replace function public.confirm_manual_payment(')))
  // Reproduce the live broad grants, then apply only to this ephemeral database.
  const legacy = read('20260901130000_manual_payment.sql')
  await db.exec(legacy.slice(legacy.indexOf('create or replace function public.create_manual_order('), legacy.indexOf('create or replace function public.confirm_manual_payment(')))
  await db.exec(`alter table public.profiles add column phone text;
    alter table public.profiles enable row level security;
    grant select, update on public.profiles to anon, authenticated;
    grant update(role) on public.profiles to authenticated;
    grant all on public.profiles to service_role;
    grant execute on function public.create_order(jsonb,jsonb) to anon, authenticated, service_role;
    grant execute on function public.create_manual_order(jsonb,jsonb,text) to anon, authenticated;
    grant execute on function public.create_manual_order(jsonb,jsonb,text,uuid) to anon, authenticated;`)
  const policies = base.split('\n').filter(line => line.startsWith('create policy') && line.includes('on public.profiles')).join('\n')
  await db.exec(policies)
  const hardening = read('20260918120000_checkout_authorization_boundary.sql')
  await db.exec(hardening)
  await db.exec(hardening) // Safe reapplication must retain the same privileges.
  const user = async (id, role = 'authenticated') => {
    await db.exec('reset role')
    await db.query("select set_config('test.user_id', $1, false)", [id])
    await db.exec(`set role ${role}`)
  }
  const save = async (id, groups, changes = {}) => (await db.query('select public.save_product_with_options($1,$2::jsonb,$3::jsonb) as id', [id, JSON.stringify({ ...product, ...changes }), JSON.stringify(groups)])).rows[0].id
  const order = async (id, options, quantity = 1, key = randomUUID(), shade) => (await db.query('select * from public.create_manual_order($1::jsonb,$2::jsonb,$3,$4::uuid)', [JSON.stringify([{ product_id: id, quantity, selected_options: options, shade }]), '{"country":"Canada"}', 'manual_email', key])).rows[0]
  const inspect = async sql => { await db.exec('reset role'); return (await db.query(sql)).rows }
  const shade = group('Shade'), size = group('Size', false)
  size.display_order = 1
  const selections = [shade, size].map(g => ({ group_id: g.id, value_id: g.values[0].id, name: 'Forged', value: 'Forged' }))
  let id, created, snapshot
  await t.test('authorization boundary preserves profile editing and blocks browser role/helper access', async () => {
    for (const role of ['anon', 'authenticated']) {
      const [privileges] = await inspect(`select
        has_column_privilege('${role}', 'profiles', 'role', 'UPDATE') as role_update,
        has_function_privilege('${role}', 'create_order(jsonb,jsonb)', 'EXECUTE') as helper,
        has_function_privilege('${role}', 'create_manual_order(jsonb,jsonb,text)', 'EXECUTE') as legacy,
        has_function_privilege('${role}', 'create_manual_order(jsonb,jsonb,text,uuid)', 'EXECUTE') as checkout`)
      assert.deepEqual(privileges, { role_update: false, helper: false, legacy: false, checkout: role === 'authenticated' })
      await user(role === 'anon' ? '' : customer, role)
      await assert.rejects(db.query("select create_order('[]','{}')"), /permission denied/)
      await assert.rejects(db.query("select create_manual_order('[]','{}','manual_email')"), /permission denied/)
    }
    await user(customer)
    await db.query("update profiles set first_name='Fixture', last_name='Customer', phone='test', updated_at=now() where id=$1", [customer])
    await assert.rejects(db.query("update profiles set role='admin' where id=$1", [customer]), /permission denied/)
    await assert.rejects(db.query("update profiles set role='customer' where id=$1", [admin]), /permission denied/)
    await assert.rejects(db.query('update profiles set id=$1 where id=$2', [admin, customer]), /permission denied/)
    assert.equal((await db.query("update profiles set first_name='Wrong' where id=$1 returning id", [admin])).rows.length, 0)
    assert.equal((await db.query('select is_admin() as admin')).rows[0].admin, false)
    const [profile] = await inspect(`select first_name, role from profiles where id='${customer}'`)
    assert.deepEqual(profile, { first_name: 'Fixture', role: 'customer' })
    // Trusted owner maintenance still works; browser admin checks below remain real.
    await db.query("update profiles set role='admin' where id=$1", [customer])
    await db.query("update profiles set role='customer' where id=$1", [customer])
    const source = readFileSync(new URL('../src/lib/manual-payment.ts', import.meta.url), 'utf8')
    assert.match(source, /rpc\('create_manual_order'/)
    assert.match(source, /idempotency_key: idempotencyKey/)
  })
  await t.test('legacy backfill and historical rows preserved', async () => {
    assert.equal((await inspect('select * from product_option_groups')).length, 1)
    assert.equal((await inspect('select * from product_option_values')).length, 2)
    const [past] = await inspect('select shade, selected_options from order_items')
    assert.equal(past.shade, 'Original historical shade')
    assert.deepEqual(past.selected_options, [])
  })
  await t.test('only an authenticated admin may save options; direct writes and private resolver are denied', async () => {
    await user(customer)
    await assert.rejects(save(null, [shade]), /Administrator required/)
    await assert.rejects(db.query("insert into product_option_groups(product_id,name) values(1,'Bad')"), /permission denied/)
    await assert.rejects(db.query("select resolve_product_options(1,'[]',null)"), /permission denied/)
    await user('', 'anon')
    await assert.rejects(save(null, [shade]), /permission denied/)
    await user(admin)
    id = await save(null, [shade, size])
  })
  await t.test('missing required, forged, duplicate and cross-product selections roll back without orders or stock changes', async () => {
    const before = await inspect(`select (select count(*) from orders) as count, inventory_quantity from products where id=${id}`)
    await user(customer)
    for (const options of [[], [{ ...selections[0], value_id: randomUUID() }], [selections[0], selections[0]], [{ group_id: randomUUID(), value_id: randomUUID() }]]) {
      await assert.rejects(order(id, options), /Invalid product options/)
    }
    await assert.rejects(order(2, selections), /Invalid product options/)
    assert.deepEqual(await inspect(`select (select count(*) from orders) as count, inventory_quantity from products where id=${id}`), before)
  })
  await t.test('authoritative snapshots, totals, payment state and idempotency survive', async () => {
    await user(customer)
    const key = randomUUID()
    created = await order(id, selections, 2, key)
    const retry = await order(id, selections, 2, key)
    assert.equal(retry.order_id, created.order_id)
    assert.equal(retry.already_existed, true)
    assert.equal(created.subtotal_cents, 2000)
    assert.equal(created.shipping_cents, 1000)
    assert.equal(created.total_cents, 3000)
    const [line] = await inspect(`select shade, selected_options from order_items where order_id='${created.order_id}'`)
    assert.equal(line.shade, 'Shade: First · Size: First')
    assert.equal(line.selected_options[0].name, 'Shade')
    assert.equal(line.selected_options[0].value, 'First')
    snapshot = line
    assert.equal((await inspect(`select inventory_quantity from products where id=${id}`))[0].inventory_quantity, 18)
    assert.equal((await inspect(`select payment_status from orders where id='${created.order_id}'`))[0].payment_status, 'awaiting_payment')
  })
  await t.test('legacy shade bags and products without options continue to order', async () => {
    await user(customer)
    const legacy = await order(1, undefined, 1, randomUUID(), 'Rose')
    await order(2, [])
    assert.equal((await inspect(`select shade from order_items where order_id='${legacy.order_id}'`))[0].shade, 'Shade: Rose')
  })
  await t.test('stock is checked across all option combinations, and unavailable products remain blocked', async () => {
    await user(customer)
    const lines = [{ product_id: id, quantity: 10, selected_options: selections }, { product_id: id, quantity: 10, selected_options: selections.slice(0, 1) }]
    await assert.rejects(db.query("select * from create_manual_order($1::jsonb, '{\"country\":\"Canada\"}', 'manual_email', $2::uuid)", [JSON.stringify(lines), randomUUID()]), /Insufficient inventory/)
    assert.equal((await inspect(`select inventory_quantity from products where id=${id}`))[0].inventory_quantity, 18)
    await db.query('update products set is_active=false where id=$1', [id])
    await user('', 'anon')
    assert.equal((await db.query('select * from product_option_groups where product_id=$1', [id])).rows.length, 0)
    await user(customer)
    await assert.rejects(order(id, selections), /A product is unavailable/)
    await inspect(`update products set is_active=true where id=${id}`)
  })
  await t.test('inactive values are hidden publicly but visible to admin; stale carts rejected', async () => {
    await user(admin)
    size.values[0].active = false
    await save(id, [shade, size], { inventory_quantity: 18 })
    assert.equal((await db.query('select * from product_option_values where id=$1', [size.values[0].id])).rows.length, 1)
    await user(customer)
    assert.equal((await db.query('select * from product_option_values where id=$1', [size.values[0].id])).rows.length, 0)
    await assert.rejects(order(id, selections), /Invalid product options/)
    await order(id, selections.slice(0, 1))
  })
  await t.test('invalid editor payload and foreign IDs cannot partially update a product', async () => {
    await user(admin)
    const foreign = group('Other')
    const otherId = await save(null, [foreign], { slug: 'other' })
    await assert.rejects(save(id, [foreign], { name: 'Should roll back' }), /Invalid product options/)
    await assert.rejects(save(id, [{ ...shade, values: [] }]), /Invalid product options/)
    await assert.rejects(save(id, [shade, { ...size, values: [{ ...foreign.values[0] }] }]), /Invalid product options/)
    assert.equal((await inspect(`select name from products where id=${id}`))[0].name, 'Fixture')
    assert.equal((await inspect(`select count(*) as count from product_option_groups where product_id=${otherId}`))[0].count, 1)
  })
  await t.test('removing groups leaves historical snapshots readable and rejects stale IDs', async () => {
    await user(admin)
    await save(id, [], { inventory_quantity: 17 })
    assert.deepEqual((await inspect(`select shade, selected_options from order_items where order_id='${created.order_id}'`))[0], snapshot)
    await user(customer)
    await assert.rejects(order(id, selections), /Invalid product options/)
    await order(id, [])
  })
  await t.test('reserved products cannot be deleted; release is repeat-safe and paid snapshots survive deletion', async () => {
    await db.exec('reset role');
    await db.exec('alter table orders add column paid_at timestamptz, add column inventory_restored_at timestamptz, add column cancellation_reason text;');
    await db.exec(safe.slice(safe.indexOf('create or replace function public.confirm_manual_payment('), safe.indexOf('create or replace function public.prevent_reserved_order_deletion(')));
    await db.exec(read('20260918150000_protect_reserved_product_deletion.sql'));
    await db.exec(read('20260918150000_protect_reserved_product_deletion.sql'));
    await user(admin);
    const releaseProduct = await save(null, [], { slug: 'release-fixture', inventory_quantity: 5 });
    await user(customer);
    const reserved = await order(releaseProduct, [], 2);
    await assert.rejects(db.query('select cancel_unpaid_order($1)', [reserved.order_id]), /Administrator access required/);
    await assert.rejects(db.query('select confirm_manual_payment($1)', [reserved.order_id]), /Administrator access required/);
    await db.exec('reset role');
    await assert.rejects(db.query('delete from products where id=$1', [releaseProduct]), error => error.code === 'BLG01');
    await db.query('update products set is_active=false where id=$1', [releaseProduct]);
    await user(admin);
    await db.query('select cancel_unpaid_order($1)', [reserved.order_id]);
    await db.query('select cancel_unpaid_order($1)', [reserved.order_id]);
    assert.equal((await inspect('select inventory_quantity from products where id='+releaseProduct))[0].inventory_quantity, 5);
    await db.query('delete from products where id=$1', [releaseProduct]);
    const paidProduct = await save(null, [], { slug: 'paid-fixture', inventory_quantity: 5 });
    await user(customer);
    const paid = await order(paidProduct, [], 1);
    await user(admin);
    await db.query('select confirm_manual_payment($1)', [paid.order_id]);
    await assert.rejects(db.query('select cancel_unpaid_order($1)', [paid.order_id]), /Only an active unpaid reservation/);
    await db.exec('reset role');
    await db.query('delete from products where id=$1', [paidProduct]);
    const history = (await db.query('select product_id,product_name,unit_price_cents from order_items where order_id=$1', [paid.order_id])).rows[0];
    assert.deepEqual(history, { product_id: null, product_name: 'Fixture', unit_price_cents: 1000 });
  })

})
