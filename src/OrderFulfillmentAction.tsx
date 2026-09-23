import { useRef, useState } from 'react'
import { advanceOrderFulfillment } from './lib/admin'
import { nextFulfillmentStatus, orderStatusLabel, type FulfillmentOrder } from './lib/order-fulfillment'

export function OrderFulfillmentAction({ order, refresh }: { order: FulfillmentOrder & { id: string; order_reference: string }; refresh: () => Promise<void> }) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const next = nextFulfillmentStatus(order)
  if (!next) return null
  return <div className="fulfillment-action"><button type="button" className="product-table-action" disabled={busy} onClick={async () => {
    if (lock.current || !window.confirm(`Mark ${order.order_reference} as ${orderStatusLabel(next)}?`)) return
    lock.current = true; setBusy(true); setError('')
    try { await advanceOrderFulfillment(order.id, order.status, next); await refresh() }
    catch { setError('The order may have changed or the update failed. Refresh orders before trying again.') }
    finally { lock.current = false; setBusy(false) }
  }}>{busy ? 'Updating…' : `Mark as ${orderStatusLabel(next)}`}</button>{error && <p role="alert">{error}</p>}</div>
}
