import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const helpers = {}
new Function('exports', compile(read('src/lib/reliability.ts')))(helpers)
const app = read('src/App.tsx')

test('saved cart accepts valid legacy/current data and rejects corrupt or unsafe structures', () => {
  const line = { id: 1, name: 'Fixture', category: 'Lips', price: 10, rating: 0, reviews: 0, image: '/product.png', description: '', shades: ['Rose'], shade: 'Rose', quantity: 2 }
  const load = value => helpers.readSavedCart({ getItem: () => value })
  assert.equal(load(JSON.stringify([line]))[0].quantity, 2)
  const choice = { group_id: '00000000-0000-4000-8000-000000000001', value_id: '00000000-0000-4000-8000-000000000002', name: 'Shade', value: 'Rose' }
  assert.deepEqual(load(JSON.stringify([{ ...line, selected_options: [choice] }]))[0].selected_options, [choice])
  for (const value of [null, '', '{', '{}', 'null', '[null]', '[]', JSON.stringify([{ ...line, quantity: -1 }]), JSON.stringify([{ ...line, selected_options: {} }]), JSON.stringify([{ ...line, image: 'javascript:bad' }]), JSON.stringify([{ ...line, price: '10' }])]) assert.deepEqual(load(value), [])
  assert.deepEqual(helpers.readSavedCart({ getItem: () => { throw new Error('Storage denied') } }), [])
})

test('diagnostic logs and deletion errors never expose untrusted exception details', () => {
  const captured = []; const exports = {}
  new Function('exports', 'console', compile(read('src/lib/reliability.ts')))(exports, { error: (...args) => captured.push(args) })
  exports.logOperationFailure('save_product', { code: 'secret@example.test', message: 'Bearer secret', details: 'private' })
  exports.logOperationFailure('delete_product', { code: 'BLG01', message: 'private' })
  assert.deepEqual(captured, [['save_product', { category: 'operation_failed' }], ['delete_product', { category: 'BLG01' }]])
  assert.match(exports.productDeletionMessage({ code: 'BLG01' }), /outstanding inventory reservations/)
  assert.equal(exports.productDeletionMessage(new Error('private')), 'Product could not be deleted.')
  assert.doesNotMatch(app, /console\.error\(/)
})

test('only genuinely expired unpaid reservations are flagged', () => {
  const order = { payment_status: 'awaiting_payment', inventory_reservation_status: 'reserved', status: 'pending', payment_expires_at: '2026-01-01T00:00:00Z' }
  const now = Date.parse('2026-01-02T00:00:00Z')
  assert.equal(helpers.expiredReservation(order, now), true)
  for (const change of [{ payment_status: 'paid' }, { inventory_reservation_status: 'restored' }, { paid_at: '2026-01-01' }, { status: 'paid' }, { payment_expires_at: null }, { payment_expires_at: 'invalid' }, { payment_expires_at: '2027-01-01' }]) assert.equal(helpers.expiredReservation({ ...order, ...change }, now), false)
})

test('account failure exits loading; retry requests fresh data and restores success', async () => {
  const start = app.indexOf('  const load = useCallback', app.indexOf('function CustomerDashboard'))
  const source = app.slice(start, app.indexOf('  useEffect', start))
  let calls = 0, loading, failed, data
  const load = new Function('useCallback', 'getCustomerAccount', 'setLoading', 'setLoadFailed', 'setData', `${compile(source)}; return load`)(fn => fn, async () => { if (++calls === 1) throw new Error('private'); return { profile: {} } }, value => { loading = value }, value => { failed = value }, value => { data = value })
  await load(); assert.equal(loading, false); assert.equal(failed, true)
  await load(); assert.equal(calls, 2); assert.equal(loading, false); assert.equal(failed, false); assert.deepEqual(data, { profile: {} })
  assert.match(app, /onClick=\{\(\) => void load\(\)\}>Retry/)
})

test('email persistence accepts only fixed messages and bounded provider status; imports are pinned', () => {
  const source = read('supabase/functions/send-order-email/index.ts')
  const start = source.indexOf('    const rawMessage =')
  const snippet = source.slice(start, source.indexOf('    if (notificationId)', start))
  const message = new Function('error', `${compile(snippet)}; return message`)
  assert.equal(message(new Error('Bearer secret customer@example.test')), 'Transactional email failed')
  for (const value of ['Authoritative order data is unavailable', 'Stored order email is unavailable', 'Email provider returned HTTP 429', 'Email was accepted but its delivery record could not be updated']) assert.equal(message(new Error(value)), value)
  assert.equal(message(new Error('Email provider returned HTTP 429 secret')), 'Transactional email failed')
  for (const name of ['send-order-email', 'create-stripe-checkout', 'stripe-webhook']) assert.match(read(`supabase/functions/${name}/index.ts`), /supabase-js@2\.112\.4'/)
})

test('reservation release confirms, locks duplicate clicks, refreshes and recovers from failure', async () => {
  const start = app.indexOf('  const releaseReservation = async')
  const source = app.slice(start, app.indexOf('  const [view', start))
  let confirmed = false, calls = 0, refreshed = 0, busy, error, fail = false, unblock
  const lock = { current: false }
  const release = new Function('confirm', 'releaseLock', 'setReleasing', 'setReleaseError', 'cancelUnpaidOrder', 'refresh', 'note', 'logOperationFailure', `${compile(source)}; return releaseReservation`)(
    () => confirmed, lock, value => { busy = value }, value => { error = value },
    async () => { calls++; if (fail) throw new Error('private'); await new Promise(resolve => { unblock = resolve }) },
    async () => { refreshed++ }, () => {}, () => {})
  const order = { id: 'fixture', order_number: 1 }
  await release(order); assert.equal(calls, 0)
  confirmed = true
  const pending = release(order); await release(order); assert.equal(calls, 1); assert.equal(busy, 'fixture')
  unblock(); await pending; assert.equal(refreshed, 1); assert.equal(busy, null); assert.equal(lock.current, false)
  fail = true; await release(order); assert.match(error, /could not be cancelled or refreshed/); assert.equal(lock.current, false); assert.equal(busy, null)
  fail = false; const retry = release(order); assert.equal(error, null); unblock(); await retry; assert.equal(refreshed, 2)
})
