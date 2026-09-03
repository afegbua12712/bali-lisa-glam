-- Customer-owned account data for V1 addresses and saved items.
alter table public.profiles add column if not exists phone text;
create table if not exists public.customer_addresses (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null, last_name text not null, address text not null, unit text,
  city text not null, province text not null, postal_code text not null, country text not null default 'Canada', phone text,
  updated_at timestamptz not null default now()
);
create table if not exists public.wishlists (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (customer_id, product_id)
);
alter table public.customer_addresses enable row level security;
alter table public.wishlists enable row level security;
create policy "customers manage own address" on public.customer_addresses for all using (customer_id = auth.uid() or public.is_admin()) with check (customer_id = auth.uid() or public.is_admin());
create policy "customers manage own wishlist" on public.wishlists for all using (customer_id = auth.uid() or public.is_admin()) with check (customer_id = auth.uid() or public.is_admin());
