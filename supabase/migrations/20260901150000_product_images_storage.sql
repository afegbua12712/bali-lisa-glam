-- Product image uploads for Studio. Apply this migration once through Supabase.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "public reads product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

create policy "admins upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());
