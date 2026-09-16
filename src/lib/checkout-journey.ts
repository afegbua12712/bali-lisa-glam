import { contactLinks } from './support-pages'

export function availableQuantity(productId: number, inventory: number | undefined, bag: Array<{ id: number; quantity: number }>) {
  if (!Number.isFinite(inventory)) return 0
  return Math.max(0, (inventory ?? 0) - bag.filter(line => line.id === productId).reduce((sum, line) => sum + line.quantity, 0))
}

export function bagStockError(bag: Array<{ id: number; quantity: number }>, catalog: Array<{ id: number; inventory?: number }>) {
  return bag.some(line => {
    const product = catalog.find(item => item.id === line.id)
    return !product || !Number.isFinite(product.inventory) || bag.filter(item => item.id === line.id).reduce((sum, item) => sum + item.quantity, 0) > (product.inventory ?? 0)
  }) ? 'An item in your bag is unavailable or exceeds current stock. Please update your bag before ordering.' : ''
}

export function paymentContact(settings: { business_email?: string; whatsapp_number?: string } | null, method: string) {
  const links = contactLinks(settings ?? {})
  return method === 'manual_whatsapp' ? links.whatsapp?.href : links.email?.href
}

export function paymentHref(contact: string, method: string, orderNumber: number, message: string) {
  return method === 'manual_whatsapp' ? `${contact}?text=${encodeURIComponent(message)}`
    : `${contact}?subject=${encodeURIComponent(`Payment Request - Order #${orderNumber}`)}&body=${encodeURIComponent(message)}`
}

export function readCheckoutDraft(storage: Pick<Storage, 'getItem'>): Record<string, string> {
  try {
    const value = JSON.parse(storage.getItem('blg-checkout-draft') ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { country: 'Canada' }
    const fields = ['first_name', 'last_name', 'email', 'phone', 'address', 'unit', 'city', 'province', 'postal_code', 'country']
    return { country: 'Canada', ...Object.fromEntries(Object.entries(value).filter(([key, entry]) => fields.includes(key) && typeof entry === 'string')) }
  } catch { return { country: 'Canada' } }
}
