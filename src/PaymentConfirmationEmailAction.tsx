import { useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { sendOrderEmail } from './lib/order-email'
import { paymentEmailState, type PaymentEmailNotification } from './lib/payment-email-state'

export function PaymentConfirmationEmailAction({ orderId, paymentStatus, notification, refresh }: {
  orderId: string
  paymentStatus: string
  notification?: PaymentEmailNotification
  refresh: () => Promise<unknown>
}) {
  const locked = useRef(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [message, setMessage] = useState('')
  const eligibility = paymentEmailState(paymentStatus, notification)

  const send = async () => {
    if (locked.current || sent || needsRefresh || !eligibility.canSend) return
    locked.current = true
    setSending(true)
    setMessage('Sending…')
    try {
      // Refresh authoritative eligibility before invoking. The RPC enforces admin
      // access and serializes claims across tabs/users even after this read.
      const { data: order, error } = await supabase.from('orders')
        .select('payment_status,order_notifications(event_type,status,last_error,sent_at,provider_message_id)')
        .eq('id', orderId).single()
      if (error || !order) throw new Error('Could not verify email status. Refresh the order before trying again.')
      const latest = order.order_notifications?.find(item => item.event_type === 'payment_confirmed')
      const current = paymentEmailState(order.payment_status, latest)
      if (!current.canSend) throw new Error(current.message)
      const result = await sendOrderEmail(orderId, 'payment_confirmed')
      setSent(true)
      setMessage(result.skipped ? 'Email already sent. No duplicate was sent.' : 'Email sent.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Email delivery is unconfirmed. Refresh to check its status.')
      setNeedsRefresh(true)
    } finally {
      try { await refresh() } catch { setNeedsRefresh(true) }
      setSending(false)
      locked.current = false
    }
  }

  const checkStatus = async () => {
    if (locked.current) return
    locked.current = true
    try { await refresh(); setNeedsRefresh(false); setMessage('') }
    catch { setMessage('Could not refresh delivery status. Try refreshing again.'); setNeedsRefresh(true) }
    finally { locked.current = false }
  }

  return <div>
    <button type="button" className="product-table-action"
      disabled={sending || sent || needsRefresh || !eligibility.canSend}
      onClick={() => void send()}>
      {sending ? 'Sending…' : sent || notification?.status === 'sent' ? 'Email sent' : 'Resend payment confirmation email'}
    </button>
    <p role="status" aria-live="polite">{message || eligibility.message}</p>
    {!sending && !sent && (needsRefresh || notification?.status === 'sending') &&
      <button type="button" className="product-table-action" onClick={() => void checkStatus()}>Refresh email status</button>}
  </div>
}
