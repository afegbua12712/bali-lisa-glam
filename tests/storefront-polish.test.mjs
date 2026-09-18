import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
function renderFunction(name, next, props) {
  const source = app.slice(app.indexOf(`function ${name}(`), app.indexOf(`function ${next}(`))
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const icons = require('lucide-react')
  const support = () => createElement('nav', null, 'Support links')
  const component = new Function('exports', 'require', ...Object.keys(icons), 'CartButton', 'SupportLinks', 'AppearanceControl', `${compiled}; return ${name}`)({}, require, ...Object.values(icons), () => createElement('button', null, 'Bag'), support, () => createElement('label', null, 'Appearance'))
  return renderToStaticMarkup(createElement(component, props))
}
test('header renders approved logo as an accessible home button, retaining navigation', () => {
  const html = renderFunction('Header', 'Home', { count: 0, page: 'home' })
  assert.ok(html.includes('src="/bali-lisa-logo.png"'))
  assert.ok(html.includes('aria-label="Bali &amp; Lisa Glam home"'))
  for (const label of ['Search', 'Account', 'Open menu', 'Shop', 'Bag']) assert.ok(html.includes(label))
  const bytes = readFileSync(new URL('../public/bali-lisa-logo.png', import.meta.url))
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
})
test('fake subscription offers and blanket product claims are removed from active app', () => {
  assert.ok(!/15%|Glow List|className="newsletter"|className="footer-email"|vegan|cruelty-free/i.test(app))
  const detail = app.slice(app.indexOf('function Detail('), app.indexOf('function Cart('))
  assert.ok(!/How to use|Ingredients|Apply with fingertips/.test(detail))
  assert.ok(detail.includes('{product.description}'))
  assert.ok(detail.includes('ProductOptionSelectors'))
  assert.ok(detail.includes('selectProductOptions'))
  const footer = renderFunction('Footer', '__end', {})
  assert.ok(footer.includes('href="#/contact"'))
  assert.ok(!footer.includes('<form'))
})
