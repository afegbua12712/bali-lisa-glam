-- Apply manually before publishing the matching frontend. Existing order
-- snapshots, manual-payment idempotency, and product-level stock are preserved.
begin;

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  display_order integer not null default 0 check (display_order >= 0),
  required boolean not null default true
);
create index product_option_groups_product_idx on public.product_option_groups(product_id);
create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.product_option_groups(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 100),
  display_order integer not null default 0 check (display_order >= 0),
  active boolean not null default true,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);
create index product_option_values_group_idx on public.product_option_values(option_group_id);
alter table public.product_option_groups enable row level security;
alter table public.product_option_values enable row level security;
create policy "read product option groups" on public.product_option_groups for select to anon, authenticated
using (public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "read product option values" on public.product_option_values for select to anon, authenticated
using (public.is_admin() or (active and exists (
  select 1 from public.product_option_groups g join public.products p on p.id = g.product_id
  where g.id = option_group_id and p.is_active
)));
revoke all on public.product_option_groups, public.product_option_values from public, anon, authenticated;
grant select on public.product_option_groups, public.product_option_values to anon, authenticated;
grant all on public.product_option_groups, public.product_option_values to service_role;

-- Migrate the existing shades rather than maintaining a second option system.
-- A single Universal placeholder means that the product has no choices.
do $$
declare p record; group_id uuid;
begin
  for p in select id, shades from public.products
    where jsonb_typeof(shades) = 'array' and jsonb_array_length(shades) > 0
  loop
    if exists (select 1 from jsonb_array_elements_text(p.shades) s(label)
               where trim(label) <> '' and lower(trim(label)) <> 'universal') then
      insert into public.product_option_groups(product_id, name) values (p.id, 'Shade') returning id into group_id;
      insert into public.product_option_values(option_group_id, label, display_order)
      select group_id, trim(label), (min(position) - 1)::integer
      from jsonb_array_elements_text(p.shades) with ordinality s(label, position)
      where trim(label) <> '' group by trim(label);
    end if;
  end loop;
end $$;

alter table public.order_items add column selected_options jsonb not null default '[]'::jsonb
  check (jsonb_typeof(selected_options) = 'array');

-- Admin-only atomic editing also locks the product, serializing with checkout.
create function public.save_product_with_options(target_product_id bigint, product_data jsonb, option_groups jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare saved_id bigint; g jsonb; v jsonb; gid uuid; vid uuid; legacy_shades jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then raise exception 'Administrator required'; end if;
  if option_groups is null or jsonb_typeof(option_groups) <> 'array' then raise exception 'Invalid product options'; end if;
  if jsonb_array_length(option_groups) > 20 then raise exception 'Invalid product options'; end if;
  if (select count(*) <> count(distinct lower(trim(x->>'name'))) or count(*) <> count(distinct x->>'id') from jsonb_array_elements(option_groups) x) then
    raise exception 'Invalid product options';
  end if;
  for g in select * from jsonb_array_elements(option_groups) loop
    if g->>'id' is null or coalesce(length(trim(g->>'name')), 0) not between 1 and 80
       or jsonb_typeof(g->'required') is distinct from 'boolean'
       or jsonb_typeof(g->'values') is distinct from 'array' then raise exception 'Invalid product options'; end if;
    if jsonb_array_length(g->'values') > 100 then raise exception 'Invalid product options'; end if;
    if (select count(*) <> count(distinct lower(trim(x->>'label'))) or count(*) <> count(distinct x->>'id') from jsonb_array_elements(g->'values') x) then
      raise exception 'Invalid product options';
    end if;
    if (g->>'required')::boolean and not exists (select 1 from jsonb_array_elements(g->'values') x where x->>'active' = 'true') then
      raise exception 'Invalid product options';
    end if;
    for v in select * from jsonb_array_elements(g->'values') loop
      if v->>'id' is null or coalesce(length(trim(v->>'label')), 0) not between 1 and 100
         or jsonb_typeof(v->'active') is distinct from 'boolean'
         or (nullif(v->>'color', '') is not null and v->>'color' !~ '^#[0-9A-Fa-f]{6}$') then
        raise exception 'Invalid product options';
      end if;
    end loop;
  end loop;

  if target_product_id is null then
    insert into public.products(name, slug, description, price_cents, inventory_quantity, category_id, image_url, is_active, shades)
    values (trim(product_data->>'name'), trim(product_data->>'slug'), trim(product_data->>'description'),
      (product_data->>'price_cents')::integer, (product_data->>'inventory_quantity')::integer,
      (product_data->>'category_id')::bigint, trim(product_data->>'image_url'), (product_data->>'is_active')::boolean, '["Universal"]') returning id into saved_id;
  else
    update public.products set name = trim(product_data->>'name'), slug = trim(product_data->>'slug'),
      description = trim(product_data->>'description'), price_cents = (product_data->>'price_cents')::integer,
      inventory_quantity = (product_data->>'inventory_quantity')::integer, category_id = (product_data->>'category_id')::bigint,
      image_url = trim(product_data->>'image_url'), is_active = (product_data->>'is_active')::boolean, updated_at = now()
    where id = target_product_id returning id into saved_id;
    if not found then raise exception 'A product is unavailable'; end if;
  end if;
  for g in select * from jsonb_array_elements(option_groups) loop
    gid := (g->>'id')::uuid;
    insert into public.product_option_groups(id, product_id, name, display_order, required)
    values (gid, saved_id, trim(g->>'name'), (g->>'display_order')::integer, (g->>'required')::boolean)
    on conflict (id) do update set name = excluded.name, display_order = excluded.display_order, required = excluded.required
      where product_option_groups.product_id = saved_id;
    if not found then raise exception 'Invalid product options'; end if;
    for v in select * from jsonb_array_elements(g->'values') loop
      vid := (v->>'id')::uuid;
      insert into public.product_option_values(id, option_group_id, label, display_order, active, color)
      values (vid, gid, trim(v->>'label'), (v->>'display_order')::integer, (v->>'active')::boolean, nullif(v->>'color', ''))
      on conflict (id) do update set label = excluded.label, display_order = excluded.display_order, active = excluded.active, color = excluded.color
        where product_option_values.option_group_id = gid;
      if not found then raise exception 'Invalid product options'; end if;
    end loop;
    delete from public.product_option_values where option_group_id = gid
      and id not in (select (x->>'id')::uuid from jsonb_array_elements(g->'values') x);
  end loop;
  delete from public.product_option_groups where product_id = saved_id
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(option_groups) x);
  select jsonb_agg(v.label order by v.display_order, v.id) into legacy_shades
    from public.product_option_groups g join public.product_option_values v on v.option_group_id = g.id
    where g.product_id = saved_id and lower(g.name) = 'shade' and v.active;
  update public.products set shades = coalesce(legacy_shades, '["Universal"]'::jsonb) where id = saved_id;
  return saved_id;
end $$;
revoke all on function public.save_product_with_options(bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_product_with_options(bigint, jsonb, jsonb) to authenticated;

-- Private resolver: caller-supplied labels are never trusted. No live foreign
-- keys link the returned snapshot to editable/deletable option records.
create function public.resolve_product_options(target_product_id bigint, selected jsonb, legacy_shade text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare choices jsonb := selected; snapshot jsonb; option_group record; choice jsonb; value_row public.product_option_values%rowtype;
begin
  if choices is null then
    choices := '[]'::jsonb;
    -- Compatibility for bags created before this migration, only for the
    -- original single Shade group; never guess a choice for a new group.
    if (select count(*) from public.product_option_groups where product_id = target_product_id) = 1 then
      select jsonb_build_array(jsonb_build_object('group_id', g.id, 'value_id', v.id)) into snapshot
        from public.product_option_groups g join public.product_option_values v on v.option_group_id = g.id
        where g.product_id = target_product_id and g.name = 'Shade' and v.active and v.label = trim(legacy_shade);
      choices := coalesce(snapshot, '[]'::jsonb);
    end if;
  end if;
  if jsonb_typeof(choices) is distinct from 'array' then raise exception 'Invalid product options'; end if;
  if jsonb_array_length(choices) > 20 then raise exception 'Invalid product options'; end if;
  if (select count(*) <> count(distinct x->>'group_id') from jsonb_array_elements(choices) x) then raise exception 'Invalid product options'; end if;
  if exists (select 1 from jsonb_array_elements(choices) x
    where not exists (select 1 from public.product_option_groups g where g.product_id = target_product_id and g.id::text = x->>'group_id')) then
    raise exception 'Invalid product options';
  end if;
  snapshot := '[]'::jsonb;
  for option_group in select * from public.product_option_groups where product_id = target_product_id order by display_order, id loop
    select x into choice from jsonb_array_elements(choices) x where x->>'group_id' = option_group.id::text;
    if choice is null then
      if option_group.required then raise exception 'Invalid product options'; end if;
      continue;
    end if;
    select * into value_row from public.product_option_values where option_group_id = option_group.id and id::text = choice->>'value_id' and active;
    if not found then raise exception 'Invalid product options'; end if;
    snapshot := snapshot || jsonb_build_array(jsonb_build_object('group_id', option_group.id, 'value_id', value_row.id, 'name', option_group.name, 'value', value_row.label));
  end loop;
  return snapshot;
end $$;
revoke all on function public.resolve_product_options(bigint, jsonb, text) from public, anon, authenticated;

-- create_order below retains shipping, pricing, stock locking and deduction.
-- Only its order-item insertion changes to validate and snapshot options.

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
  line jsonb;
  snapshot jsonb;
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

  for line in select * from jsonb_array_elements(lines) loop
    snapshot := public.resolve_product_options((line->>'product_id')::bigint, line->'selected_options', line->>'shade');
    insert into public.order_items(order_id, product_id, product_name, shade, unit_price_cents, quantity, selected_options)
    select new_order_id, p.id, p.name,
      (select string_agg((x->>'name') || ': ' || (x->>'value'), ' · ' order by position)
       from jsonb_array_elements(snapshot) with ordinality s(x, position)),
      p.price_cents, (line->>'quantity')::integer, snapshot
    from public.products p where p.id = (line->>'product_id')::bigint;
  end loop;

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


commit;
