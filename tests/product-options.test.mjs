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
const { cartQuantity, cartLineKey, selectProductOptions, optionSummary, normalizeOptions, validateOptionEditor } = compile('lib/product-options.ts')
const { CartButton } = compile('CartButton.tsx')
const { ProductOptionSelectors } = compile('ProductOptionSelectors.tsx')
const groups = [{ id: 'shade', name: 'Shade', required: true, display_order: 0, values: [
  { id: 'rose', label: 'Rose', active: true, display_order: 0, color: '#8A3F54' },
  { id: 'ruby', label: 'Ruby', active: false, display_order: 1, color: null },
] }, { id: 'size', name: 'Size', required: false, display_order: 1, values: [
  { id: 'large', label: 'Large', active: true, display_order: 0, color: null },
] }]

test('badge uses total quantity and accessible labels, hiding zero and capping visual count', () => {
  assert.equal(cartQuantity([{ quantity: 1 }, { quantity: 2 }]), 3)
  for (const [count, label, badge] of [[0, '0 items', null], [1, '1 item', '1'], [3, '3 items', '3'], [100, '100 items', '99+']]) {
    const html = renderToStaticMarkup(createElement(CartButton, { count, onClick() {} }))
    assert.ok(html.includes(`aria-label="Cart, ${label}"`))
    if (badge === null) assert.ok(!html.includes('cart-count'))
    else assert.ok(html.includes(`class="cart-count">${badge}</span>`))
  }
  assert.equal(cartQuantity([]), 0)
})
test('required, optional, inactive and no-option choices are handled without defaults', () => {
  assert.ok(selectProductOptions(groups, {}).error)
  assert.ok(selectProductOptions(groups, { shade: 'ruby' }).error)
  assert.ok(selectProductOptions(groups, { shade: 'rose', size: 'removed' }).error)
  const result = selectProductOptions(groups, { shade: 'rose', size: 'large' })
  assert.equal(result.error, '')
  assert.equal(optionSummary(result.choices), 'Shade: Rose · Size: Large')
  assert.equal(selectProductOptions(groups, { shade: 'rose' }).choices.length, 1)
  assert.deepEqual(selectProductOptions([], {}), { choices: [], error: '' })
})
test('cart identities distinguish combinations and ignore selection order or renamed labels', () => {
  const choices = selectProductOptions(groups, { shade: 'rose', size: 'large' }).choices
  const line = { id: 1, selected_options: choices }
  assert.equal(cartLineKey(line), cartLineKey({ id: 1, selected_options: [...choices].reverse().map(x => ({ ...x, name: 'Renamed' })) }))
  assert.notEqual(cartLineKey(line), cartLineKey({ id: 1, selected_options: choices.slice(0, 1) }))
  assert.notEqual(cartLineKey(line), cartLineKey({ id: 2, selected_options: choices }))
  assert.equal(cartLineKey({ id: 1, shade: 'Universal' }), cartLineKey({ id: 1, selected_options: [] }))
  assert.notEqual(cartLineKey({ id: 1, shade: 'Rose' }), cartLineKey({ id: 1, shade: 'Ruby' }))
})
test('catalog normalization respects group and value ordering', () => {
  const normalized = normalizeOptions([...groups].reverse().map(({ values, ...group }) => ({ ...group, product_option_values: [...values].reverse() })))
  assert.deepEqual(normalized.map(x => x.name), ['Shade', 'Size'])
  assert.deepEqual(normalized[0].values.map(x => x.label), ['Rose', 'Ruby'])
})
test('editor rejects duplicates, empty required groups and invalid swatches', () => {
  assert.equal(validateOptionEditor(groups), '')
  assert.ok(validateOptionEditor([...groups, groups[0]]))
  assert.ok(validateOptionEditor([{ ...groups[0], values: [] }]))
  assert.ok(validateOptionEditor([{ ...groups[0], values: [{ ...groups[0].values[0], color: 'red' }] }]))
  assert.ok(validateOptionEditor([{ ...groups[0], values: [groups[0].values[0], groups[0].values[0]] }]))
})
test('selectors expose names, pressed state and optional omission; inactive values stay hidden', () => {
  const html = renderToStaticMarkup(createElement(ProductOptionSelectors, { groups, selected: { shade: 'rose' }, onChange() {} }))
  assert.ok(html.includes('Shade (required)'))
  assert.ok(html.includes('Size (optional)'))
  assert.ok(html.includes('aria-pressed="true"'))
  assert.ok(html.includes('Rose'))
  assert.ok(!html.includes('Ruby'))
  assert.ok(html.includes('No preference'))
  assert.ok(html.includes('aria-hidden="true"'))
})
