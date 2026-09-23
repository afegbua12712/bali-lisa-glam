-- Review and apply manually before publishing the matching frontend.
-- No existing order, inventory, profile, Storage or checkout logic is replaced.
begin;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,
  url text not null check (length(url) between 1 and 2048),
  alt_text text not null default '' check (length(alt_text) <= 200),
  display_order integer not null check (display_order >= 0),
  option_value_id uuid references public.product_option_values(id) on delete set null,
  unique (product_id, display_order) deferrable initially deferred
);
create index product_images_option_idx on public.product_images(option_value_id);
alter table public.product_images enable row level security;
create policy "read active product gallery" on public.product_images for select to anon, authenticated
using (public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.is_active));
revoke all on public.product_images from public, anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant all on public.product_images to service_role;

-- Keep existing images without moving or rewriting any Storage objects.
insert into public.product_images(product_id, url, display_order)
select id, image_url, 0 from public.products where nullif(trim(image_url), '') is not null;

create function public.save_product_with_gallery(target_product_id bigint, product_data jsonb, option_groups jsonb, gallery jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare saved_id bigint; item jsonb; position integer := 0; value_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then raise exception 'Administrator required'; end if;
  if jsonb_typeof(gallery) is distinct from 'array' then raise exception 'Invalid product gallery'; end if;
  if jsonb_array_length(gallery) not between 1 and 20 then raise exception 'Invalid product gallery'; end if;
  if (select count(*) <> count(distinct x->>'id') from jsonb_array_elements(gallery) x) then raise exception 'Invalid product gallery'; end if;
  -- The existing RPC retains all product/option validation and product locking.
  saved_id := public.save_product_with_options(target_product_id,
    product_data || jsonb_build_object('image_url', gallery->0->>'url'), option_groups);
  for item in select * from jsonb_array_elements(gallery) loop
    if item->>'id' is null or coalesce(length(item->>'url'), 0) not between 1 and 2048
       or (item->>'url' !~ '^https://' and item->>'url' !~ '^/[^/]')
       or coalesce(length(item->>'alt_text'), 0) > 200 then raise exception 'Invalid product gallery'; end if;
    value_id := nullif(item->>'option_value_id', '')::uuid;
    if value_id is not null and not exists (
      select 1 from public.product_option_values v join public.product_option_groups g on g.id = v.option_group_id
      where v.id = value_id and g.product_id = saved_id
    ) then raise exception 'Invalid image option association'; end if;
    insert into public.product_images(id, product_id, url, alt_text, display_order, option_value_id)
    values ((item->>'id')::uuid, saved_id, item->>'url', coalesce(item->>'alt_text', ''), position, value_id)
    on conflict (id) do update set url = excluded.url, alt_text = excluded.alt_text,
      display_order = excluded.display_order, option_value_id = excluded.option_value_id
      where product_images.product_id = saved_id;
    if not found then raise exception 'Invalid product gallery'; end if;
    position := position + 1;
  end loop;
  delete from public.product_images where product_id = saved_id
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(gallery) x);
  return saved_id;
end $$;
revoke all on function public.save_product_with_gallery(bigint,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_product_with_gallery(bigint,jsonb,jsonb,jsonb) to authenticated;

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (length(trim(body)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, customer_id)
);
create index product_reviews_public_idx on public.product_reviews(product_id, status, created_at desc);
alter table public.product_reviews enable row level security;
create policy "read approved active reviews" on public.product_reviews for select to anon, authenticated
using (status = 'approved' and exists(select 1 from public.products p where p.id = product_id and p.is_active));
-- Public columns intentionally exclude customer_id. Own/admin access is via
-- checked RPCs; browser roles have no direct INSERT/UPDATE/DELETE privileges.
revoke all on public.product_reviews from public, anon, authenticated;
grant select(id, product_id, rating, body, status, created_at) on public.product_reviews to anon, authenticated;
grant all on public.product_reviews to service_role;

create function public.product_review_stats()
returns table(product_id bigint, average_rating numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select r.product_id, round(avg(r.rating), 1), count(*) from public.product_reviews r
  join public.products p on p.id = r.product_id
  where r.status = 'approved' and p.is_active group by r.product_id;
$$;
revoke all on function public.product_review_stats() from public, anon, authenticated;
grant execute on function public.product_review_stats() to anon, authenticated;

create function public.my_product_review(target_product_id bigint)
returns table(id uuid, rating integer, body text, status text)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.body, r.status from public.product_reviews r
  where auth.uid() is not null and r.customer_id = auth.uid() and r.product_id = target_product_id;
$$;
revoke all on function public.my_product_review(bigint) from public, anon, authenticated;
grant execute on function public.my_product_review(bigint) to authenticated;

create function public.submit_product_review(target_product_id bigint, review_rating integer, review_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare review_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if review_rating is null or review_rating not between 1 and 5 or coalesce(length(trim(review_body)), 0) not between 10 and 2000 then
    raise exception 'Invalid review';
  end if;
  if not exists(select 1 from public.products where id = target_product_id and is_active) then raise exception 'A product is unavailable'; end if;
  insert into public.product_reviews(product_id, customer_id, rating, body)
    values(target_product_id, auth.uid(), review_rating, trim(review_body))
  on conflict(product_id, customer_id) do update set rating = excluded.rating, body = excluded.body,
    status = 'pending', updated_at = now()
  returning id into review_id;
  return review_id;
end $$;
revoke all on function public.submit_product_review(bigint,integer,text) from public, anon, authenticated;
grant execute on function public.submit_product_review(bigint,integer,text) to authenticated;

create function public.admin_product_reviews()
returns table(id uuid, product_id bigint, product_name text, customer_email text, rating integer, body text, status text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then raise exception 'Administrator required'; end if;
  return query select r.id, r.product_id, p.name, pr.email, r.rating, r.body, r.status, r.created_at, r.updated_at
    from public.product_reviews r join public.products p on p.id = r.product_id
    join public.profiles pr on pr.id = r.customer_id order by r.updated_at desc;
end $$;
revoke all on function public.admin_product_reviews() from public, anon, authenticated;
grant execute on function public.admin_product_reviews() to authenticated;

create function public.moderate_product_review(target_review_id uuid, decision text, expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then raise exception 'Administrator required'; end if;
  if decision = 'remove' then
    delete from public.product_reviews where id = target_review_id and updated_at = expected_updated_at;
  elsif decision in ('approved','rejected') then
    update public.product_reviews set status = decision, updated_at = now()
      where id = target_review_id and updated_at = expected_updated_at;
  else raise exception 'Invalid review decision';
  end if;
  if not found then raise exception 'Review changed; refresh before moderating'; end if;
end $$;
revoke all on function public.moderate_product_review(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.moderate_product_review(uuid,text,timestamptz) to authenticated;

commit;
