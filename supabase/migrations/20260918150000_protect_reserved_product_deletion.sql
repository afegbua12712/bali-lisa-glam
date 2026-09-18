-- Manual application only after approval. Retain product references needed for release.
begin;
create or replace function public.prevent_reserved_product_deletion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- DELETE already locks this product; checkout also locks products before reserving.
  -- Check all reserved states, including inconsistent payment states, conservatively.
  if exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where i.product_id = old.id and o.inventory_reservation_status = 'reserved'
  ) then
    raise exception using errcode = 'BLG01', message = 'Product has outstanding inventory reservations';
  end if;
  return old;
end $$;
revoke all on function public.prevent_reserved_product_deletion() from public, anon, authenticated;
drop trigger if exists prevent_reserved_product_deletion on public.products;
create trigger prevent_reserved_product_deletion before delete on public.products
for each row execute function public.prevent_reserved_product_deletion();
commit;
