import { useRef, useState } from 'react'
import { paymentEmailState, type PaymentEmailNotification } from './lib/payment-email-state'
import { sendOrderEmail } from './lib/order-email'

export function ShipmentEmailAction({ order, refresh }: { order: { id: string; status: string; order_notifications?: (PaymentEmailNotification & { event_type: string })[] }; refresh: () => Promise<void> }) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const event = order.status === 'shipped' ? 'order_shipped' : order.status === 'delivered' ? 'order_delivered' : null
  if (!event) return null
  const notification = order.order_notifications?.find(item => item.event_type === event)
  return <div className="shipment-email"><button type="button" className="product-table-action" disabled={busy || !paymentEmailState('paid', notification).canSend} onClick={async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    try { await sendOrderEmail(order.id, event); setMessage('Notification sent.'); await refresh() }
    catch { setMessage('Email delivery could not be confirmed. Refresh notification status before retrying. Fulfillment is unchanged.') }
    finally { lock.current = false; setBusy(false) }
  }}>{busy ? 'Sending…' : notification?.status === 'sent' ? 'Notification sent' : `Send ${event === 'order_shipped' ? 'shipment' : 'delivery'} notification`}</button>{message && <p role="status">{message}</p>}</div>
}
