-- LOCAL PROPOSAL ONLY. Run docs/shipping-production-preflight.sql before approval.
begin;
alter table public.orders
  add column shipping_method text check (shipping_method in ('Standard Shipping','International Shipping')),
  add column shipment_carrier text check (length(shipment_carrier) between 1 and 120 and shipment_carrier !~ '[[:cntrl:]]'),
  add column tracking_number text check (length(tracking_number) between 1 and 200 and tracking_number !~ '[[:cntrl:]]');
-- No invented historical service or tracking. Existing totals/address stay untouched.
create function public.snapshot_order_shipping() returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP = 'INSERT' then
    new.shipping_method := case when lower(trim(new.shipping_address->>'country'))='canada' then 'Standard Shipping' else 'International Shipping' end;
  elsif new.shipping_method is distinct from old.shipping_method then
    raise exception 'Shipping method snapshot is permanent';
  end if;
  return new;
end $$;
create trigger snapshot_order_shipping before insert or update on public.orders for each row execute function public.snapshot_order_shipping();
revoke all on function public.snapshot_order_shipping() from public,anon,authenticated;
revoke insert(shipping_method,shipment_carrier,tracking_number),update(shipping_method,shipment_carrier,tracking_number) on public.orders from public,anon,authenticated;
create function public.record_order_shipment(target_order_id uuid, expected_status text, next_status text, carrier text, tracking text)
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
  if next_status <> 'shipped' and (nullif(trim(carrier),'') is not null or nullif(trim(tracking),'') is not null) then raise exception 'Shipment information requires the Shipped action'; end if;
  if length(carrier) > 120 or length(tracking) > 200 or carrier ~ '[[:cntrl:]]' or tracking ~ '[[:cntrl:]]' then raise exception 'Invalid shipment information'; end if;
  transition_time := greatest(clock_timestamp(), target.paid_at, target.processing_at, target.shipped_at);
  update public.orders set status = next_status::public.order_status,
    processing_at = case when next_status = 'processing' then transition_time else processing_at end,
    shipped_at = case when next_status = 'shipped' then transition_time else shipped_at end,
    delivered_at = case when next_status = 'delivered' then transition_time else delivered_at end,
    shipment_carrier = case when next_status = 'shipped' then nullif(trim(carrier),'') else shipment_carrier end,
    tracking_number = case when next_status = 'shipped' then nullif(trim(tracking),'') else tracking_number end,
    updated_at = transition_time
  where id = target_order_id;
end $$;
revoke all on function public.record_order_shipment(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_order_shipment(uuid,text,text,text,text) to authenticated;


-- Retain the original RPC signature for older clients; all paths share the same checks.
create or replace function public.advance_order_fulfillment(target_order_id uuid, expected_status text, next_status text)
returns void language plpgsql security definer set search_path=public as $$
begin perform public.record_order_shipment(target_order_id,expected_status,next_status,null,null); end $$;
revoke all on function public.advance_order_fulfillment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.advance_order_fulfillment(uuid,text,text) to authenticated;
alter table public.order_notifications drop constraint order_notifications_event_type_check;
alter table public.order_notifications add constraint order_notifications_event_type_check check(event_type in ('order_created','payment_confirmed','order_shipped','order_delivered'));
create or replace function public.claim_order_notification(
  target_order_id uuid,
  target_event_type text
)
returns table(notification_id uuid, should_send boolean)
language plpgsql security definer set search_path = public as $$
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
  if target_event_type in ('order_shipped','order_delivered') and (
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
end; $$;

revoke all on function public.claim_order_notification(uuid, text) from public;
grant execute on function public.claim_order_notification(uuid, text) to authenticated;

revoke all on function public.claim_order_notification(uuid,text) from public,anon;
commit;
