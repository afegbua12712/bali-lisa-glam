import { useEffect, useState } from 'react'
import type { OptionGroup } from './lib/product-options'
import { moveImage, uploadImageError, type EditableImage } from './lib/product-images'

function Preview({ image }: { image: EditableImage }) {
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!image.file) return
    const url = URL.createObjectURL(image.file); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image.file])
  return <img src={image.file ? preview || undefined : image.url} alt={image.alt_text || 'Product photograph preview'} />
}
export function ProductImagesEditor({ images, groups, onChange }: {
  images: EditableImage[]; groups: OptionGroup[]; onChange: (images: EditableImage[]) => void
}) {
  const [error, setError] = useState('')
  const values = groups.flatMap(group => group.values.map(value => ({ id: value.id, label: `${group.name}: ${value.label}${value.active ? '' : ' (inactive)'}` })))
  const update = (id: string, change: Partial<EditableImage>) => onChange(images.map(image => image.id === id ? { ...image, ...change } : image))
  return <section className="product-images-editor" aria-label="Product images">
    <h3>Product images</h3>
    <p>The first image is the primary photograph. Add up to 20 JPG, PNG or WEBP images, 5 MB each. Uploads are saved when you save the product.</p>
    <label>Upload product images<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => {
      const files = Array.from(event.target.files ?? []); event.target.value = ''
      const problem = images.length + files.length > 20 ? 'A product can have up to 20 images.' : files.map(uploadImageError).find(Boolean)
      if (problem) { setError(problem); return }
      setError(''); onChange([...images, ...files.map((file, i) => ({ id: crypto.randomUUID(), file, url: '', alt_text: '', display_order: images.length + i, option_value_id: null }))])
    }} /></label>
    {error && <p role="alert">{error}</p>}
    {images.map((image, index) => <fieldset key={image.id} className="image-editor-item">
      <legend>{index === 0 ? 'Primary image' : `Image ${index + 1}`}</legend>
      <Preview image={image} />
      {!image.file && <label>Image URL<input type="text" inputMode="url" required maxLength={2048} pattern="https://.+|/[^/].*" title="Use an HTTPS URL or a path starting with a single slash." value={image.url} onChange={event => update(image.id, { url: event.target.value })} /></label>}
      <label>Image description (optional)<input maxLength={200} value={image.alt_text} onChange={event => update(image.id, { alt_text: event.target.value })} /></label>
      <label>Associated option (optional)<select value={image.option_value_id ?? ''} onChange={event => update(image.id, { option_value_id: event.target.value || null })}>
        <option value="">All options / general photograph</option>
        {values.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}
      </select></label>
      <div className="image-editor-actions">
        <button type="button" disabled={index === 0} onClick={() => onChange(moveImage(images, index, 0))}>Make primary</button>
        <button type="button" disabled={index === 0} onClick={() => onChange(moveImage(images, index, index - 1))}>Move image up</button>
        <button type="button" disabled={index === images.length - 1} onClick={() => onChange(moveImage(images, index, index + 1))}>Move image down</button>
        <button type="button" onClick={() => onChange(images.filter(item => item.id !== image.id))}>Remove image {index + 1}</button>
      </div>
    </fieldset>)}
    <button type="button" disabled={images.length >= 20} onClick={() => onChange([...images, { id: crypto.randomUUID(), url: '', alt_text: '', display_order: images.length, option_value_id: null }])}>Add image by URL</button>
    <p>Removing a photograph takes it out of this gallery when saved. Stored files are retained to protect shared images and order history.</p>
  </section>
}
