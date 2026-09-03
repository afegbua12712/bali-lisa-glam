import { supabase } from './supabase'

export type ManualPaymentMethod = 'manual_whatsapp' | 'manual_email'

export async function createManualOrder(lines: Array<{ product_id: number; quantity: number; shade: string }>, shippingAddress: Record<string, string>, method: ManualPaymentMethod) {
  const { data, error } = await supabase.rpc('create_manual_order', { lines, shipping_address: shippingAddress, selected_payment_method: method })
  if (error) throw error
  return (data as Array<{ order_id: string; order_number: number; total_cents: number }>)[0]
}

export async function getManualOrderSummary(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number, subtotal_cents, shipping_cents, total_cents, currency, order_items(product_name, shade, quantity, unit_price_cents)')
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data as {
    order_number: number
    subtotal_cents: number
    shipping_cents: number
    total_cents: number
    currency: string
    order_items: Array<{ product_name: string; shade: string | null; quantity: number; unit_price_cents: number }>
  }
}

export async function getPublicPaymentSettings() {
  const { data, error } = await supabase.from('website_settings').select('business_email,whatsapp_number,free_shipping_threshold_cents,standard_shipping_cents,bank_transfer_instructions').eq('id', true).single()
  if (error) throw error
  return data
}
