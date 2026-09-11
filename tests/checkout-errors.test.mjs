import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/checkout-errors.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
const exports = {}
const logs = []
new Function('exports', 'console', compiled.outputText)(exports, { warn: (...args) => logs.push(args) })
const { checkoutFailure, logCheckoutFailure } = exports

test('all explicit checkout business rejections map to fixed customer messages', () => {
  const cases = [
    ['Insufficient inventory for Synthetic private product', 'stock'],
    ['A product is unavailable', 'product_unavailable'],
    ['Authentication required', 'authentication'],
    ['Order needs at least one item', 'empty_bag'],
    ['Invalid order line', 'invalid_line'],
    ['Delivery country is required', 'address'],
    ['Store shipping settings are not configured', 'shipping'],
    ['Shipping is not configured for the selected destination country', 'shipping'],
    ['Checkout idempotency key is required', 'idempotency'],
    ['Unsupported payment method', 'payment_method'],
  ]
  for (const [message, category] of cases) {
    const result = checkoutFailure({ code: 'P0001', message, details: 'private@example.test' })
    assert.equal(result.category, category)
    assert.ok(!JSON.stringify(result).includes('private'))
  }
})

test('database and auth failures do not invent an address or stock diagnosis', () => {
  assert.equal(checkoutFailure({ code: 'PGRST301', message: 'sensitive token' }).category, 'authentication')
  assert.equal(checkoutFailure({ code: '23503', message: 'violates foreign key constraint "orders_customer_id_fkey"' }).category, 'account_profile')
  assert.equal(checkoutFailure({ code: '23503', message: 'another foreign key' }).category, 'unknown')
  assert.equal(checkoutFailure({ code: '22P02', message: 'sensitive UUID' }).category, 'invalid_request')
  assert.equal(checkoutFailure({ code: '23505' }).category, 'conflict')
  assert.equal(checkoutFailure({ code: '42501' }).category, 'unavailable')
})

test('unrecognized errors and diagnostic output never expose supplied data', () => {
  for (const error of [null, undefined, 'private@example.test', new Error('private@example.test'),
    { code: 'private@example.test', message: 'private@example.test', details: 'Bearer sensitive', hint: 'sensitive address' },
    { code: 'P0001', message: 'toString' }]) {
    const result = checkoutFailure(error)
    assert.equal(result.category, 'unknown')
    logCheckoutFailure(result)
  }
  logCheckoutFailure(checkoutFailure({ code: 'P0001', message: 'Insufficient inventory for private@example.test' }))
  assert.ok(!/private|Bearer|sensitive/.test(JSON.stringify(logs)))
  for (const [, metadata] of logs) assert.deepEqual(Object.keys(metadata).sort(), ['category', 'code', 'stage'])
})

test('checkout blocks missing sessions and preserves the key on RPC rejection', async () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const checkout = app.slice(app.indexOf('function Checkout('))
  const submitSource = checkout.slice(checkout.indexOf('const submit = async'), checkout.indexOf('  if (confirmation)'))
  const compiledSubmit = ts.transpileModule(submitSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const hasSession of [false, true]) {
    let calls = 0; let message = ''
    const key = { current: 'synthetic-existing-key' }
    const started = { current: false }
    const context = {
      step: 2, settings: {}, orderSubmissionStarted: started,
      setBusy: () => {}, setError: value => { message = value },
      supabase: { auth: { getSession: async () => ({ data: { session: hasSession ? {} : null }, error: null }) } },
      cart: [], address: {}, method: 'manual_email', checkoutIdempotencyKey: key,
      createManualOrder: async (...args) => {
        calls++
        assert.equal(args[3], 'synthetic-existing-key')
        throw { code: 'P0001', message: 'Insufficient inventory for synthetic product' }
      },
      checkoutFailure, logCheckoutFailure,
    }
    const submit = new Function(...Object.keys(context), `${compiledSubmit}; return submit`)(...Object.values(context))
    await submit({ preventDefault() {} })
    assert.equal(calls, hasSession ? 1 : 0)
    assert.equal(message, hasSession ? 'This item no longer has enough stock. Please update your bag.' : 'Please sign in again and retry checkout.')
    assert.equal(key.current, 'synthetic-existing-key')
    assert.equal(started.current, false)
  }
})
