// Run:  node --test tests/sms.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { smsInfo, normGhana, TEMPLATES } from '../src/sms.js'

test('every ready-made message fits one plain SMS (no emoji, 160 characters or fewer)', () => {
  for (const [name, make] of TEMPLATES) for (const phone of ['0541954924', '']) {
    const t = make('Key-Stel', phone)
    const i = smsInfo(t)
    assert.equal(i.unicode, false, name)
    assert.ok(i.parts <= 1 || t.length <= 200, `${name} is ${i.length} characters`)
    assert.ok(!t.includes('undefined') && !/\{.*\}/.test(t), name)
  }
})
test('the phone sentence disappears when Settings has no phone', () => {
  const thanks = TEMPLATES.find(([n]) => n === 'Thank you')[1]
  assert.ok(thanks('Key-Stel', '0541954924').includes('0541954924'))
  assert.ok(!thanks('Key-Stel', '').includes('Call us'))
})
test('SMS parts', () => {
  assert.equal(smsInfo('a'.repeat(160)).parts, 1)
  assert.equal(smsInfo('a'.repeat(161)).parts, 2)
  assert.equal(smsInfo('Merry Christmas 🎄').unicode, true)
})
test('Ghana numbers', () => {
  assert.equal(normGhana('024 123 4567'), '233241234567')
  assert.equal(normGhana('0301234567'), null)
})

import { previewThankYou, DEFAULT_THANK_YOU } from '../src/sms.js'
test('thank-you preview matches the database wording', () => {
  assert.equal(previewThankYou('', { shop: 'Key-Stel' }), 'Thank you for purchasing 2 x Heavy Duty Steel Door from Key-Stel. Your total is GHS 3,600.00. We look forward to serving you again.')
  assert.equal(previewThankYou('Hi {name}, thanks for buying {items}! Total {total}. Call {phone}.', { shop: 'Key-Stel', phone: '0541954924' }), 'Hi Ama, thanks for buying 2 x Heavy Duty Steel Door! Total GHS 3,600.00. Call 0541954924.')
  assert.equal(previewThankYou('Call us on {phone} .', { shop: 'K', phone: '' }), 'Call us on.')
  assert.equal(smsInfo(DEFAULT_THANK_YOU.replace('{items}', '2 x Door').replace('{shop}', 'Key-Stel').replace('{total}', 'GHS 100.00')).unicode, false)
})

import { callFunction } from '../src/sms.js'
const fakeSb = (result) => ({ functions: { invoke: async () => result } })
test('server function errors become plain English', async () => {
  assert.deepEqual(await callFunction(fakeSb({ data: { ok: true, sent: 2 }, error: null }), 'broadcast-sms', {}), { ok: true, sent: 2 })
  const net = await callFunction(fakeSb({ data: null, error: { name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') } }), 'broadcast-sms', {})
  assert.equal(net.ok, false); assert.equal(net.unreachable, true); assert.match(net.error, /not been deployed/)
  const missing = await callFunction(fakeSb({ data: null, error: { name: 'FunctionsHttpError', context: { status: 404, json: async () => ({ message: 'Requested function was not found' }) } } }), 'create-staff', {})
  assert.equal(missing.unreachable, true); assert.match(missing.error, /staff account service/)
  const known = await callFunction(fakeSb({ data: null, error: { name: 'FunctionsHttpError', context: { status: 403, json: async () => ({ ok: false, error: 'Only admins can add staff.' }) } } }), 'create-staff', {})
  assert.deepEqual(known, { ok: false, error: 'Only admins can add staff.' })
})
