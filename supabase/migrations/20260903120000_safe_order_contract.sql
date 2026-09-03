-- Launch-safe order contract for CAD, authoritative shipping, idempotency,
-- and manual-payment inventory reservations.

alter table public.orders
  add column if not exists checkout_idempotency_key uuid,
  add column if not exists payment_expires_at timestamptz,
  add column if not exists inventory_reservation_status text,
  add column if not exists inventory_restored_at timestamptz,
  add column if not exists cancellation_reason text;

alter table public.orders alter column currency set default 'CAD';

alter table public.website_settings
  add column if not exists international_standard_shipping_cents integer
    check (international_standard_shipping_cents >= 0),
  add column if not exists international_free_shipping_threshold_cents integer
    check (international_free_shipping_threshold_cents >= 0);

alter table public.orders drop constraint if exists orders_inventory_reservation_status_check;
alter table public.orders add constraint orders_inventory_reservation_status_check
  check (inventory_reservation_status is null or inventory_reservation_status in ('reserved', 'committed', 'restored'));

-- The preceding production contract always deducted inventory during order
-- creation. Classify only states whose inventory meaning is therefore known;
-- leave previously cancelled/refunded rows null rather than guessing whether
-- staff adjusted their stock manually.
update public.orders
set inventory_reservation_status = 'reserved',
    payment_expires_at = coalesce(payment_expires_at, created_at + interval '48 hours')
where inventory_reservation_status is null
  and payment_status = 'awaiting_payment'
  and payment_method in ('manual_whatsapp', 'manual_email');

update public.orders
set inventory_reservation_status = 'committed'
where inventory_reservation_status is null
  and payment_status = 'paid';

create unique index if not exists orders_customer_checkout_idempotency_idx
  on public.orders (customer_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

create index if not exists orders_manual_payment_expiry_idx
  on public.orders (payment_expires_at)
  where payment_status = 'awaiting_payment' and inventory_reservation_status = 'reserved';

-- Preserve the inactive Stripe scaffold while making its underlying order RPC
-- use authoritative shipping settings and explicitly persist CAD.
create or replace function public.create_order(lines jsonb, shipping_address jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_order_id uuid;
  subtotal integer := 0;
  shipping integer;
  destination_country text;
  free_shipping_threshold integer;
  standard_shipping integer;
  requested record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then
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

  insert into public.order_items(order_id, product_id, product_name, shade, unit_price_cents, quantity)
  select new_order_id, p.id, p.name, x.shade, p.price_cents, x.quantity
  from jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)
  join public.products p on p.id = x.product_id;

  update public.products p
  set inventory_quantity = p.inventory_quantity - r.quantity, updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(lines) as x(product_id bigint, quantity integer, shade text)
    group by product_id
  ) r
  where p.id = r.product_id;

  return new_order_id;
end; $$;

-- The advisory transaction lock serializes concurrent retries before the
-- unique index is reached, so inventory is reserved only once.
create or replace function public.create_manual_order(
  lines jsonb,
  shipping_address jsonb,
  selected_payment_method text,
  idempotency_key uuid
)
returns table(
  order_id uuid,
  order_number bigint,
  subtotal_cents integer,
  shipping_cents integer,
  total_cents integer,
  currency text,
  payment_expires_at timestamptz,
  already_existed boolean
) language plpgsql security definer set search_path = public as $$
declare
  created_order_id uuid;
  target_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if idempotency_key is null then raise exception 'Checkout idempotency key is required'; end if;
  if selected_payment_method not in ('manual_whatsapp','manual_email') then
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
end; $$;

create or replace function public.confirm_manual_payment(target_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.orders
  set status = 'paid', payment_status = 'paid', paid_at = now(),
      inventory_reservation_status = 'committed', updated_at = now()
  where id = target_order_id
    and payment_status = 'awaiting_payment'
    and inventory_reservation_status = 'reserved';
  if not found then raise exception 'Order is not an active unpaid reservation'; end if;
end; $$;

create or replace function public.cancel_unpaid_order(target_order_id uuid, reason text default 'Cancelled by administrator')
returns void language plpgsql security definer set search_path = public as $$
declare target_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into target_order from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.inventory_reservation_status = 'restored' and target_order.payment_status = 'cancelled' then
    return;
  end if;
  if target_order.payment_status <> 'awaiting_payment'
     or target_order.inventory_reservation_status <> 'reserved' then
    raise exception 'Only an active unpaid reservation can be cancelled and restored';
  end if;

  update public.products p
  set inventory_quantity = p.inventory_quantity + restored.quantity, updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = target_order_id and product_id is not null
    group by product_id
  ) restored
  where p.id = restored.product_id;

  update public.orders
  set status = 'cancelled', payment_status = 'cancelled',
      inventory_reservation_status = 'restored', inventory_restored_at = now(),
      cancellation_reason = coalesce(nullif(trim(reason), ''), 'Cancelled by administrator'),
      updated_at = now()
  where id = target_order_id;
end; $$;

create or replace function public.prevent_reserved_order_deletion()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.inventory_reservation_status = 'reserved' then
    raise exception 'Cancel the unpaid order to restore inventory before deleting it';
  end if;
  return old;
end; $$;

drop trigger if exists prevent_reserved_order_deletion on public.orders;
create trigger prevent_reserved_order_deletion before delete on public.orders
for each row execute function public.prevent_reserved_order_deletion();

revoke all on function public.create_manual_order(jsonb, jsonb, text, uuid) from public;
grant execute on function public.create_manual_order(jsonb, jsonb, text, uuid) to authenticated;
revoke execute on function public.create_manual_order(jsonb, jsonb, text) from authenticated;
revoke all on function public.cancel_unpaid_order(uuid, text) from public;
grant execute on function public.cancel_unpaid_order(uuid, text) to authenticated;
