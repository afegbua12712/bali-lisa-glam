import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
function compile(path, dependencies = {}) {
  const exports = {}
  new Function('exports', 'require', ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports, name => dependencies[name])
  return exports
}
const support = compile('src/lib/support-pages.ts')
const journey = compile('src/lib/checkout-journey.ts', { './support-pages': support })
const errors = compile('src/lib/checkout-errors.ts')
const app = read('src/App.tsx')
const checkout = app.slice(app.indexOf('function Checkout('))
function callback(name, end, context) {
  const source = checkout.slice(checkout.indexOf(`const ${name} = async`), checkout.indexOf(end))
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(context), `${compiled};return ${name}`)(...Object.values(context))
}

test('stock is shared across option combinations, including sold-out and changed inventory', () => {
  const bag = [{ id: 1, quantity: 2, shade: 'Red' }, { id: 1, quantity: 1, shade: 'Pink' }, { id: 2, quantity: 10 }]
  assert.equal(journey.availableQuantity(1, 4, bag), 1)
  assert.equal(journey.availableQuantity(1, 0, []), 0)
  assert.equal(journey.availableQuantity(1, undefined, []), 0)
  assert.equal(journey.availableQuantity(1, 2, bag), 0)
  assert.equal(journey.bagStockError(bag, [{ id: 1, inventory: 4 }, { id: 2, inventory: 10 }]), '')
  assert.ok(journey.bagStockError(bag, [{ id: 1, inventory: 2 }, { id: 2, inventory: 10 }]))
  assert.ok(journey.bagStockError(bag, []))
})

test('draft restoration preserves delivery values and rejects malformed or unrelated stored fields', () => {
  const draft = { first_name: 'Fixture', address: '1 Test Street', country: 'Canada', postal_code: 'M5V 2T6' }
  assert.deepEqual(journey.readCheckoutDraft({ getItem: () => JSON.stringify(draft) }), draft)
  assert.deepEqual(journey.readCheckoutDraft({ getItem: () => '{broken' }), { country: 'Canada' })
  assert.deepEqual(journey.readCheckoutDraft({ getItem: () => '{"token":"fixture","phone":123}' }), { country: 'Canada' })
})

test('editing delivery returns to step one without changing the delivery draft', () => {
  const marker = '>Edit delivery details</button>'
  const button = app.slice(app.lastIndexOf('<button', app.indexOf(marker)), app.indexOf(marker))
  const body = button.match(/onClick=\{\(\) => \{(.*?)\}\}/s)[1]
  const address = { first_name: 'Fixture', address: '1 Test Street', country: 'Canada' }
  let step = 2, error = 'previous error'
  new Function('setStep', 'setError', 'address', body)(value => { step = value }, value => { error = value }, address)
  assert.equal(step, 1)
  assert.equal(error, '')
  assert.deepEqual(address, { first_name: 'Fixture', address: '1 Test Street', country: 'Canada' })
})

test('contact validation rejects missing or unsafe channels; handoff links encode the existing order', () => {
  assert.equal(journey.paymentContact({}, 'manual_email'), undefined)
  assert.equal(journey.paymentContact({ business_email: 'invalid' }, 'manual_email'), undefined)
  assert.equal(journey.paymentContact({ whatsapp_number: 'javascript:12345678' }, 'manual_whatsapp'), undefined)
  for (const method of ['manual_email', 'manual_whatsapp']) {
    const contact = journey.paymentContact({ business_email: 'help@example.test', whatsapp_number: '+14165550100' }, method)
    const link = journey.paymentHref(contact, method, 'BL-00123', 'Order BL-00123 & details')
    assert.ok(link.includes(encodeURIComponent('Order BL-00123 & details')))
    assert.equal(journey.paymentHref(contact, method, 'BL-00123', 'Order BL-00123 & details'), link)
  }
})

