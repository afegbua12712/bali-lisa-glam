import { supabase } from './supabase'

export async function getCustomerAccount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')
  const [{ data: profile, error: profileError }, { data: orders, error: orderError }, { data: address, error: addressError }, { data: wishlist, error: wishlistError }] = await Promise.all([
    supabase.from('profiles').select('first_name,last_name,email,phone,role').eq('id', user.id).single(),
    supabase.from('orders').select('id,order_number,status,payment_method,payment_status,paid_at,total_cents,subtotal_cents,shipping_cents,shipping_address,created_at,order_items(product_name,shade,quantity,unit_price_cents,products(image_url))').order('created_at', { ascending: false }),
    supabase.from('customer_addresses').select('*').eq('customer_id', user.id).maybeSingle(),
    supabase.from('wishlists').select('product_id,products(id,name,price_cents,image_url,is_active,inventory_quantity)').order('created_at', { ascending: false }),
  ])
  if (profileError || orderError || addressError || wishlistError) throw profileError ?? orderError ?? addressError ?? wishlistError
  return { user, profile, orders: orders ?? [], address, wishlist: wishlist ?? [] }
}
export async function saveCustomerProfile(input: Record<string, string>) { const { data:{user} }=await supabase.auth.getUser(); if(!user) throw new Error('Sign in required'); const {error}=await supabase.from('profiles').update({first_name:input.first_name,last_name:input.last_name,phone:input.phone,updated_at:new Date().toISOString()}).eq('id',user.id); if(error) throw error }
export async function saveCustomerAddress(input: Record<string, string>) { const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Sign in required'); const {error}=await supabase.from('customer_addresses').upsert({customer_id:user.id,...input,updated_at:new Date().toISOString()}); if(error) throw error }
export async function toggleWishlist(productId:number, saved:boolean) { const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Sign in required'); const q=saved?supabase.from('wishlists').delete().eq('customer_id',user.id).eq('product_id',productId):supabase.from('wishlists').upsert({customer_id:user.id,product_id:productId}); const {error}=await q; if(error) throw error }
