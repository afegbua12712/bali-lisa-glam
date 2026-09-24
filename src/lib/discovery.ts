type CatalogItem = { id: number; category: string; inventory?: number; is_active?: boolean }
export const RECENT_KEY = 'blg-recent-products-v1'
export const RECENT_LIMIT = 8
type StorageReader = Pick<Storage, 'getItem'>

export function readRecent(storage: StorageReader): number[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].slice(0, RECENT_LIMIT) : []
  } catch { return [] }
}
export function rememberProduct(ids: number[], id: number): number[] {
  return Number.isSafeInteger(id) && id > 0 ? [id, ...ids.filter(value => value !== id)].slice(0, RECENT_LIMIT) : ids
}
// Inputs come from fetchProducts(), which explicitly selects only active products.
const available = (p: CatalogItem) => p.is_active !== false && (p.inventory ?? 0) > 0
export function relatedProducts<P extends CatalogItem>(current: P, catalog: P[], limit = 4): P[] {
  const unique = [...new Map(catalog.filter(p => p.id !== current.id && available(p)).map(p => [p.id, p])).values()]
  return unique.sort((a, b) => Number(b.category === current.category) - Number(a.category === current.category) || a.id - b.id).slice(0, limit)
}
export function recentProducts<P extends CatalogItem>(ids: number[], catalog: P[], currentId?: number): P[] {
  const byId = new Map(catalog.filter(available).map(p => [p.id, p]))
  return [...new Set(ids)].filter(id => id !== currentId).flatMap(id => byId.has(id) ? [byId.get(id)!] : []).slice(0, 4)
}
