import { supabase } from './supabase'

export async function getCustomerAccount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')
  const [{ data: profile, error: profileError }, { data: orders, error: orderError }, { data: address, error: addressError }] = await Promise.all([
    supabase.from('profiles').select('first_name,last_name,email,phone').eq('id', user.id).single(),
    supabase.from('orders').select('id,order_reference,status,processing_at,shipped_at,delivered_at,payment_method,payment_status,paid_at,payment_expires_at,currency,total_cents,subtotal_cents,shipping_cents,shipping_address,created_at,order_items(product_id,product_name,shade,selected_options,quantity,unit_price_cents)').eq('customer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('customer_addresses').select('*').eq('customer_id', user.id).maybeSingle(),
  ])
  if (profileError || orderError || addressError) throw profileError ?? orderError ?? addressError
  return { user, profile, orders: orders ?? [], address }
}
export async function saveCustomerProfile(input: Record<string, string>, expectedCustomerId?: string) { const { data:{user} }=await supabase.auth.getUser(); if(!user || (expectedCustomerId && user.id !== expectedCustomerId)) throw new Error('Sign in required'); const {error}=await supabase.from('profiles').update({first_name:input.first_name,last_name:input.last_name,phone:input.phone,updated_at:new Date().toISOString()}).eq('id',user.id); if(error) throw error }
export async function getReorderItems(orderId: string, customerId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== customerId) throw new Error('Sign in required')
  const { data, error } = await supabase.from('orders').select('order_items(product_id,product_name,shade,selected_options,quantity,unit_price_cents)').eq('id', orderId).eq('customer_id', user.id).single()
  if (error || !data) throw new Error('Could not load this order')
  return data.order_items
}
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
