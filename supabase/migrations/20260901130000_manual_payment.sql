-- Manual payment lifecycle. Safe forward-only addition to existing orders.
alter table public.orders add column if not exists payment_method text check (payment_method in ('manual_whatsapp','manual_email','stripe'));
alter table public.orders add column if not exists payment_status text not null default 'awaiting_payment' check (payment_status in ('awaiting_payment','paid','cancelled'));

create or replace function public.create_manual_order(lines jsonb, shipping_address jsonb, selected_payment_method text)
returns table(order_id uuid, order_number bigint, total_cents integer) language plpgsql security definer set search_path = public as $$
declare created_order_id uuid;
begin
  if selected_payment_method not in ('manual_whatsapp','manual_email') then raise exception 'Unsupported payment method'; end if;
  created_order_id := public.create_order(lines, shipping_address);
  update public.orders set payment_method = selected_payment_method, payment_status = 'awaiting_payment', status = 'pending' where id = created_order_id;
  return query select o.id, o.order_number, o.total_cents from public.orders o where o.id = created_order_id;
end; $$;

create or replace function public.confirm_manual_payment(target_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.orders set status = 'paid', payment_status = 'paid', paid_at = now(), updated_at = now() where id = target_order_id and payment_status = 'awaiting_payment';
  if not found then raise exception 'Order is not awaiting manual payment'; end if;
end; $$;

revoke all on function public.create_manual_order(jsonb, jsonb, text) from public;
grant execute on function public.create_manual_order(jsonb, jsonb, text) to authenticated;
revoke all on function public.confirm_manual_payment(uuid) from public;
grant execute on function public.confirm_manual_payment(uuid) to authenticated;