function harness(overrides = {}) {
  const state = { creates: 0, summaries: 0, emails: 0, error: '', confirmation: null, href: '', signIn: false, failSummary: true }
  const context = {
    step: 2, settings: { business_email: 'help@example.test', whatsapp_number: '+14165550100' },
    method: 'manual_whatsapp', address: { first_name: 'Fixture', address: '1 Test Street', country: 'Canada' },
    cart: [{ id: 1, quantity: 1 }], stockError: '', orderSubmissionStarted: { current: false },
    checkoutIdempotencyKey: { current: 'existing-key' }, recoveryLock: { current: false },
    setBusy() {}, setStep(value) { state.step = value }, setError(value) { state.error = value },
    setNeedsSignIn(value) { state.signIn = value }, setConfirmation(value) { state.confirmation = value },
    setEmailNotice() {}, setHandoff(value) { state.href = value },
    sessionStorage: { removeItem() {} }, window: { dispatchEvent() {} }, Event,
    supabase: { auth: { getSession: async () => ({ data: { session: {} }, error: null }) } },
    createManualOrder: async () => { state.creates++; return { order_id: 'synthetic', order_reference: 'BL-00123' } },
    sendOrderEmail: async () => { state.emails++ },
    getManualOrderSummary: async () => {
      state.summaries++
      assert.equal(state.confirmation.order_id, 'synthetic', 'confirmation must exist before summary fetch')
      if (state.failSummary) throw new Error('Synthetic network failure')
      return { order_reference: 'BL-00123', order_items: [], currency: 'CAD', shipping_cents: 100, total_cents: 1000 }
    },
    orderMoney: cents => `CAD ${cents / 100}`,
    ...journey, ...errors, logCheckoutFailure() {}, ...overrides,
  }
  context.prepareHandoff = callback('prepareHandoff', '  const submit = async', context)
  return { state, context, submit: callback('submit', '  if (confirmation)', context) }
}

test('delivery validation follows the country and preserves international shipping safeguards', async () => {
  const base = { first_name: 'Test', last_name: 'Customer', email: 'customer@example.test', phone: '+14165550100', address: '1 Test Street', city: 'Toronto', province: 'Ontario', postal_code: 'M5V 2T6', country: 'Canada' }
  for (const [changes, shippingConfigured, succeeds] of [
    [{}, true, true], [{ postal_code: '90210' }, true, false], [{ province: '' }, true, false],
    [{ country: 'United States', province: 'California', postal_code: '90210' }, true, true],
    [{ country: 'United States', province: '' }, true, false],
    [{ country: 'United Kingdom', province: '', postal_code: 'SW1A 1AA' }, true, true],
    [{ country: 'Hong Kong', province: '', postal_code: '' }, true, true],
    [{ country: 'Hong Kong', province: '', postal_code: '' }, false, false],
  ]) {
    const address = { ...base, ...changes }
    const { state, submit } = harness({ step: 1, address, shippingConfigured, isCanada: address.country === 'Canada' })
    await submit({ preventDefault() {} })
    assert.equal(state.step === 2, succeeds, JSON.stringify(changes))
    assert.equal(state.creates, 0)
    assert.deepEqual(journey.readCheckoutDraft({ getItem: () => JSON.stringify(address) }), address)
  }
  assert.equal(journey.checkoutAddressRules('Canada').postalLabel, 'Postal code')
  assert.equal(journey.checkoutAddressRules('United States').regionLabel, 'State')
  assert.equal(journey.checkoutAddressRules('United States').postalLabel, 'ZIP code')
  assert.equal(journey.checkoutAddressRules('Hong Kong').postalRequired, false)
})

test('unavailable payment channel and invalid stock stop before order creation', async () => {
  for (const override of [{ settings: {} }, { stockError: 'Update your bag.' }]) {
    const { state, submit } = harness(override)
    await submit({ preventDefault() {} })
    assert.equal(state.creates, 0)
    assert.ok(state.error)
  }
})

test('expired session provides sign-in recovery without creating an order or replacing its key', async () => {
  const { state, submit, context } = harness({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } })
  await submit({ preventDefault() {} })
  assert.equal(state.signIn, true)
  assert.equal(state.creates, 0)
  assert.equal(context.checkoutIdempotencyKey.current, 'existing-key')
  assert.equal(context.orderSubmissionStarted.current, false)
})

test('created order survives summary failure; retries and repeated handoffs never recreate or resend email', async () => {
  for (const method of ['manual_whatsapp', 'manual_email']) {
    const { state, submit, context } = harness({ method })
    await submit({ preventDefault() {} })
    assert.equal(state.creates, 1)
    assert.equal(state.emails, 1)
    assert.ok(state.error.includes('Your order is recorded'))
    assert.equal(context.orderSubmissionStarted.current, true)
    await submit({ preventDefault() {} })
    assert.equal(state.creates, 1)
    state.failSummary = false
    await context.prepareHandoff(state.confirmation)
    const href = state.href
    await context.prepareHandoff(state.confirmation)
    assert.equal(state.href, href)
    assert.ok(href.startsWith(method === 'manual_email' ? 'mailto:' : 'https://wa.me/'))
    assert.equal(state.creates, 1)
    assert.equal(state.emails, 1)
    assert.equal(state.error, ''); assert.ok(decodeURIComponent(href).includes('BL-00123'))
  }
})
