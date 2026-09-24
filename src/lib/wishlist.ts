import { supabase } from './supabase'

async function wishlistOwner(expectedCustomerId: string) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.id !== expectedCustomerId) throw new Error('Sign in required')
  return user.id
}
export async function getWishlist(customerId: string): Promise<number[]> {
  const owner = await wishlistOwner(customerId)
  const { data, error } = await supabase.from('wishlists').select('product_id').eq('customer_id', owner).order('created_at', { ascending: false })
  if (error) throw error
  return [...new Set((data ?? []).map(row => Number(row.product_id)))]
}
export async function setFavorite(productId: number, saved: boolean, customerId: string) {
  const owner = await wishlistOwner(customerId)
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error('Invalid product')
  const query = saved
    ? supabase.from('wishlists').upsert({ customer_id: owner, product_id: productId }, { onConflict: 'customer_id,product_id', ignoreDuplicates: true })
    : supabase.from('wishlists').delete().eq('customer_id', owner).eq('product_id', productId)
  const { error } = await query
  if (error) throw error
}
