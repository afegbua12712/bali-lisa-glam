-- Phase 7: reviewed against actual production metadata, 2026-09-24.
-- LOCAL PROPOSAL ONLY. Run docs/launch-security-preflight.sql and review drift first.
-- No order data, settings values, RLS policies or service_role grants are changed.
begin;

-- Whole-table privileges are outside RLS. No browser workflow needs these.
revoke truncate, references, trigger, maintain on public.order_items, public.categories, public.products, public.profiles, public.customer_addresses, public.wishlists, public.website_settings, public.orders, public.order_notifications, public.product_option_groups, public.product_option_values, public.product_images, public.product_reviews from public, anon, authenticated;
-- Anonymous callers only need the public catalog/settings/review projection.
revoke all on public.profiles, public.customer_addresses, public.wishlists,
  public.orders, public.order_items, public.order_notifications from anon;
revoke insert, update, delete on public.categories, public.products, public.website_settings from anon;
-- Internal writes use trusted RPCs; archive/restore remain explicit browser columns.
revoke insert, update, delete on public.order_items, public.order_notifications, public.categories from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update on public.products from authenticated;
grant update(is_active, updated_at) on public.products to authenticated;
revoke delete on public.website_settings from authenticated;
revoke update on public.wishlists from authenticated;
-- Profile contact columns, order archived_at, ownership RLS and public review columns stay intact.
revoke all on sequence public.categories_id_seq, public.products_id_seq,
  public.orders_order_number_seq, public.order_items_id_seq from public, anon, authenticated;
-- Future postgres-owned application objects require explicit grants in their migration.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
-- Function PUBLIC defaults are global, not schema-local; future RPC migrations
-- must keep explicit EXECUTE allowlists. Do not alter managed-schema defaults here.

revoke execute on function public.confirm_manual_payment(uuid), public.cancel_unpaid_order(uuid,text) from public, anon;
grant execute on function public.confirm_manual_payment(uuid), public.cancel_unpaid_order(uuid,text) to authenticated;
revoke execute on function public.handle_new_user(), public.prevent_reserved_order_deletion() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_order(lines jsonb, shipping_address jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_order_id uuid;
  subtotal integer := 0;
  shipping integer;
  destination_country text;
  free_shipping_threshold integer;
  standard_shipping integer;
  requested record;
  line jsonb;
  snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(lines) is distinct from 'array' then raise exception 'Order needs at least one item'; end if;
  if jsonb_array_length(lines) not between 1 and 500 then
    raise exception 'Order needs at least one item';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)
    where product_id is null or quantity is null or quantity < 1
  ) then raise exception 'Invalid order line'; end if;

  destination_country := nullif(trim(shipping_address ->> 'country'), '');
  if destination_country is null then raise exception 'Delivery country is required'; end if;

  if lower(destination_country) = 'canada' then
    select free_shipping_threshold_cents, standard_shipping_cents
      into free_shipping_threshold, standard_shipping
    from public.website_settings where id = true;
  else
    select international_free_shipping_threshold_cents, international_standard_shipping_cents
      into free_shipping_threshold, standard_shipping
    from public.website_settings where id = true;
  end if;
  if not found then raise exception 'Store shipping settings are not configured'; end if;
  if standard_shipping is null then
    raise exception 'Shipping is not configured for the selected destination country';
  end if;

  for requested in
    select p.id, p.name, p.price_cents, p.inventory_quantity, r.quantity
    from public.products p
    join (
      select product_id, sum(quantity)::integer as quantity
      from jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)
      group by product_id
    ) r on r.product_id = p.id
    where p.is_active
    order by p.id
    for update of p
  loop
    if requested.inventory_quantity < requested.quantity then
      raise exception 'Insufficient inventory for %', requested.name;
    end if;
    subtotal := subtotal + requested.price_cents * requested.quantity;
  end loop;

  if (select count(distinct p.id)
      from public.products p
      join jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)
        on p.id = x.product_id
      where p.is_active)
     <> (select count(distinct product_id)
         from jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)) then
    raise exception 'A product is unavailable';
  end if;

  shipping := case
    when free_shipping_threshold is not null and subtotal >= free_shipping_threshold then 0
    else standard_shipping
  end;
  insert into public.orders(customer_id, currency, subtotal_cents, shipping_cents, total_cents, shipping_address)
  values (auth.uid(), 'CAD', subtotal, shipping, subtotal + shipping, coalesce(shipping_address, '{}'::jsonb))
  returning id into new_order_id;

  for line in select * from jsonb_array_elements(lines) loop
    snapshot := public.resolve_product_options((line->>'product_id')::bigint, line->'selected_options', line->>'shade');
    insert into public.order_items(order_id, product_id, product_name, shade, unit_price_cents, quantity, selected_options)
    select new_order_id, p.id, p.name,
      (select string_agg((x->>'name') || ': ' || (x->>'value'), ' · ' order by position)
       from jsonb_array_elements(snapshot) with ordinality s(x, position)),
      p.price_cents, (line->>'quantity')::integer, snapshot
    from public.products p where p.id = (line->>'product_id')::bigint;
  end loop;

  update public.products p
  set inventory_quantity = p.inventory_quantity - r.quantity, updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)
    group by product_id
  ) r
  where p.id = r.product_id;

  return new_order_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.create_manual_order(lines jsonb, shipping_address jsonb, selected_payment_method text, idempotency_key uuid)
 RETURNS TABLE(order_id uuid, order_number bigint, subtotal_cents integer, shipping_cents integer, total_cents integer, currency text, payment_expires_at timestamp with time zone, already_existed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  created_order_id uuid;
  target_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if idempotency_key is null then raise exception 'Checkout idempotency key is required'; end if;
  if selected_payment_method is null or selected_payment_method not in ('manual_whatsapp','manual_email') then
    raise exception 'Unsupported payment method';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || idempotency_key::text, 0));
  select * into target_order from public.orders
  where customer_id = auth.uid() and checkout_idempotency_key = idempotency_key;

  if found then
    return query select target_order.id, target_order.order_number,
      target_order.subtotal_cents, target_order.shipping_cents, target_order.total_cents,
      target_order.currency, target_order.payment_expires_at, true;
    return;
  end if;

  created_order_id := public.create_order(lines, shipping_address);
  update public.orders
  set payment_method = selected_payment_method,
      payment_status = 'awaiting_payment', status = 'pending',
      checkout_idempotency_key = idempotency_key,
      payment_expires_at = now() + interval '48 hours',
      inventory_reservation_status = 'reserved', updated_at = now()
  where id = created_order_id
  returning * into target_order;

  return query select target_order.id, target_order.order_number,
    target_order.subtotal_cents, target_order.shipping_cents, target_order.total_cents,
    target_order.currency, target_order.payment_expires_at, false;
