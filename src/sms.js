// Helpers for SMS broadcasts (the sending itself happens in the broadcast-sms function).
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM_EXTENDED = '^{}\\[~]|€'

/** How many SMS parts a message needs. Emoji and curly quotes switch the whole message to Unicode (70 characters a part). */
export function smsInfo(text) {
  let units = 0
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) units += 1
    else if (GSM_EXTENDED.includes(ch)) units += 2
    else { const len = text.length; return { unicode: true, length: len, parts: len <= 70 ? 1 : Math.ceil(len / 67) } }
  }
  return { unicode: false, length: units, parts: units <= 160 ? 1 : Math.ceil(units / 153) }
}

/** Ghana mobile numbers only, as 233XXXXXXXXX, or null. Same rule as the database. */
export function normGhana(p) {
  const d = (p || '').replace(/\D/g, '')
  if (/^0[25]\d{8}$/.test(d)) return '233' + d.slice(1)
  if (/^233[25]\d{8}$/.test(d)) return d
  if (/^[25]\d{8}$/.test(d)) return '233' + d
  return null
}

const withPhone = (shop, phone, lead) => (phone ? ` ${lead} ${phone}.` : '')
export const TEMPLATES = [
  ['Merry Christmas', (shop, phone) => `Merry Christmas from ${shop}! Thank you for choosing us to keep your home safe. We wish you and your family joy and peace.`],
  ['Happy New Year', (shop, phone) => `Happy New Year from ${shop}! Thank you for your support. May the year ahead be safe and prosperous for you and your family.`],
  ['Happy Easter', (shop, phone) => `Happy Easter from ${shop}! Wishing you and your family a blessed and peaceful holiday. Thank you for your trust.`],
  ['Eid Mubarak', (shop, phone) => `Eid Mubarak from ${shop}! Wishing you and your family peace, joy and blessings. Thank you for your trust.`],
  ['Independence Day', (shop, phone) => `Happy Independence Day from ${shop}! Proud to serve Ghana. Thank you for your support.`],
  ['Thank you', (shop, phone) => `Thank you for shopping with ${shop}. We value your trust.${withPhone(shop, phone, 'Call us on')}`],
  ['New doors / promotion', (shop, phone) => `${shop}: new doors have arrived!${phone ? ` Call ${phone} or visit us` : ' Visit us'} to see the latest designs and prices.`],
]

const LABELS = { 'broadcast-sms': 'SMS', 'create-staff': 'staff account' }

/** Calls one of the server functions and always returns { ok, ... } with an error a shop owner can act on. */
export async function callFunction(supabase, name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data
  const status = error.context?.status
  const noReply = error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError' || status === 404 || (status === undefined && typeof error.context?.json !== 'function')
  if (noReply) return { ok: false, unreachable: true, error: `The ${LABELS[name] || name} service could not be reached. Most likely the "${name}" function has not been deployed yet, or the browser blocked the request. Ask your developer to run the setup script, then try again.` }
  try { const j = await error.context.json(); return { ok: false, error: j.error || j.message || 'That did not work.' } } catch { return { ok: false, error: `The ${LABELS[name] || name} service gave an unexpected answer.` } }
}
export const callBroadcast = (supabase, body) => callFunction(supabase, 'broadcast-sms', body)

/** Same wording rules as the database, so Settings can show a preview. */
export const DEFAULT_THANK_YOU = 'Thank you for purchasing {items} from {shop}. Your total is {total}. We look forward to serving you again.'
export const DEFAULT_ORDER_RECEIVED = 'Thank you for your order of {items} from {shop}. Your total is {total}. We will call you shortly to confirm it and arrange payment.'
export function previewThankYou(template, { shop, phone, name = 'Ama', items = '2 x Heavy Duty Steel Door', total = 'GHS 3,600.00' } = {}, fallback = DEFAULT_THANK_YOU) {
  let out = (template || '').trim() || fallback
  out = out.replaceAll('{name}', name).replaceAll('{items}', items).replaceAll('{total}', total).replaceAll('{shop}', shop || 'Key-Stel').replaceAll('{phone}', phone || '')
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
}
