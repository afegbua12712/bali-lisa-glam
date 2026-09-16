import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
function compile(path, dependencies = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  new Function('exports', 'require', result.outputText)(exports, name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name))
  return exports
}
const content = compile('lib/support-pages.ts')
const views = compile('SupportPages.tsx', { './lib/support-pages': content, './lib/supabase': { supabase: {} }, './support-pages.css': {} })
test('only six explicit support hashes resolve; auth callbacks and unknown fragments remain untouched', () => {
  for (const page of Object.keys(content.supportTitles)) assert.equal(content.supportPageFromHash(`#/${page}`), page)
  for (const hash of ['', '#access_token=synthetic', '#/unknown', '#/constructor', '#/toString', 'privacy']) assert.equal(content.supportPageFromHash(hash), null)
})
test('all footer links are real refreshable anchors and all six pages render', () => {
  const links = renderToStaticMarkup(createElement(views.SupportLinks))
  for (const [page, title] of Object.entries(content.supportTitles)) {
    assert.ok(links.includes(`href="#/${page}"`))
    const html = renderToStaticMarkup(createElement(views.SupportPageView, { page }))
    assert.ok(html.includes(title.replaceAll('&', '&amp;')))
  }
})
test('contact links use supplied settings and reject unsafe or malformed destinations', () => {
  const links = content.contactLinks({ business_email: 'help@example.test', whatsapp_number: '+1 (416) 555-0100' })
  assert.equal(links.email.href, 'mailto:help%40example.test')
  assert.equal(links.whatsapp.href, 'https://wa.me/14165550100')
  assert.deepEqual(content.contactLinks({}), { email: null, whatsapp: null })
  assert.equal(content.contactLinks({ business_email: 'help@example.test\nBcc:bad@example.test' }).email, null)
  assert.equal(content.contactLinks({ whatsapp_number: 'javascript:1234567890' }).whatsapp, null)
})
test('FAQ covers payment and orders, and customer rights are preserved without invented deadlines', () => {
  assert.equal(content.supportContent.faq.length, 10)
  assert.ok(content.supportContent.returns.some(([, text]) => text.includes('applicable consumer law')))
  assert.ok(!JSON.stringify(content.supportContent).match(/refund within \d+|delivery within \d+|guaranteed results/i))
})
test('confirmed return, shipping and privacy rules are published without a refund deadline', () => {
  const returns = JSON.stringify(content.supportContent.returns)
  for (const phrase of ['within 7 days of delivery', 'unused, unopened', 'original packaging', 'reasonable return or replacement shipping costs', 'customer is responsible for return shipping', 'original payment method', 'cannot be cancelled']) assert.ok(returns.includes(phrase), phrase)
  const shipping = JSON.stringify(content.supportContent.shipping)
  for (const phrase of ['1–2 business days', '1–3 business days', 'up to 14 business days', 'not guarantees', 'brokerage']) assert.ok(shipping.includes(phrase), phrase)
  const privacy = JSON.stringify(content.supportContent.privacy)
  for (const phrase of ['business email', 'only as long as reasonably necessary', 'delete or anonymize', 'fraud prevention']) assert.ok(privacy.includes(phrase), phrase)
})
test('checkout policy links preserve the current form and do not add a blocking checkbox', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const acknowledgment = app.match(/<p className="checkout-acknowledgment">.*?<\/p>/s)?.[0]
  assert.ok(acknowledgment)
  assert.ok(acknowledgment.includes('href="#/terms" target="_blank"'))
  assert.ok(acknowledgment.includes('href="#/privacy" target="_blank"'))
  assert.ok(!acknowledgment.includes('checkbox'))
  assert.ok(!app.includes('easy 30-day returns'))
  assert.ok(!app.includes('Free delivery on $75+'))
})
