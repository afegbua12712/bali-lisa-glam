import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function compile(path, dependencies = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  })
  assert.equal(compiled.diagnostics.length, 0)
  const exports = {}
  new Function('exports', 'require', compiled.outputText)(exports, name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  })
  return exports
}

const { paymentEmailState } = compile('src/lib/payment-email-state.ts')

test('only paid, never-sent or definitely rejected emails can be retried', () => {
  assert.equal(paymentEmailState('awaiting_payment').canSend, false)
  assert.equal(paymentEmailState('paid').canSend, true)
  for (const notification of [
    { status: 'sent' }, { status: 'sending' }, { status: 'pending' },
    { status: 'failed', provider_message_id: 'synthetic-provider-id' },
    { status: 'failed', sent_at: '2026-09-10T00:00:00Z' },
    { status: 'failed', last_error: 'fetch failed' },
    { status: 'failed', last_error: 'Email provider returned HTTP 500' },
    { status: 'failed', last_error: 'Email provider returned HTTP 409' },
    { status: 'failed', last_error: 'Email was accepted but its delivery record could not be updated' },
  ]) assert.equal(paymentEmailState('paid', notification).canSend, false)
  assert.equal(paymentEmailState('paid', { status: 'failed', last_error: 'Email provider returned HTTP 422' }).canSend, true)
})

test('invocation reports success only when delivery is recorded as sent', async () => {
  let reply
  const { sendOrderEmail } = compile('src/lib/order-email.ts', {
    './supabase': { supabase: { functions: { invoke: async (name, options) => {
      assert.equal(name, 'send-order-email')
      assert.deepEqual(options.body, { order_id: 'synthetic', event_type: 'payment_confirmed' })
      return reply
    } } } },
  })
  for (const data of [null, { sent: false, status: 'sending', skipped: true }, { sent: false, status: 'failed' }]) {
    reply = { data }
    await assert.rejects(sendOrderEmail('synthetic', 'payment_confirmed'))
  }
  reply = { error: { context: new Response(null, { status: 401 }) } }
  await assert.rejects(sendOrderEmail('synthetic', 'payment_confirmed'), /Sign in again/)
  reply = { data: { sent: true, status: 'sent', skipped: true } }
  assert.equal((await sendOrderEmail('synthetic', 'payment_confirmed')).skipped, true)
})

test('admin action locks concurrent clicks and never invokes a payment mutation', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  let invoked = 0
  const hooks = []; let cursor = 0
  const jsx = (type, props) => ({ type, props })
  const { PaymentConfirmationEmailAction } = compile('src/PaymentConfirmationEmailAction.tsx', {
    react: {
      useRef: value => { const i = cursor++; return hooks[i] ??= { current: value } },
      useState: value => { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], value => { hooks[i] = value }] },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    './lib/payment-email-state': { paymentEmailState },
    './lib/order-email': { sendOrderEmail: async () => { invoked++; await pending; return { sent: true, status: 'sent' } } },
    './lib/supabase': { supabase: { from: name => {
      assert.equal(name, 'orders')
      return { select: () => ({ eq: () => ({ single: async () => ({ data: { payment_status: 'paid', order_notifications: [] } }) }) }) }
    } } },
  })
  const render = () => { cursor = 0; return PaymentConfirmationEmailAction({ orderId: 'synthetic', paymentStatus: 'paid', refresh: async () => {} }) }
  const first = render().props.children[0]
  first.props.onClick(); first.props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(invoked, 1)
  assert.equal(render().props.children[0].props.disabled, true)
  release()
  await new Promise(resolve => setImmediate(resolve))
  const finished = render().props.children[0]
  assert.equal(finished.props.children, 'Email sent')
  assert.equal(finished.props.disabled, true)
})

test('sender formatting preserves accepted forms and brackets display-name addresses', () => {
  const source = readFileSync(new URL('../supabase/functions/send-order-email/index.ts', import.meta.url), 'utf8')
  const helper = source.slice(source.indexOf('const formatSender'), source.indexOf('// Log only'))
  const js = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const format = new Function(`${js}; return formatSender`)()
  assert.equal(format('Example & Shop noreply@example.test'), 'Example & Shop <noreply@example.test>')
  assert.equal(format('Example <noreply@example.test>'), 'Example <noreply@example.test>')
  assert.equal(format('  noreply@example.test  '), 'noreply@example.test')
})

test('Edge Function renders a claimed payment email and only updates its ledger', async () => {
  const source = readFileSync(new URL('../supabase/functions/send-order-email/index.ts', import.meta.url), 'utf8').replace(/^import .*\r?\n/, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true })
  assert.equal(compiled.diagnostics.length, 0)
  let handler; let providerCalls = 0; let ledgerUpdate
  const order = { id: 'synthetic-order', order_reference: 'BL-00042', payment_status: 'paid', currency: 'CAD',
    subtotal_cents: 1000, shipping_cents: 0, total_cents: 1000,
    order_items: [{ product_name: 'Fixture product', shade: 'Shade: Rose · Size: M', quantity: 1, unit_price_cents: 1000 }],
    shipping_address: { country: 'Canada', email: 'customer@example.test' } }
  const createClient = (_url, key, options) => key === 'caller-key' ? {
    auth: { getUser: async () => { assert.equal(options.global.headers.Authorization, 'Bearer synthetic-session'); return { data: { user: { id: 'synthetic-admin' } } } } },
    rpc: async (name, args) => {
      assert.equal(name, 'claim_order_notification')
      assert.deepEqual(args, { target_order_id: order.id, target_event_type: 'payment_confirmed' })
      return { data: [{ notification_id: 'synthetic-notification', should_send: true }], status: 200 }
    },
  } : { from: table => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: table === 'orders' ? order : { business_email: 'support@example.test' } }) }) }),
    update: value => { assert.equal(table, 'order_notifications'); ledgerUpdate = value; return { eq: async () => ({ error: null }) } },
  }) }
  const env = { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'caller-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RESEND_API_KEY: 'provider-key', ORDER_EMAIL_FROM: 'Example Shop noreply@example.test' }
  new Function('createClient', 'Deno', 'console', 'fetch', compiled.outputText)(createClient,
    { env: { get: name => env[name] }, serve: fn => { handler = fn } }, { info: () => {} },
    async (url, options) => {
      providerCalls++
      assert.equal(url, 'https://api.resend.com/emails')
      assert.equal(options.headers['Idempotency-Key'], 'blg-order-synthetic-order-payment_confirmed')
      const body = JSON.parse(options.body)
      assert.equal(body.from, 'Example Shop <noreply@example.test>')
      assert.match(body.subject, /Payment confirmed/); assert.ok(body.subject.includes('BL-00042')); assert.ok(body.html.includes('BL-00042')); assert.ok(body.text.includes('BL-00042'))
      assert.ok(body.html.includes('Shade: Rose · Size: M'))
      assert.ok(body.text.includes('Shade: Rose · Size: M'))
      return Response.json({ id: 'synthetic-provider-id' })
    })
  const response = await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer synthetic-session' }, body: JSON.stringify({ order_id: order.id, event_type: 'payment_confirmed' }) }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).sent, true)
  assert.equal(providerCalls, 1)
  assert.equal(ledgerUpdate.status, 'sent')
  assert.equal(ledgerUpdate.provider_message_id, 'synthetic-provider-id')
})
