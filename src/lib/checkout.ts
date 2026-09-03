import { supabase } from './supabase'

export async function startStripeCheckout(lines: Array<{ product_id: number; quantity: number; shade: string }>, shippingAddress: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('create-stripe-checkout', { body: { lines, shippingAddress } })
  if (error) throw error
  if (!data?.checkoutUrl) throw new Error('Checkout URL was not returned')
  window.location.assign(data.checkoutUrl)
}
