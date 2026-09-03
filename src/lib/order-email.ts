import { supabase } from './supabase'

export type OrderEmailEvent = 'order_created' | 'payment_confirmed'

export async function sendOrderEmail(orderId: string, eventType: OrderEmailEvent) {
  const { data, error } = await supabase.functions.invoke('send-order-email', {
    body: { order_id: orderId, event_type: eventType },
  })
  if (error) throw error
  if (!data?.sent && data?.status === 'failed') throw new Error('Transactional email failed')
  return data as { sent: boolean; status: 'sending' | 'sent' | 'failed'; skipped?: boolean }
}
