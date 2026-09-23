import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

const require = createRequire(import.meta.url)
function compile(path) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  new Function('exports', 'require', compiled.outputText)(exports, require)
  return exports
}
const { productImages, moveImage, associatedImage, uploadImageError } = compile('lib/product-images.ts')
const { ProductGallery } = compile('ProductGallery.tsx')
const images = [
  { id: 'general', url: '/general.png', alt_text: '', display_order: 0, option_value_id: null },
  { id: 'rose-photo', url: '/rose.png', alt_text: 'Rose shade', display_order: 1, option_value_id: 'rose' },
  { id: 'blue-photo', url: '/blue.png', alt_text: 'Blue color', display_order: 2, option_value_id: 'blue' },
]

test('gallery preserves legacy images, primary ordering and immutable reorder operations', () => {
  assert.equal(productImages([], '/legacy.png')[0].url, '/legacy.png')
  assert.deepEqual(productImages(null, ''), [])
  assert.deepEqual(productImages([...images].reverse(), '/legacy.png'), images)
  assert.deepEqual(moveImage(images, 2, 0).map(row => row.id), ['blue-photo', 'general', 'rose-photo'])
  assert.equal(images[0].id, 'general')
  assert.deepEqual(moveImage(images, -1, 0), images)
})

test('normalized Shade and Color IDs switch photographs without changing option selections', () => {
  const before = { shade: 'rose' }, after = { shade: 'rose', color: 'blue' }
  assert.equal(associatedImage(images, {}, before), 'rose-photo')
  assert.equal(associatedImage(images, before, after), 'blue-photo')
  assert.equal(associatedImage(images, before, { shade: 'unpictured' }), undefined)
  assert.equal(associatedImage(images, before, { shade: '' }), undefined)
  assert.equal(associatedImage(images, before, before), undefined)
  assert.deepEqual(after, { shade: 'rose', color: 'blue' })
})

test('gallery exposes keyboard buttons, active state, alt text and safe missing-image fallback', () => {
  const render = (rows, activeId) => renderToStaticMarkup(createElement(ProductGallery, { images: rows, activeId, name: 'Lip tint', onSelect() {} }))
  const html = render(images, 'rose-photo')
  assert.ok(html.includes('alt="Rose shade"'))
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1)
  assert.ok(html.includes('aria-label="View image 3 of Lip tint"'))
  assert.ok(render(images, 'removed').includes('alt="Lip tint"'))
  assert.ok(!render([images[0]], null).includes('gallery-thumbnails'))
  assert.ok(render([], null).includes('Product image unavailable'))
})

test('uploads accept supported images up to 5 MB and reject unsupported or oversized files', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(uploadImageError({ type, size: 5 * 1024 * 1024 }), null)
  assert.ok(uploadImageError({ type: 'image/svg+xml', size: 100 }))
  assert.ok(uploadImageError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }))
})
