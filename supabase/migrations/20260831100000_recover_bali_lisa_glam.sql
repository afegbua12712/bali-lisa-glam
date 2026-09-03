-- Safe recovery for a partially applied 20260828160000 migration.
-- This migration never drops tables, enums, functions, or application data.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('customer', 'admin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null unique, slug text not null unique, image_url text, description text,
  sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.products (
  id bigint generated always as identity primary key,
  category_id bigint references public.categories(id) on delete set null,
  name text not null, slug text not null unique, description text not null,
  price_cents integer not null check (price_cents >= 0), image_url text not null,
  shades jsonb not null default '["Universal"]'::jsonb,
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  badge text, is_new boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
  customer_id uuid not null references public.profiles(id), status public.order_status not null default 'pending',
  currency text not null default 'USD' check (currency = upper(currency)), subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0), total_cents integer not null check (total_cents >= 0),
  shipping_address jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id bigint generated always as identity primary key, order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null, product_name text not null, shade text,
  unit_price_cents integer not null check (unit_price_cents >= 0), quantity integer not null check (quantity > 0), created_at timestamptz not null default now()
);

-- Add columns that may be absent if a table predated the migration.
alter table public.profiles add column if not exists role public.app_role not null default 'customer';
alter table public.products add column if not exists inventory_quantity integer not null default 0;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.create_order(lines jsonb, shipping_address jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare new_order_id uuid; subtotal integer := 0; shipping integer; line jsonb; product_row public.products%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then raise exception 'Order needs at least one item'; end if;
  for line in select * from jsonb_array_elements(lines) loop
    select * into product_row from public.products where id = (line ->> 'product_id')::bigint and is_active for update;
    if not found then raise exception 'A product is unavailable'; end if;
    if (line ->> 'quantity')::integer < 1 or product_row.inventory_quantity < (line ->> 'quantity')::integer then raise exception 'Insufficient inventory for %', product_row.name; end if;
    subtotal := subtotal + product_row.price_cents * (line ->> 'quantity')::integer;
  end loop;
  shipping := case when subtotal >= 7500 then 0 else 800 end;
  insert into public.orders(customer_id, subtotal_cents, shipping_cents, total_cents, shipping_address)
  values (auth.uid(), subtotal, shipping, subtotal + shipping, coalesce(shipping_address, '{}'::jsonb)) returning id into new_order_id;
  for line in select * from jsonb_array_elements(lines) loop
    select * into product_row from public.products where id = (line ->> 'product_id')::bigint for update;
    insert into public.order_items(order_id, product_id, product_name, shade, unit_price_cents, quantity)
    values (new_order_id, product_row.id, product_row.name, line ->> 'shade', product_row.price_cents, (line ->> 'quantity')::integer);
    update public.products set inventory_quantity = inventory_quantity - (line ->> 'quantity')::integer, updated_at = now() where id = product_row.id;
  end loop;
  return new_order_id;
end; $$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "public can read active categories" on public.categories;
drop policy if exists "public can read active products" on public.products;
drop policy if exists "admins manage categories" on public.categories;
drop policy if exists "admins manage products" on public.products;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "customers read own orders" on public.orders;
drop policy if exists "admins manage orders" on public.orders;
drop policy if exists "customers read own order items" on public.order_items;
drop policy if exists "admins manage order items" on public.order_items;
create policy "public can read active categories" on public.categories for select using (is_active or public.is_admin());
create policy "public can read active products" on public.products for select using (is_active or public.is_admin());
create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "users read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "customers read own orders" on public.orders for select using (customer_id = auth.uid() or public.is_admin());
create policy "admins manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "customers read own order items" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and (orders.customer_id = auth.uid() or public.is_admin())));
create policy "admins manage order items" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
revoke all on function public.create_order(jsonb, jsonb) from public;
grant execute on function public.create_order(jsonb, jsonb) to authenticated;

insert into public.categories(name, slug, sort_order) values
  ('Complexion','complexion',1),('Lips','lips',2),('Eyes','eyes',3),('Cheeks','cheeks',4),('Skincare','skincare',5)
on conflict (slug) do update set name=excluded.name, sort_order=excluded.sort_order;

insert into public.products(category_id,name,slug,description,price_cents,image_url,shades,rating,review_count,inventory_quantity,badge,is_new)
select c.id,v.name,v.slug,v.description,v.price_cents,v.image_url,v.shades::jsonb,v.rating,v.review_count,v.inventory_quantity,v.badge,v.is_new
from (values
('complexion','Luminous Veil Foundation','luminous-veil-foundation','A skin-loving, breathable foundation with a radiant satin finish.',3800,'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?auto=format&fit=crop&w=900&q=85','["Porcelain","Warm Beige","Honey","Espresso"]',4.9,126,120,'Bestseller',false),
('lips','Velvet Kiss Lip Color','velvet-kiss-lip-color','Weightless, velvet-matte colour that stays soft and comfortable.',2400,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=85','["Rosewood","Terracotta","Berry","Sienna"]',4.8,88,80,null,true),
('skincare','Golden Hour Glow Oil','golden-hour-glow-oil','A silky botanical face oil that cushions skin in moisture.',3200,'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=900&q=85','["Universal"]',5.0,64,65,null,false),
('eyes','Cloud Lash Mascara','cloud-lash-mascara','Buildable volume with a featherlight feel.',2600,'https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&w=900&q=85','["Onyx"]',4.7,107,85,null,false)
) as v(category_slug,name,slug,description,price_cents,image_url,shades,rating,review_count,inventory_quantity,badge,is_new)
join public.categories c on c.slug=v.category_slug
on conflict (slug) do nothing;
