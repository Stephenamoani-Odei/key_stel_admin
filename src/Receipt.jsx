import { money, dateTime } from './lib.js'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const RECEIPT_CSS = `
.rc{font-family:'Courier New',monospace;font-size:12px;line-height:1.45;color:#000;width:76mm;margin:0 auto;padding:4mm 2mm;background:#fff}
.rc .c{text-align:center}.rc .b{font-weight:700}.rc .big{font-size:17px;letter-spacing:1px}
.rc .row{display:flex;justify-content:space-between;gap:8px}.rc .tot{font-size:15px;font-weight:700}
.rc hr{border:0;border-top:1px dashed #000;margin:6px 0}.rc .item{margin:3px 0}.rc .sub{padding-left:8px}
`

// Order is escaped here because customer names on online orders are typed by the public.
export function receiptHTML(o, s = {}) {
  const items = (o.order_items || []).map((i) => {
    const line = i.qty * i.unit_price
    return `<div class="item"><div>${esc(i.products?.name || 'Item')}</div><div class="row sub"><span>${i.qty} x ${money(i.unit_price)}</span><span>${money(line)}</span></div></div>`
  }).join('')
  const sub = (o.order_items || []).reduce((t, i) => t + i.qty * i.unit_price, 0)
  const cash = o.payment_type === 'Cash' && o.amount_paid != null
  const paid = o.payment_status === 'paid'
  const named = o.customer_name && o.customer_name !== 'Walk-in customer'
  const who = o.served_by ? String(o.served_by).split('@')[0] : ''
  return `<div class="rc">
    <div class="c b big">${esc(s.store_name || 'KEY-STEL')}</div>
    ${s.address ? `<div class="c">${esc(s.address)}</div>` : ''}${s.phone ? `<div class="c">Tel: ${esc(s.phone)}</div>` : ''}
    <hr>
    <div class="row"><span>Receipt</span><b>#${esc(o.id)}</b></div>
    <div class="row"><span>Date</span><span>${esc(dateTime(o.created_at))}</span></div>
    ${who ? `<div class="row"><span>Served by</span><span>${esc(who)}</span></div>` : ''}
    ${named ? `<div class="row"><span>Customer</span><span>${esc(o.customer_name)}</span></div>` : ''}
    ${o.phone ? `<div class="row"><span>Phone</span><span>${esc(o.phone)}</span></div>` : ''}
    <hr>${items}<hr>
    ${o.discount > 0 ? `<div class="row"><span>Subtotal</span><span>${money(sub)}</span></div><div class="row"><span>Discount</span><span>-${money(o.discount)}</span></div>` : ''}
    <div class="row tot"><span>TOTAL</span><span>${money(o.total)}</span></div>
    <div class="row"><span>Payment</span><span>${esc(o.payment_type)}</span></div>
    ${cash ? `<div class="row"><span>Cash received</span><span>${money(o.amount_paid)}</span></div><div class="row"><span>Change</span><span>${money(o.amount_paid - o.total)}</span></div>` : ''}
    <div class="row"><span>Status</span><b>${paid ? 'PAID' : 'NOT YET PAID'}</b></div>
    <hr><div class="c">${esc(s.receipt_footer || 'Thank you for shopping with Key-Stel.')}</div>
  </div>`
}

export default function Receipt({ order, settings }) {
  return <><style>{RECEIPT_CSS}</style><div className="rcwrap" dangerouslySetInnerHTML={{ __html: receiptHTML(order, settings || {}) }} /></>
}

// Prints through a hidden frame: no popup blockers, nothing else from the page leaks onto the paper.
export function printReceipt(order, settings) {
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(f)
  const d = f.contentWindow.document
  d.open()
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${esc(order.id)}</title><style>${RECEIPT_CSS}@page{size:80mm auto;margin:3mm}body{margin:0}</style></head><body>${receiptHTML(order, settings || {})}</body></html>`)
  d.close()
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000) }, 250)
}
