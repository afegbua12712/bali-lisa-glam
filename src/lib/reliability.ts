import type { OptionSelection } from './product-options'

type SavedLine = { id: number; name: string; category: string; price: number; rating: number; reviews: number; image: string; description: string; shades: string[]; shade: string; quantity: number; selected_options?: OptionSelection[] }
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 10000
const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readSavedCart(storage: Pick<Storage, 'getItem'>): SavedLine[] {
  try {
    const value = JSON.parse(storage.getItem('blg-cart') ?? '[]')
    if (!Array.isArray(value) || value.length > 500) return []
    let total = 0
    let quantity = 0
    return value.map((line): SavedLine => {
      if (!line || !positiveInteger(line.id) || !positiveInteger(line.quantity) || !number(line.price)
        || !Number.isFinite(line.price * line.quantity)
        || !['name', 'category', 'image', 'description', 'shade'].every(key => text(line[key]))
        || !number(line.rating) || !number(line.reviews) || !Array.isArray(line.shades) || !line.shades.every(text)
        || !/^(https?:\/\/|\/(?!\/))/.test(line.image)) throw new Error('Invalid saved cart')
      total += line.price * line.quantity
      quantity += line.quantity
      if (!Number.isFinite(total) || !Number.isSafeInteger(quantity)) throw new Error('Invalid saved cart totals')
      let selected_options: OptionSelection[] | undefined
      if (line.selected_options !== undefined) {
        if (!Array.isArray(line.selected_options) || line.selected_options.length > 20) throw new Error('Invalid selections')
        selected_options = line.selected_options.map((choice: OptionSelection) => {
          if (!choice || !['group_id', 'value_id', 'name', 'value'].every(key => text(choice[key as keyof OptionSelection]))
            || !uuid.test(choice.group_id) || !uuid.test(choice.value_id)) throw new Error('Invalid selection')
          return { group_id: choice.group_id, value_id: choice.value_id, name: choice.name, value: choice.value }
        })
        if (new Set(selected_options!.map(choice => choice.group_id)).size !== selected_options!.length) throw new Error('Duplicate selection')
      }
      return { id: line.id, name: line.name, category: line.category, price: line.price, rating: line.rating, reviews: line.reviews,
        image: line.image, description: line.description, shades: [...line.shades], shade: line.shade, quantity: line.quantity, selected_options }
    })
  } catch { return [] }
}

// Call sites supply fixed operation labels; never output exception messages/objects.
export function logOperationFailure(operation: string, error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  const category = typeof code === 'string' && ['42501', '23503', '23505', 'P0001', 'BLG01'].includes(code) ? code : 'operation_failed'
  console.error(operation, { category })
}

export function productDeletionMessage(error: unknown) {
  return error && typeof error === 'object' && 'code' in error && error.code === 'BLG01'
    ? 'This product has outstanding inventory reservations. Archive it, or resolve those orders before permanently deleting it.'
    : 'Product could not be deleted.'
}

export function expiredReservation(order: { payment_status?: string; inventory_reservation_status?: string; payment_expires_at?: string | null; paid_at?: string | null; status?: string }, now = Date.now()) {
  return order.payment_status === 'awaiting_payment' && order.inventory_reservation_status === 'reserved'
    && !order.paid_at && !['paid', 'fulfilled', 'cancelled', 'refunded'].includes(order.status ?? '')
    && !!order.payment_expires_at && Date.parse(order.payment_expires_at) <= now
}
