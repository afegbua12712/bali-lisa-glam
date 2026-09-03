import { supabase } from './supabase'

const PRODUCT_IMAGES_BUCKET = 'product-images'
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type AdminProductInput = {
  name: string; slug: string; description: string; price_cents: number; inventory_quantity: number
  category_id: number | null; image_url: string; shades: string[]; is_active: boolean
}

export async function fetchAdminProducts(query = '') {
  let request = supabase.from('products').select('id,name,slug,description,price_cents,inventory_quantity,is_active,image_url,shades,created_at,categories(id,name)').order('created_at', { ascending: false })
  if (query.trim()) request = request.ilike('name', `%${query.trim()}%`)
  const { data, error } = await request
  if (error) throw error
  return data ?? []
}

export async function fetchAdminCategories() {
  const { data, error } = await supabase.from('categories').select('id,name,slug').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function saveAdminProduct(input: AdminProductInput, id?: number) {
  const payload: AdminProductInput & { updated_at: string } = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description.trim(),
    price_cents: Number(input.price_cents),
    inventory_quantity: Number(input.inventory_quantity),
    category_id: input.category_id ?? null,
    image_url: input.image_url.trim(),
    shades: Array.isArray(input.shades) && input.shades.length ? input.shades : ['Universal'],
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  }
  const request = id ? supabase.from('products').update(payload).eq('id', id) : supabase.from('products').insert(payload)
  const { data, error } = await request.select().single()
  if (error) throw error
  return data
}

export async function archiveProduct(id: number) {
  const { error } = await supabase.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function restoreProduct(id: number) {
  const { error } = await supabase.from('products').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteAdminProduct(id: number) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function uploadProductImage(file: File) {
  if (!IMAGE_MIME_TYPES.has(file.type)) throw new Error('Choose a JPG, PNG, or WEBP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.')

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `products/${crypto.randomUUID()}.${extension}`
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (error) throw error

  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(data.path).data.publicUrl
}

export async function fetchAdminOrders() {
  const { data, error } = await supabase.from('orders').select('id,order_number,status,payment_method,payment_status,paid_at,payment_expires_at,inventory_reservation_status,inventory_restored_at,cancellation_reason,archived_at,currency,total_cents,subtotal_cents,shipping_cents,shipping_address,created_at,profiles(email,first_name,last_name),order_items(product_name,shade,quantity,unit_price_cents)').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function archiveOrders(ids: string[]) {
  const { error } = await supabase.from('orders').update({ archived_at: new Date().toISOString() }).in('id', ids)
  if (error) throw error
}

export async function restoreOrder(id: string) {
  const { error } = await supabase.from('orders').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

export async function deleteOrders(ids: string[]) {
  const { error } = await supabase.from('orders').delete().in('id', ids)
  if (error) throw error
}

export async function updateOrderStatus(id: string, status: 'pending'|'paid'|'fulfilled'|'cancelled'|'refunded') {
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function confirmManualPayment(id: string) {
  const { error } = await supabase.rpc('confirm_manual_payment', { target_order_id: id })
  if (error) throw error
}

export async function cancelUnpaidOrder(id: string, reason = 'Cancelled by administrator') {
  const { error } = await supabase.rpc('cancel_unpaid_order', { target_order_id: id, reason })
  if (error) throw error
}

export async function fetchCustomers() {
  const { data, error } = await supabase.from('profiles').select('id,email,first_name,last_name,role,created_at,orders(total_cents)').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSettings() {
  const { data, error } = await supabase.from('website_settings').select('*').eq('id', true).single()
  if (error) throw error
  return data
}

export async function saveSettings(settings: Record<string, unknown>) {
  const { error } = await supabase.from('website_settings').upsert({ id: true, ...settings, updated_at: new Date().toISOString() })
  if (error) throw error
}
