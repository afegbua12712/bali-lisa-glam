export type ProductImage = {
  id: string; url: string; alt_text: string; display_order: number; option_value_id: string | null
}
export type EditableImage = ProductImage & { file?: File }

export function productImages(images: ProductImage[] | null | undefined, fallback: string): ProductImage[] {
  const sorted = [...(images ?? [])].sort((a, b) => a.display_order - b.display_order)
  return sorted.length ? sorted : fallback ? [{ id: 'legacy', url: fallback, alt_text: '', display_order: 0, option_value_id: null }] : []
}
export function moveImage<T>(images: T[], index: number, target: number): T[] {
  if (index < 0 || index >= images.length || target < 0 || target >= images.length) return images
  const result = [...images]; const [image] = result.splice(index, 1); result.splice(target, 0, image)
  return result
}
export function associatedImage(images: ProductImage[], before: Record<string, string>, after: Record<string, string>): string | undefined {
  const changed = Object.keys(after).find(key => after[key] && after[key] !== before[key])
  return changed ? images.find(image => image.option_value_id === after[changed])?.id : undefined
}
export function uploadImageError(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose JPG, PNG, or WEBP images.'
  if (file.size > 5 * 1024 * 1024) return 'Each image must be 5 MB or smaller.'
  return null
}
