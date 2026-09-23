-- Prepared locally only. Review production compatibility before applying.
begin;

-- Reuse the existing concurrency-safe identity; never allocate via MAX()+1.
-- STORED generation also deterministically backfills every existing order.
alter table public.orders add constraint orders_positive_number check (order_number > 0);
alter table public.orders add column order_reference text generated always as
  ('BL-' || lpad(order_number::text, greatest(5, length(order_number::text)), '0')) stored not null;
alter table public.orders add constraint orders_reference_unique unique (order_reference);

create function public.protect_order_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id or new.order_number is distinct from old.order_number then
    raise exception 'Order identity and reference are permanent';
  end if;
  return new;
end $$;
create trigger protect_order_identity before update on public.orders
for each row execute function public.protect_order_identity();
revoke all on function public.protect_order_identity() from public, anon, authenticated;

-- Retain historical enum values and payment/cancellation RPC behavior.
-- New enum labels are used only by RPC calls AFTER this transaction commits.
alter type public.order_status add value 'processing';
alter type public.order_status add value 'shipped';
alter type public.order_status add value 'delivered';
alter table public.orders
  add column processing_at timestamptz,
  add column shipped_at timestamptz,
  add column delivered_at timestamptz;
-- Do not invent historical shipping/delivery dates for legacy fulfilled rows.
alter table public.orders add constraint orders_fulfillment_timestamps check (
  (processing_at is null or (paid_at is null or processing_at >= paid_at)) and
  (shipped_at is null or (processing_at is not null and shipped_at >= processing_at)) and
  (delivered_at is null or (shipped_at is not null and delivered_at >= shipped_at)) and
  (status::text not in ('processing','shipped','delivered') or
    (payment_status = 'paid' and processing_at is not null)) and
  (status::text not in ('shipped','delivered') or shipped_at is not null) and
  (status::text <> 'delivered' or delivered_at is not null)
);

-- Keep archive/restore working through existing admin-only RLS. All other
-- browser writes must use checked RPCs (including for admins).
revoke insert, update on public.orders from public, anon, authenticated;
do $$
declare columns_sql text; browser_role text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into columns_sql
    from pg_attribute where attrelid = 'public.orders'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s) on public.orders from public, anon, authenticated', columns_sql, columns_sql);
  foreach browser_role in array array['anon','authenticated'] loop
    if has_any_column_privilege(browser_role, 'public.orders', 'INSERT') or
       has_any_column_privilege(browser_role, 'public.orders', 'UPDATE') then
      raise exception 'Inherited order write privileges require review';
    end if;
  end loop;
end $$;
grant update (archived_at) on public.orders to authenticated;

create function public.advance_order_fulfillment(target_order_id uuid, expected_status text, next_status text)
returns void language plpgsql security definer set search_path = public as $$
declare target public.orders%rowtype; transition_time timestamptz;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then raise exception 'Administrator required'; end if;
  select * into target from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if expected_status is distinct from target.status::text then raise exception 'Order changed; refresh before continuing'; end if;
  if target.payment_status is distinct from 'paid' or target.inventory_reservation_status in ('reserved','restored') then
    raise exception 'Confirmed payment and committed inventory required';
  end if;
  if next_status is null or not (
    (target.status::text in ('pending','paid') and next_status = 'processing') or
    (target.status::text = 'processing' and next_status = 'shipped') or
    (target.status::text = 'shipped' and next_status = 'delivered')
  ) then raise exception 'Invalid fulfillment transition'; end if;
  transition_time := greatest(clock_timestamp(), target.paid_at, target.processing_at, target.shipped_at);
  update public.orders set status = next_status::public.order_status,
    processing_at = case when next_status = 'processing' then transition_time else processing_at end,
    shipped_at = case when next_status = 'shipped' then transition_time else shipped_at end,
    delivered_at = case when next_status = 'delivered' then transition_time else delivered_at end,
    updated_at = transition_time
  where id = target_order_id;
end $$;
revoke all on function public.advance_order_fulfillment(uuid,text,text) from public, anon, authenticated;
grant execute on function public.advance_order_fulfillment(uuid,text,text) to authenticated;

-- Additive checkout wrapper preserves the existing idempotency/stock contract
-- and returns the persisted reference even before the summary fetch succeeds.
create function public.create_manual_order_with_reference(lines jsonb, shipping_address jsonb, selected_payment_method text, idempotency_key uuid)
returns table(order_id uuid, order_number bigint, subtotal_cents integer, shipping_cents integer,
  total_cents integer, currency text, payment_expires_at timestamptz, already_existed boolean, order_reference text)
language plpgsql security definer set search_path = public as $$
declare created record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into created from public.create_manual_order(lines, shipping_address, selected_payment_method, idempotency_key);
  return query select created.order_id, created.order_number, created.subtotal_cents, created.shipping_cents,
    created.total_cents, created.currency, created.payment_expires_at, created.already_existed, o.order_reference
  from public.orders o where o.id = created.order_id and o.customer_id = auth.uid();
end $$;
revoke all on function public.create_manual_order_with_reference(jsonb,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.create_manual_order_with_reference(jsonb,jsonb,text,uuid) to authenticated;

commit;
