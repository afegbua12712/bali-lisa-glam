import { supabase } from './supabase'

export type OrderEmailEvent = 'order_created' | 'payment_confirmed' | 'order_shipped' | 'order_delivered'

export async function sendOrderEmail(orderId: string, eventType: OrderEmailEvent) {
  const { data, error } = await supabase.functions.invoke('send-order-email', {
    body: { order_id: orderId, event_type: eventType },
  })
  if (error) {
    const status = error.context instanceof Response ? error.context.status : undefined
    if (status === 401) throw new Error('Your session could not be verified. Sign in again before retrying.')
    if (status === 403) throw new Error('The email could not be claimed. Refresh the order and verify administrator access and payment status.')
    throw new Error('Email delivery could not be confirmed. Check the delivery status before retrying.')
  }
  if (data?.sent !== true || data?.status !== 'sent') {
    throw new Error(data?.status === 'sending'
      ? 'An email attempt is already in progress. Refresh the order later to check delivery.'
      : 'Email delivery could not be confirmed. Check the delivery status before retrying.')
  }
  return data as { sent: boolean; status: 'sending' | 'sent' | 'failed'; skipped?: boolean }
}
