import { cartLineKey, optionSummary, selectProductOptions, type OptionGroup, type OptionSelection } from './product-options'

export type ReorderItem = { product_id: number | null; product_name: string; quantity: number; shade?: string | null; selected_options?: OptionSelection[] | null; unit_price_cents: number }
type CurrentProduct = { id: number; name: string; price: number; inventory?: number; options?: OptionGroup[]; shades: string[] }
type BagLine<P> = P & { quantity: number; shade: string; selected_options?: OptionSelection[] }

function matchOptions(item: ReorderItem, groups: OptionGroup[]) {
  const selected: Record<string, string> = {}
  if (item.selected_options != null && !Array.isArray(item.selected_options)) return null
  for (const old of item.selected_options ?? []) {
    if (!old || typeof old.name !== 'string' || typeof old.value !== 'string') return null
    const matches = groups.filter(group => old.group_id ? group.id === old.group_id && group.name === old.name : group.name === old.name)
    if (matches.length !== 1 || selected[matches[0].id]) return null
    const values = matches[0].values.filter(value => value.active && value.label === old.value && (!old.value_id || value.id === old.value_id))
    if (values.length !== 1) return null
    selected[matches[0].id] = values[0].id
  }
  if (!item.selected_options?.length && item.shade && item.shade !== 'Universal') {
    // Only the original single Shade choice is unambiguous without a snapshot.
    const matches = groups.filter(group => group.name === 'Shade')
    if (matches.length !== 1) return null
    const values = matches[0].values.filter(value => value.active && value.label === item.shade)
    if (values.length !== 1) return null
    selected[matches[0].id] = values[0].id
  }
  const result = selectProductOptions(groups, selected)
  return result.error ? null : result.choices
}

// catalog must be freshly fetched active storefront products. No order or payment writes.
export function planReorder<P extends CurrentProduct>(items: ReorderItem[], catalog: P[], bag: BagLine<P>[]) {
  let cart = [...bag]
  let added = 0
  const notices: string[] = []
  for (const item of items) {
    const product = catalog.find(product => product.id === item.product_id)
    if (!product || !Number.isFinite(product.price) || product.price < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      notices.push(`${item.product_name}: no longer available.`); continue
    }
    const choices = matchOptions(item, product.options ?? [])
    if (!choices) { notices.push(`${item.product_name}: the previous options are unavailable or have changed. Please choose again from the shop.`); continue }
    const stock = Number.isSafeInteger(product.inventory) ? Math.max(0, product.inventory!) : 0
    const inBag = cart.filter(line => line.id === product.id).reduce((sum, line) => sum + line.quantity, 0)
    const quantity = Math.min(item.quantity, Math.max(0, stock - inBag))
    if (!quantity) { notices.push(`${item.product_name}: no more stock is available to add to your bag.`); continue }
    const line = { ...product, quantity, selected_options: choices, shade: optionSummary(choices) }
    const key = cartLineKey(line)
    const existing = cart.find(entry => cartLineKey(entry) === key)
    cart = existing ? cart.map(entry => cartLineKey(entry) === key ? { ...line, quantity: entry.quantity + quantity } : entry) : [...cart, line]
    added += quantity
    if (quantity < item.quantity) notices.push(`${item.product_name}: added ${quantity} of ${item.quantity} requested because of current stock.`)
    if (Math.round(product.price * 100) !== item.unit_price_cents) notices.push(`${item.product_name}: the price has changed; your bag uses the current price.`)
  }
  const message = added ? `${added} ${added === 1 ? 'item' : 'items'} added to your bag at current prices. Review your bag before checkout.` : 'None of these items can currently be added. Your existing bag is unchanged.'
  return { cart: added ? cart : bag, added, message, notices }
}
