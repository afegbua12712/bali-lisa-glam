import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
function compile(path, dependencies = {}) {
  const exports = {}
  const { outputText } = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  new Function('exports', 'require', outputText)(exports, name => dependencies[name])
  return exports
}
const support = compile('src/lib/support-pages.ts')
const seo = compile('src/lib/seo.ts', { './support-pages': support })

test('page hashes handle unknown pages without consuming authentication fragments', () => {
  for (const page of Object.keys(support.supportTitles)) assert.equal(seo.pageFromHash(`#/${page}`), page)
  for (const hash of ['#/missing', '#/constructor', '#/shop']) assert.equal(seo.pageFromHash(hash), 'not-found')
  assert.equal(seo.pageFromHash('#/'), 'home')
  for (const hash of ['', '#access_token=fixture&type=recovery', '#error=access_denied', '#refresh_token=fixture', '#type=signup', '#ordinary-anchor']) assert.equal(seo.pageFromHash(hash), null)
})

test('view metadata stays factual and canonical URLs never include state or auth information', () => {
  for (const view of ['home', 'shop', 'product', 'story', 'guide', 'account', 'admin', 'checkout', 'not-found', ...Object.keys(support.supportTitles)]) {
    const meta = seo.metadataFor(view)
    assert.ok(meta.title.includes('Bali & Lisa Glam'))
    assert.ok(meta.description.length > 20 && meta.description.length <= 160)
    assert.equal(meta.url, 'https://balilisaglam.com/')
  }
  const product = seo.metadataFor('product', { name: 'Rose Lip Colour', description: 'Available in two shades.' })
  assert.equal(product.title, 'Rose Lip Colour | Bali & Lisa Glam')
  assert.equal(product.description, 'Available in two shades.')
  assert.equal(product.url, seo.SITE_URL)
  assert.ok(seo.metadataFor('product', { name: 'Test', description: 'a'.repeat(400) }).description.length <= 160)
})

test('metadata updates existing elements, creates missing elements and treats product text as text', () => {
  const elements = []
  const doc = {
    title: '',
    createElement: tag => ({ tag, attributes: {}, setAttribute(key, value) { this.attributes[key] = value } }),
    head: {
      appendChild: element => elements.push(element),
      querySelector(selector) {
        const [, tag, attribute, value] = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]$/)
        return elements.find(element => element.tag === tag && element.attributes[attribute] === value) ?? null
      },
    },
  }
  seo.applyMetadata(seo.metadataFor('home'), doc)
  const count = elements.length
  seo.applyMetadata(seo.metadataFor('product', { name: '<b>Product</b>', description: 'A "quoted" description' }), doc)
  assert.equal(elements.length, count)
  assert.equal(doc.title, '<b>Product</b> | Bali & Lisa Glam')
  assert.equal(doc.head.querySelector('meta[property="og:title"]').attributes.content, doc.title)
  assert.equal(doc.head.querySelector('meta[name="description"]').attributes.content, 'A "quoted" description')
  assert.equal(doc.head.querySelector('link[rel="canonical"]').attributes.href, seo.SITE_URL)
  seo.applyMetadata(seo.metadataFor('privacy'), doc)
  assert.equal(doc.title, 'Privacy Policy | Bali & Lisa Glam')
})

test('static defaults match home metadata, structured data is minimal and sitemap includes only homepage', () => {
  const html = read('index.html').replaceAll('&amp;', '&')
  const home = seo.metadataFor('home')
  assert.ok(html.includes(`<title>${home.title}</title>`))
  assert.ok(html.includes(`name="description" content="${home.description}"`))
  assert.ok(html.includes(`rel="canonical" href="${seo.SITE_URL}"`))
  for (const key of ['og:title', 'og:description', 'og:site_name', 'og:url', 'og:type', 'twitter:card', 'twitter:title', 'twitter:description']) assert.ok(html.includes(`="${key}"`))
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
  assert.deepEqual(schema, { '@context': 'https://schema.org', '@type': 'WebSite', name: seo.SITE_NAME, url: seo.SITE_URL })
  assert.ok(html.includes('href="/favicon.svg"'))
  assert.deepEqual([...read('public/sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [seo.SITE_URL])
  assert.ok(read('public/robots.txt').includes(`Sitemap: ${seo.SITE_URL}sitemap.xml`))
})
