import { supabase } from './supabase'

export async function getCustomerAccount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')
  const [{ data: profile, error: profileError }, { data: orders, error: orderError }, { data: address, error: addressError }, { data: wishlist, error: wishlistError }] = await Promise.all([
    supabase.from('profiles').select('first_name,last_name,email,phone,role').eq('id', user.id).single(),
    supabase.from('orders').select('id,order_reference,status,processing_at,shipped_at,delivered_at,payment_method,payment_status,paid_at,payment_expires_at,inventory_reservation_status,inventory_restored_at,cancellation_reason,currency,total_cents,subtotal_cents,shipping_cents,shipping_address,created_at,order_items(product_name,shade,quantity,unit_price_cents,products(image_url))').order('created_at', { ascending: false }),
    supabase.from('customer_addresses').select('*').eq('customer_id', user.id).maybeSingle(),
    supabase.from('wishlists').select('product_id,products(id,name,price_cents,image_url,is_active,inventory_quantity)').order('created_at', { ascending: false }),
  ])
  if (profileError || orderError || addressError || wishlistError) throw profileError ?? orderError ?? addressError ?? wishlistError
  return { user, profile, orders: orders ?? [], address, wishlist: wishlist ?? [] }
}
export async function saveCustomerProfile(input: Record<string, string>) { const { data:{user} }=await supabase.auth.getUser(); if(!user) throw new Error('Sign in required'); const {error}=await supabase.from('profiles').update({first_name:input.first_name,last_name:input.last_name,phone:input.phone,updated_at:new Date().toISOString()}).eq('id',user.id); if(error) throw error }
export async function getCustomerDelivery(customerId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== customerId) throw new Error('Sign in required')
  const [profileResult, addressResult] = await Promise.all([
    supabase.from('profiles').select('first_name,last_name,email,phone').eq('id', user.id).single(),
    supabase.from('customer_addresses').select('first_name,last_name,address,unit,country,province,city,postal_code,phone').eq('customer_id', user.id).maybeSingle(),
  ])
  if (profileResult.error || addressResult.error) throw profileResult.error ?? addressResult.error
  return { user, profile: profileResult.data, address: addressResult.data }
}
export async function saveCustomerAddress(input: Record<string, string>, expectedCustomerId?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (expectedCustomerId && user.id !== expectedCustomerId)) throw new Error('Sign in required')
  // Only address columns are writable; never spread caller-supplied ownership or profile fields.
  const fields = ['first_name', 'last_name', 'address', 'unit', 'country', 'province', 'city', 'postal_code', 'phone']
  const address = Object.fromEntries(fields.map(key => [key, typeof input[key] === 'string' ? input[key].trim() : key === 'country' ? 'Canada' : '']))
  const { error } = await supabase.from('customer_addresses').upsert({ ...address, customer_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' })
  if (error) throw error
}
export async function toggleWishlist(productId:number, saved:boolean) { const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Sign in required'); const q=saved?supabase.from('wishlists').delete().eq('customer_id',user.id).eq('product_id',productId):supabase.from('wishlists').upsert({customer_id:user.id,product_id:productId}); const {error}=await q; if(error) throw error }
