-- Apply manually after approval. No customer rows or order logic are changed.
begin;

-- Table UPDATE implies access to every column: remove it before allowlisting.
revoke update on public.profiles from public, anon, authenticated;
-- Remove any pre-existing column grants too, including on future/custom fields.
do $$
declare columns_sql text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into columns_sql from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke update (%s) on public.profiles from public, anon, authenticated', columns_sql);
end $$;
grant update (first_name, last_name, phone, updated_at)
  on public.profiles to authenticated;
-- Existing ownership RLS still applies. Role/identity maintenance remains a
-- trusted SQL/service-role operation, not a browser operation (including admins).

revoke execute on function public.create_order(jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.create_manual_order(jsonb, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.create_manual_order(jsonb, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_manual_order(jsonb, jsonb, text, uuid)
  to authenticated;

-- Fail closed if inherited privileges or owner drift defeat the intended state.
do $$
declare browser_role text; wrapper_owner oid; wrapper_definer boolean;
begin
  foreach browser_role in array array['anon', 'authenticated'] loop
    if has_column_privilege(browser_role, 'public.profiles', 'role', 'UPDATE')
       or has_column_privilege(browser_role, 'public.profiles', 'id', 'UPDATE')
       or has_function_privilege(browser_role, 'public.create_order(jsonb,jsonb)', 'EXECUTE')
       or has_function_privilege(browser_role, 'public.create_manual_order(jsonb,jsonb,text)', 'EXECUTE') then
      raise exception 'Browser privileges remain through an inherited grant; review role memberships';
    end if;
  end loop;
  if has_function_privilege('anon', 'public.create_manual_order(jsonb,jsonb,text,uuid)', 'EXECUTE') then
    raise exception 'Anonymous checkout execution remains through an inherited grant';
  end if;
  select proowner, prosecdef into wrapper_owner, wrapper_definer
    from pg_proc where oid = 'public.create_manual_order(jsonb,jsonb,text,uuid)'::regprocedure;
  if not wrapper_definer or not has_function_privilege(wrapper_owner,
      'public.create_order(jsonb,jsonb)'::regprocedure, 'EXECUTE') then
    raise exception 'Manual checkout owner cannot execute the internal order helper';
  end if;
end $$;

commit;
