type OperationalOrder = { customer_id?: string; total_cents: number; currency?: string | null; status: string; payment_status?: string | null; inventory_reservation_status?: string | null; created_at: string }
type InventoryProduct = { name: string; is_active: boolean; inventory_quantity: number; categories?: { name: string } | null }
export const LOW_STOCK_LIMIT = 5
export const confirmedOrder = (order: OperationalOrder) => order.payment_status === 'paid' && order.inventory_reservation_status === 'committed' && !['cancelled', 'refunded'].includes(order.status)
export function confirmedTotals(orders: OperationalOrder[]) {
  const totals: Record<string, number> = {}
  for (const order of orders.filter(confirmedOrder)) {
    const currency = order.currency || 'CAD'
    totals[currency] = (totals[currency] ?? 0) + order.total_cents
  }
  return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b))
}
export function studioMetrics(products: InventoryProduct[], orders: OperationalOrder[], customers: { role?: string }[]) {
  const active = products.filter(product => product.is_active)
  return {
    totalOrders: orders.length, awaitingPayment: orders.filter(o => o.payment_status === 'awaiting_payment' && o.status === 'pending').length,
    paidOrders: orders.filter(confirmedOrder).length,
    processing: orders.filter(o => o.status === 'processing').length, shipped: orders.filter(o => o.status === 'shipped').length, delivered: orders.filter(o => o.status === 'delivered').length,
    customers: customers.filter(c => c.role === 'customer').length, activeProducts: active.length,
    lowStock: active.filter(p => p.inventory_quantity > 0 && p.inventory_quantity <= LOW_STOCK_LIMIT).length,
    outOfStock: active.filter(p => p.inventory_quantity <= 0).length, totals: confirmedTotals(orders),
  }
}
export function filterStudioProducts<P extends InventoryProduct>(products: P[], query: string, stock: string) {
  const search = query.trim().toLocaleLowerCase()
  return products.filter(p => `${p.name} ${p.categories?.name ?? ''}`.toLocaleLowerCase().includes(search)
    && (stock === 'all' || (stock === 'archived' ? !p.is_active : p.is_active && (stock === 'active' || (stock === 'out' ? p.inventory_quantity <= 0 : p.inventory_quantity > 0 && p.inventory_quantity <= LOW_STOCK_LIMIT)))))
}
export function customerActivity(id: string, orders: OperationalOrder[]) {
  const own = orders.filter(order => order.customer_id === id)
  return { count: own.length, totals: confirmedTotals(own), latest: own.map(o => o.created_at).sort().at(-1) }
}
