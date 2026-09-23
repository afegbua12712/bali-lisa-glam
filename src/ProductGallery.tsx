import type { ProductImage } from './lib/product-images'

export function ProductGallery({ images, activeId, onSelect, name }: {
  images: ProductImage[]; activeId: string | null; onSelect: (id: string) => void; name: string
}) {
  const active = images.find(image => image.id === activeId) ?? images[0]
  return <div className="product-gallery">
    <div className="gallery">{active ? <img src={active.url} alt={active.alt_text || name} /> : <p>Product image unavailable</p>}</div>
    {images.length > 1 && <div className="gallery-thumbnails" aria-label="Product photographs">
      {images.map((image, index) => <button type="button" key={image.id} aria-label={`View image ${index + 1} of ${name}`} aria-pressed={active?.id === image.id} onClick={() => onSelect(image.id)}>
        <img src={image.url} alt="" loading="lazy" />
      </button>)}
    </div>}
  </div>
}