end; $function$
;

CREATE OR REPLACE FUNCTION public.claim_order_notification(target_order_id uuid, target_event_type text)
 RETURNS TABLE(notification_id uuid, should_send boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_order public.orders%rowtype;
  target_notification public.order_notifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_event_type is null or target_event_type not in ('order_created', 'payment_confirmed', 'order_shipped', 'order_delivered') then
    raise exception 'Unsupported notification event';
  end if;

  select * into target_order from public.orders where id = target_order_id;
  if not found then raise exception 'Order not found'; end if;

  if target_event_type = 'order_created'
     and target_order.customer_id <> auth.uid()
     and not public.is_admin() then
    raise exception 'Order ownership required';
  end if;
  if target_event_type = 'payment_confirmed'
     and (not public.is_admin() or target_order.payment_status <> 'paid') then
    raise exception 'Paid order and administrator access required';
  end if;

  if target_event_type in ('order_shipped','order_delivered') and (
    not coalesce(public.is_admin(),false) or target_order.payment_status <> 'paid' or
    (target_event_type = 'order_shipped' and target_order.status::text not in ('shipped','delivered')) or
    (target_event_type = 'order_delivered' and target_order.status::text <> 'delivered')
  ) then raise exception 'Shipment status and administrator access required'; end if;

  insert into public.order_notifications(order_id, event_type)
  values (target_order_id, target_event_type)
  on conflict (order_id, event_type) do nothing;

  select * into target_notification
  from public.order_notifications
  where order_id = target_order_id and event_type = target_event_type
  for update;

  -- Ambiguous attempts require operator review, never automatic retries.
  if (
    target_notification.sent_at is not null or target_notification.provider_message_id is not null or
    target_notification.status = 'sending' or
    (target_notification.status = 'failed' and not (
      coalesce(target_notification.last_error,'') in ('Authoritative order data is unavailable','Order payment is not confirmed','Stored order email is unavailable') or
      coalesce(target_notification.last_error,'') ~ '^Email provider returned HTTP (400|401|403|404|405|413|415|422|429)$'
    ))
  ) then return query select target_notification.id, false; return; end if;
  if target_notification.status = 'sent'
     or (target_notification.status = 'sending'
         and target_notification.last_attempt_at > now() - interval '5 minutes') then
    return query select target_notification.id, false;
    return;
  end if;

  update public.order_notifications
  set status = 'sending', attempt_count = attempt_count + 1,
      last_attempt_at = now(), last_error = null, updated_at = now()
  where id = target_notification.id;

  return query select target_notification.id, true;
end; $function$
;

-- Optimistic stock check: a stale editor must never undo a new reservation.
CREATE OR REPLACE FUNCTION public.save_product_with_options(target_product_id bigint, product_data jsonb, option_groups jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare saved_id bigint; g jsonb; v jsonb; gid uuid; vid uuid; legacy_shades jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then raise exception 'Administrator required'; end if;
  if option_groups is null or jsonb_typeof(option_groups) <> 'array' then raise exception 'Invalid product options'; end if;
  if jsonb_array_length(option_groups) > 20 then raise exception 'Invalid product options'; end if;
  if (select count(*) <> count(distinct lower(trim(x->>'name'))) or count(*) <> count(distinct x->>'id') from jsonb_array_elements(option_groups) x) then
    raise exception 'Invalid product options';
  end if;
  for g in select * from jsonb_array_elements(option_groups) loop
    if g->>'id' is null or coalesce(length(trim(g->>'name')), 0) not between 1 and 80
       or jsonb_typeof(g->'required') is distinct from 'boolean'
       or jsonb_typeof(g->'values') is distinct from 'array' then raise exception 'Invalid product options'; end if;
    if jsonb_array_length(g->'values') > 100 then raise exception 'Invalid product options'; end if;
    if (select count(*) <> count(distinct lower(trim(x->>'label'))) or count(*) <> count(distinct x->>'id') from jsonb_array_elements(g->'values') x) then
      raise exception 'Invalid product options';
    end if;
    if (g->>'required')::boolean and not exists (select 1 from jsonb_array_elements(g->'values') x where x->>'active' = 'true') then
      raise exception 'Invalid product options';
    end if;
    for v in select * from jsonb_array_elements(g->'values') loop
      if v->>'id' is null or coalesce(length(trim(v->>'label')), 0) not between 1 and 100
         or jsonb_typeof(v->'active') is distinct from 'boolean'
         or (nullif(v->>'color', '') is not null and v->>'color' !~ '^#[0-9A-Fa-f]{6}$') then
        raise exception 'Invalid product options';
      end if;
    end loop;
  end loop;

  if target_product_id is null then
    insert into public.products(name, slug, description, price_cents, inventory_quantity, category_id, image_url, is_active, shades)
    values (trim(product_data->>'name'), trim(product_data->>'slug'), trim(product_data->>'description'),
      (product_data->>'price_cents')::integer, (product_data->>'inventory_quantity')::integer,
      (product_data->>'category_id')::bigint, trim(product_data->>'image_url'), (product_data->>'is_active')::boolean, '["Universal"]') returning id into saved_id;
  else
    update public.products set name = trim(product_data->>'name'), slug = trim(product_data->>'slug'),
      description = trim(product_data->>'description'), price_cents = (product_data->>'price_cents')::integer,
      inventory_quantity = (product_data->>'inventory_quantity')::integer, category_id = (product_data->>'category_id')::bigint,
      image_url = trim(product_data->>'image_url'), is_active = (product_data->>'is_active')::boolean, updated_at = now()
    where id = target_product_id and inventory_quantity = (product_data->>'expected_inventory_quantity')::integer returning id into saved_id;
    if not found then raise exception 'Product stock changed; refresh before saving'; end if;
  end if;
  for g in select * from jsonb_array_elements(option_groups) loop
    gid := (g->>'id')::uuid;
    insert into public.product_option_groups(id, product_id, name, display_order, required)
    values (gid, saved_id, trim(g->>'name'), (g->>'display_order')::integer, (g->>'required')::boolean)
    on conflict (id) do update set name = excluded.name, display_order = excluded.display_order, required = excluded.required
      where product_option_groups.product_id = saved_id;
    if not found then raise exception 'Invalid product options'; end if;
    for v in select * from jsonb_array_elements(g->'values') loop
      vid := (v->>'id')::uuid;
      insert into public.product_option_values(id, option_group_id, label, display_order, active, color)
      values (vid, gid, trim(v->>'label'), (v->>'display_order')::integer, (v->>'active')::boolean, nullif(v->>'color', ''))
      on conflict (id) do update set label = excluded.label, display_order = excluded.display_order, active = excluded.active, color = excluded.color
        where product_option_values.option_group_id = gid;
      if not found then raise exception 'Invalid product options'; end if;
    end loop;
    delete from public.product_option_values where option_group_id = gid
      and id not in (select (x->>'id')::uuid from jsonb_array_elements(g->'values') x);
  end loop;
  delete from public.product_option_groups where product_id = saved_id
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(option_groups) x);
  select jsonb_agg(v.label order by v.display_order, v.id) into legacy_shades
    from public.product_option_groups g join public.product_option_values v on v.option_group_id = g.id
    where g.product_id = saved_id and lower(g.name) = 'shade' and v.active;
  update public.products set shades = coalesce(legacy_shades, '["Universal"]'::jsonb) where id = saved_id;
  return saved_id;
end $function$
;

-- Explicit pg_temp placement prevents temporary relation shadowing.
alter function public.handle_new_user() set search_path = pg_catalog, public, pg_temp;
alter function public.is_admin() set search_path = pg_catalog, public, pg_temp;
alter function public.confirm_manual_payment(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.prevent_reserved_order_deletion() set search_path = pg_catalog, public, pg_temp;
alter function public.cancel_unpaid_order(uuid,text) set search_path = pg_catalog, public, pg_temp;
alter function public.save_product_with_options(bigint,jsonb,jsonb) set search_path = pg_catalog, public, pg_temp;
alter function public.resolve_product_options(bigint,jsonb,text) set search_path = pg_catalog, public, pg_temp;
alter function public.product_review_stats() set search_path = pg_catalog, public, pg_temp;
alter function public.create_order(jsonb,jsonb) set search_path = pg_catalog, public, pg_temp;
alter function public.create_manual_order(jsonb,jsonb,text) set search_path = pg_catalog, public, pg_temp;
alter function public.my_product_review(bigint) set search_path = pg_catalog, public, pg_temp;
alter function public.create_manual_order(jsonb,jsonb,text,uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.prevent_reserved_product_deletion() set search_path = pg_catalog, public, pg_temp;
alter function public.save_product_with_gallery(bigint,jsonb,jsonb,jsonb) set search_path = pg_catalog, public, pg_temp;
alter function public.submit_product_review(bigint,integer,text) set search_path = pg_catalog, public, pg_temp;
alter function public.admin_product_reviews() set search_path = pg_catalog, public, pg_temp;
alter function public.moderate_product_review(uuid,text,timestamp with time zone) set search_path = pg_catalog, public, pg_temp;
alter function public.protect_order_identity() set search_path = pg_catalog, public, pg_temp;
alter function public.advance_order_fulfillment(uuid,text,text) set search_path = pg_catalog, public, pg_temp;
alter function public.create_manual_order_with_reference(jsonb,jsonb,text,uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.snapshot_order_shipping() set search_path = pg_catalog, public, pg_temp;
alter function public.record_order_shipment(uuid,text,text,text,text) set search_path = pg_catalog, public, pg_temp;
alter function public.claim_order_notification(uuid,text) set search_path = pg_catalog, public, pg_temp;

-- Fail closed on inherited privilege drift; never assume a REVOKE removed access.
do $$
declare browser_role text; relation_name text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    foreach relation_name in array array['profiles','categories','products','orders','order_items','customer_addresses','wishlists','website_settings','order_notifications','product_images','product_option_groups','product_option_values','product_reviews'] loop
      if has_table_privilege(browser_role,'public.' || relation_name,'TRUNCATE')
         or has_table_privilege(browser_role,'public.' || relation_name,'MAINTAIN')
         or has_table_privilege(browser_role,'public.' || relation_name,'TRIGGER')
         or has_table_privilege(browser_role,'public.' || relation_name,'REFERENCES') then
        raise exception 'Unexpected inherited table privileges; stop and review role grants';
      end if;
    end loop;
    if has_any_column_privilege(browser_role,'public.order_notifications','INSERT')
       or has_any_column_privilege(browser_role,'public.order_notifications','UPDATE')
       or has_table_privilege(browser_role,'public.order_notifications','DELETE')
       or has_column_privilege(browser_role,'public.profiles','role','UPDATE')
       or has_column_privilege(browser_role,'public.orders','payment_status','UPDATE') then
      raise exception 'Unexpected protected write privileges; stop and review column grants';
    end if;
  end loop;
end $$;
commit;
