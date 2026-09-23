export type FulfillmentOrder = {
  status: string; payment_status: string; inventory_reservation_status?: string | null
  created_at: string; paid_at?: string | null; processing_at?: string | null
  shipped_at?: string | null; delivered_at?: string | null
}
export const orderStatusLabel = (status?: string | null) => ({
  pending: 'Order Placed', paid: 'Order Placed', processing: 'Processing', shipped: 'Shipped',
  delivered: 'Delivered', fulfilled: 'Fulfilled (legacy)', cancelled: 'Cancelled', refunded: 'Refunded',
})[status ?? ''] ?? 'Status unavailable'

export function nextFulfillmentStatus(order: Pick<FulfillmentOrder, 'status' | 'payment_status' | 'inventory_reservation_status'>) {
  if (order.payment_status !== 'paid' || ['reserved', 'restored'].includes(order.inventory_reservation_status ?? '')) return null
  return ({ pending: 'processing', paid: 'processing', processing: 'shipped', shipped: 'delivered' } as const)[order.status as 'pending' | 'paid' | 'processing' | 'shipped'] ?? null
}

export function orderProgress(order: FulfillmentOrder) {
  const stage = ['processing', 'shipped', 'delivered'].indexOf(order.status)
  return [
    { label: 'Order Placed', complete: true, date: order.created_at },
    { label: 'Payment Confirmed', complete: order.payment_status === 'paid', date: order.payment_status === 'paid' ? order.paid_at : null },
    { label: 'Processing', complete: stage >= 0, date: order.processing_at },
    { label: 'Shipped', complete: stage >= 1, date: order.shipped_at },
    { label: 'Delivered', complete: stage >= 2, date: order.delivered_at },
  ]
}
