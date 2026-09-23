import { orderProgress, orderStatusLabel, type FulfillmentOrder } from './lib/order-fulfillment'

export function OrderProgress({ order }: { order: FulfillmentOrder }) {
  return <div className="order-fulfillment">
    <p>Fulfillment: <strong>{orderStatusLabel(order.status)}</strong></p>
    {['fulfilled', 'cancelled', 'refunded'].includes(order.status) ?
      <p>{order.status === 'fulfilled' ? 'Historical fulfillment recorded; individual shipment and delivery dates are unavailable.' : 'This order is not progressing through fulfillment.'}</p> :
      <ol className="order-progress" aria-label="Order progress">{orderProgress(order).map(stage =>
        <li key={stage.label} className={stage.complete ? 'complete' : ''}>
          <span aria-hidden="true">{stage.complete ? '✓' : '○'}</span>
          <span>{stage.label}<span className="sr-only">{stage.complete ? ': completed' : ': pending'}</span>
            {stage.complete && stage.date && <time dateTime={stage.date}>{new Date(stage.date).toLocaleString('en-CA')}</time>}
          </span>
        </li>)}</ol>}
  </div>
}
