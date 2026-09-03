-- Operational order archiving. Archived orders retain all customer and order-item history.
alter table public.orders add column if not exists archived_at timestamptz;
create index if not exists orders_archived_at_idx on public.orders (archived_at, created_at desc);
