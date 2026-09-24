export function ShipmentDetails({ order }: { order: { status: string; shipping_method?: string | null; shipment_carrier?: string | null; tracking_number?: string | null } }) {
  return <section className="shipment-details" aria-label="Shipping information">
    <p>Shipping method: <strong>{order.shipping_method || 'Not recorded for this historical order'}</strong></p>
    {['shipped', 'delivered'].includes(order.status) && <>
      {order.shipment_carrier && <p>Carrier / delivery service: <strong>{order.shipment_carrier}</strong></p>}
      <p>Tracking number / reference: <strong>{order.tracking_number || 'No tracking provided'}</strong></p>
    </>}
  </section>
}
