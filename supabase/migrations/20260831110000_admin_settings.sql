-- Adds operational storefront settings without altering existing commerce data.
create table if not exists public.website_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Bali Lisa Glam',
  business_email text,
  whatsapp_number text,
  free_shipping_threshold_cents integer not null default 7500 check (free_shipping_threshold_cents >= 0),
  standard_shipping_cents integer not null default 800 check (standard_shipping_cents >= 0),
  bank_transfer_instructions text,
  updated_at timestamptz not null default now()
);
alter table public.website_settings enable row level security;
drop policy if exists "public reads storefront settings" on public.website_settings;
drop policy if exists "admins manage storefront settings" on public.website_settings;
create policy "public reads storefront settings" on public.website_settings for select using (true);
create policy "admins manage storefront settings" on public.website_settings for all using (public.is_admin()) with check (public.is_admin());
insert into public.website_settings (id) values (true) on conflict (id) do nothing;
