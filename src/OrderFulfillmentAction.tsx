import { useRef, useState } from 'react'
import { advanceOrderFulfillment } from './lib/admin'
import { nextFulfillmentStatus, orderStatusLabel, type FulfillmentOrder } from './lib/order-fulfillment'

export function OrderFulfillmentAction({ order, refresh }: { order: FulfillmentOrder & { id: string; order_reference: string }; refresh: () => Promise<void> }) {
  const lock = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const [carrier, setCarrier] = useState(''), [tracking, setTracking] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const next = nextFulfillmentStatus(order)
  if (!next) return null
  const advance = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await advanceOrderFulfillment(order.id, order.status, next, next === 'shipped' ? carrier : '', next === 'shipped' ? tracking : ''); dialog.current?.close(); await refresh() }
    catch { setError('The order may have changed or the update failed. Refresh orders before trying again.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="fulfillment-action"><button type="button" className="product-table-action" disabled={busy} onClick={() => {
    if (next === 'shipped') { setError(''); dialog.current?.showModal() }
    else if (window.confirm(`Mark ${order.order_reference} as ${orderStatusLabel(next)}?`)) void advance()
  }}>{busy ? 'Updating…' : `Mark as ${orderStatusLabel(next)}`}</button>
    <dialog ref={dialog} className="shipment-dialog" aria-label={`Ship order ${order.order_reference}`} onCancel={event => { if (busy) event.preventDefault() }}>
      <form onSubmit={event => { event.preventDefault(); return advance() }}>
        <h2>Ship order {order.order_reference}</h2><p>Confirm dispatch before marking this order Shipped. Tracking is optional.</p>
        <label>Carrier / delivery service (optional)<input autoFocus maxLength={120} value={carrier} onChange={event => setCarrier(event.target.value)} disabled={busy} /></label>
        <label>Tracking number / reference (optional)<input maxLength={200} value={tracking} onChange={event => setTracking(event.target.value)} disabled={busy} /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn dark" disabled={busy}>{busy ? 'Updating…' : 'Confirm shipment'}</button>
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
      </form>
    </dialog>
    {error && next !== 'shipped' && <p role="alert">{error}</p>}
  </div>
}
