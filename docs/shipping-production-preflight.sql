-- READ ONLY: run against actual production before authorizing any migration.
begin read only;
select current_database(),current_user,version();
select table_name,column_name,data_type,is_nullable,column_default,is_generated from information_schema.columns
where table_schema='public' and table_name in ('orders','website_settings','order_notifications') order by table_name,ordinal_position;
select t.typname,e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname in ('order_status','app_role') order by e.enumsortorder;
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c where c.oid in ('public.orders'::regclass,'public.order_items'::regclass,'public.website_settings'::regclass,'public.order_notifications'::regclass);
select * from pg_policies where schemaname='public' and tablename in ('orders','order_items','website_settings','profiles','order_notifications');
select conrelid::regclass,conname,pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.orders'::regclass,'public.website_settings'::regclass,'public.order_notifications'::regclass);
select tgrelid::regclass,tgname,pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid='public.orders'::regclass;
select p.oid::regprocedure,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_admin','create_order','create_manual_order','create_manual_order_with_reference','advance_order_fulfillment','record_order_shipment','snapshot_order_shipping','claim_order_notification','confirm_manual_payment','cancel_unpaid_order','protect_order_identity');
select grantee,table_name,privilege_type from information_schema.table_privileges where table_schema='public' and table_name in ('orders','order_notifications','website_settings');
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges where table_schema='public' and table_name='orders';
select r,has_table_privilege(r,'public.orders','UPDATE') as order_update,has_any_column_privilege(r,'public.orders','INSERT') as order_insert from unnest(array['anon','authenticated'])r;
select standard_shipping_cents,free_shipping_threshold_cents,international_standard_shipping_cents,international_free_shipping_threshold_cents from public.website_settings where id=true;
-- Aggregate only: do not export customer addresses or tracking information.
select status,payment_status,inventory_reservation_status,count(*) from public.orders group by 1,2,3;
select event_type,status,count(*) from public.order_notifications group by 1,2;
rollback;
