import { selectProductOptions, type OptionGroup, type OptionSelection } from './product-options'

type BrowsingProduct = { id: number; name: string; category: string; description: string; price: number; inventory?: number; rating: number; reviews: number; createdAt?: string; categoryActive?: boolean; categoryOrder?: number; image: string; categoryImage?: string }
export type ShopFilters = { query: string; category: string; minPrice: string; maxPrice: string; availability: string; sort: string }
export const emptyFilters: ShopFilters = { query: '', category: 'All', minPrice: '', maxPrice: '', availability: 'all', sort: 'Featured' }
export const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
export const inStock = (inventory?: number) => Number.isSafeInteger(inventory) && inventory! > 0
export function priceRangeError(min: string, max: string) {
  if ([min, max].some(value => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))) return 'Enter a price of zero or more.'
  return min.trim() && max.trim() && Number(min) > Number(max) ? 'Minimum price must not exceed maximum price.' : ''
}
export function browseProducts<P extends BrowsingProduct>(catalog: P[], filters: ShopFilters): P[] {
  if (priceRangeError(filters.minPrice, filters.maxPrice)) return []
  const terms = normalizeSearch(filters.query).split(' ').filter(Boolean)
  const result = catalog.filter(product => {
    const text = normalizeSearch(`${product.name} ${product.categoryActive === false ? '' : product.category} ${product.description}`)
    return (filters.category === 'All' || (product.categoryActive !== false && product.category === filters.category))
      && terms.every(term => text.includes(term))
      && (!filters.minPrice.trim() || product.price >= Number(filters.minPrice))
      && (!filters.maxPrice.trim() || product.price <= Number(filters.maxPrice))
      && (filters.availability === 'all' || (filters.availability === 'in-stock' ? inStock(product.inventory) : !inStock(product.inventory)))
  })
  if (filters.sort === 'Featured') return result // Existing curated/catalog order; no invented popularity.
  return result.sort((a, b) => {
    const date = (p: P) => Number.isFinite(Date.parse(p.createdAt ?? '')) ? Date.parse(p.createdAt!) : 0
    const order = filters.sort === 'Price: low to high' ? a.price - b.price
      : filters.sort === 'Price: high to low' ? b.price - a.price
        : filters.sort === 'Top rated' ? Number(b.reviews > 0) - Number(a.reviews > 0) || (b.reviews ? b.rating : 0) - (a.reviews ? a.rating : 0) || b.reviews - a.reviews
          : filters.sort === 'Newest' ? date(b) - date(a) : 0
    return order || a.id - b.id
  })
}
export function storefrontCategories<P extends BrowsingProduct>(catalog: P[]) {
  return [...new Map(catalog.filter(p => p.categoryActive !== false && p.category).map(p => [p.category, { name: p.category, image: p.categoryImage || p.image, order: p.categoryOrder ?? 0 }])).values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}
type BagProduct = { id: number; price: number; inventory?: number; options?: OptionGroup[] }
type BagItem = { id: number; price: number; quantity: number; selected_options?: OptionSelection[]; previousPrice?: number }
export function bagItemIssue(line: BagItem, catalog: BagProduct[], bag: BagItem[]) {
  const product = catalog.find(p => p.id === line.id)
  if (!product) return 'No longer available. Remove this item to continue.'
  if (!inStock(product.inventory)) return 'Out of stock. Remove this item to continue.'
  if (bag.filter(item => item.id === line.id).reduce((sum, item) => sum + item.quantity, 0) > product.inventory!) return 'Your bag exceeds current stock. Reduce the quantity or remove this item.'
  const choices = line.selected_options ?? []
  // Legacy option bags must revisit the product instead of guessing a selection.
  const result = selectProductOptions(product.options ?? [], Object.fromEntries(choices.map(choice => [choice.group_id, choice.value_id])))
  if (result.error || result.choices.length !== choices.length || result.choices.some(choice => !choices.some(old => old.group_id === choice.group_id && old.value_id === choice.value_id && old.name === choice.name && old.value === choice.value)) || new Set(choices.map(choice => choice.group_id)).size !== choices.length) return 'These options have changed. Remove this item and choose its options again.'
  return ''
}
export function refreshBagPrices<L extends BagItem>(bag: L[], catalog: BagProduct[]): L[] {
  let changed = false
  const next = bag.map(line => {
    const product = catalog.find(p => p.id === line.id)
    if (!product || !Number.isFinite(product.price) || product.price < 0 || product.price === line.price) return line
    changed = true
    return { ...line, previousPrice: line.price, price: product.price }
  })
  return changed ? next : bag
}
