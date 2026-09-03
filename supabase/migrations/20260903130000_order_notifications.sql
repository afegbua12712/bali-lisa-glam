-- Transactional order-email ledger and authenticated delivery claims.

create table if not exists public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('order_created', 'payment_confirmed')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, event_type)
);

create index if not exists order_notifications_status_idx
  on public.order_notifications (status, updated_at);

alter table public.order_notifications enable row level security;

revoke all on table public.order_notifications from anon;
grant select on table public.order_notifications to authenticated;
grant all on table public.order_notifications to service_role;

create policy "customers read own order notifications"
on public.order_notifications for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_notifications.order_id
      and (orders.customer_id = auth.uid() or public.is_admin())
  )
);

-- Claims are serialized on the notification row. A failed claim, or a sending
-- claim abandoned for at least five minutes, can be retried. Sent events cannot.
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
  if target_event_type not in ('order_created', 'payment_confirmed') then
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

  insert into public.order_notifications(order_id, event_type)
  values (target_order_id, target_event_type)
  on conflict (order_id, event_type) do nothing;

  select * into target_notification
  from public.order_notifications
  where order_id = target_order_id and event_type = target_event_type
  for update;

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
