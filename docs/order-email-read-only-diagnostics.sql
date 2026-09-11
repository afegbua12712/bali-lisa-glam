-- Run in production project zoaymppxmnilfyzfytcj.
-- One SELECT result set. No application functions are invoked.
-- Only the ledger count and schema/security metadata are read; no customer PII.
with expected_functions(signature) as (
  values ('public.claim_order_notification(uuid,text)'),
         ('public.is_admin()'),
         ('public.confirm_manual_payment(uuid)')
), report as (
  select '01_ledger' as section, 'order_notifications' as object_name,
         jsonb_build_object('row_count', count(*)) as details
  from public.order_notifications

  union all
  select '02_schema', 'public', jsonb_build_object(
    'authenticated_usage', has_schema_privilege('authenticated', 'public', 'USAGE')
  )

  union all
  select '03_function', e.signature, jsonb_build_object(
    'exists', p.oid is not null,
    'owner', r.rolname,
    'owner_superuser', r.rolsuper,
    'owner_bypass_rls', r.rolbypassrls,
    'security_definer', p.prosecdef,
    'settings', p.proconfig,
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'definition', pg_get_functiondef(p.oid)
  )
  from expected_functions e
  left join pg_proc p on p.oid = to_regprocedure(e.signature)
  left join pg_roles r on r.oid = p.proowner

  union all
  select '04_table', c.relname::text, jsonb_build_object(
    'owner', pg_get_userbyid(c.relowner),
    'rls_enabled', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity,
    'claim_owner_select', has_table_privilege(f.proowner, c.oid, 'SELECT'),
    'claim_owner_insert', has_table_privilege(f.proowner, c.oid, 'INSERT'),
    'claim_owner_update', has_table_privilege(f.proowner, c.oid, 'UPDATE'),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', policyname, 'permissive', permissive, 'roles', roles,
        'command', cmd, 'using', qual, 'with_check', with_check
      ) order by policyname)
      from pg_policies
      where schemaname = 'public' and tablename = c.relname
    ), '[]'::jsonb)
  )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_proc f
    on f.oid = to_regprocedure('public.claim_order_notification(uuid,text)')
  where n.nspname = 'public'
    and c.relname in ('order_notifications', 'orders', 'profiles')
)
select section, object_name, details
from report
order by section, object_name;
