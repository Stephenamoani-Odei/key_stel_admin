import { Fragment, useEffect, useState } from 'react'
import { Phone, MessageCircle } from 'lucide-react'
import { supabase } from './supabase.js'
import { money, dateTime, statuses, digits, waLink } from './lib.js'
import { printReceipt } from './Receipt.jsx'
import { callBroadcast, normGhana } from './sms.js'

export default function Orders({ q: q0 = '', onChange, admin }) {
  const [rows, setRows] = useState([]), [tab, setTab] = useState('All'), [q, setQ] = useState(q0), [open, setOpen] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(true), [settings, setSettings] = useState(null)
  useEffect(() => { supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data)) }, [])
  const [method, setMethod] = useState('Cash')
  const [cancelFor, setCancelFor] = useState(null), [reason, setReason] = useState(''), [restock, setRestock] = useState(true), [refund, setRefund] = useState(''), [busy, setBusy] = useState(false)
  const [sms, setSms] = useState({})
  async function loadSms(id) {
    const { data } = await supabase.from('sms_outbox').select('kind,status,note,created_at').eq('order_id', id).order('id', { ascending: false })
    setSms((s) => ({ ...s, [id]: data || [] }))
  }
  const toggle = (o) => { const next = open === o.id ? null : o.id; setOpen(next); if (next) loadSms(o.id) }
  async function resendThanks(o) {
    setErr('')
    const { error } = await supabase.rpc('resend_thank_you', { p_order: o.id })
    if (error) return setErr(error.message)
    const r = await callBroadcast(supabase, { mode: 'flush' })
    if (!r.ok) setErr(`The message is queued but could not be sent yet: ${r.error}`)
    loadSms(o.id)
  }
  async function recordPayment(o, paid) {
    const change = paid ? { payment_status: 'paid', payment_type: method, amount_paid: o.total } : { payment_status: 'unpaid', amount_paid: null }
    const { error } = await supabase.from('orders').update(change).eq('id', o.id)
    if (error) return setErr(error.message)
    setRows((r) => r.map((x) => (x.id === o.id ? { ...x, ...change } : x)))
    // Recording an online order's payment queues the customer's thank-you message; send it now.
    if (paid && o.channel !== 'walk-in') callBroadcast(supabase, { mode: 'flush' }).then(() => loadSms(o.id))
  }
  async function load() {
    const { data, error } = await supabase.from('orders').select('*, order_items(qty,unit_price,products(name,images))').order('created_at', { ascending: false }).limit(500)
    if (error) setErr(error.message); setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  async function cancelOrder(o) {
    setErr(''); setBusy(true)
    const { error } = await supabase.rpc('cancel_order', { p_order_id: o.id, p_reason: reason, p_restock: restock, p_refund: o.payment_status === 'paid' ? (+refund || 0) : null })
    setBusy(false)
    if (error) return setErr(error.message)
    setCancelFor(null); await load(); onChange?.()
  }
  async function setStatus(o, status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', o.id)
    if (error) return setErr(error.message)
    setRows(rows.map((r) => (r.id === o.id ? { ...r, status } : r))); onChange?.()
  }
  const term = q.trim().toLowerCase().replace('#', '')
  const shown = rows.filter((o) => (tab === 'All' || o.status === tab) && (!term || String(o.id) === term || o.customer_name.toLowerCase().includes(term) || o.phone.includes(term)))
  const count = (s) => rows.filter((o) => s === 'All' || o.status === s).length
  const qty = (o) => o.order_items.reduce((s, i) => s + i.qty, 0)
  return (
    <section className="page">
      <div className="head"><div><h1>Orders</h1><p>Track every order from request to delivery.</p></div></div>
      <div className="tools"><div className="tabs" style={{ margin: 0 }}>{['All', ...statuses, 'Cancelled'].map((s) => <button key={s} className={tab === s ? 'on' : ''} onClick={() => setTab(s)}>{s} ({count(s)})</button>)}</div>
        <input placeholder="Search by order number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {loading ? <p>Loading...</p> : shown.length === 0 ? <p className="empty">{rows.length ? 'No orders match this filter.' : 'No orders yet. Orders placed on the storefront will appear here.'}</p> :
          <table><thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th></tr></thead><tbody>{shown.map((o) => (
            <Fragment key={o.id}>
              <tr className="click" onClick={() => toggle(o)}>
                <td><b>#{o.id}</b></td><td>{o.customer_name}{o.channel === 'walk-in' && <span className="tag">Walk-in</span>}<small>{o.phone}</small></td><td>{qty(o)}</td><td>{money(o.total)}</td>
                <td><span className="pill">{o.payment_type}</span><small className={o.payment_status === 'paid' ? 'ok' : 'low'}>{o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</small></td>
                <td onClick={(e) => e.stopPropagation()}>{o.status === 'Cancelled' ? <span className="st cancelled">Cancelled</span> : <select className={'st ' + o.status.toLowerCase()} value={o.status} onChange={(e) => setStatus(o, e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>}</td>
                <td>{dateTime(o.created_at)}</td>
              </tr>
              {open === o.id && <tr><td colSpan="7" className="detail">
                <div className="dgrid"><div><small>Phone</small>{o.phone}</div><div><small>Delivery address</small>{o.address}</div><div><small>Payment reference</small>{o.payment_ref || 'None'}</div></div>
                <div className="tools"><button className="btn" onClick={() => printReceipt(o, settings)}>Print receipt</button>{o.phone && <a className="btn ghost" href={`tel:${digits(o.phone)}`}><Phone size={16} /> Call</a>}{waLink(o.phone) && <a className="btn ghost" href={waLink(o.phone)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}</div>
                {o.status !== 'Cancelled' && normGhana(o.phone) && (() => {
                  const rows = sms[o.id] || []
                  const say = (r) => (r.status === 'sent' ? 'sent' : r.status === 'failed' || r.status === 'expired' ? `not delivered${r.note ? ` (${r.note})` : ''}` : 'queued, sending now')
                  const names = { order_received: 'Order confirmation SMS', thank_you: 'Thank-you SMS', thank_you_resend: 'Thank-you SMS (sent again)' }
                  const text = rows.length ? [...rows].reverse().map((r) => `${names[r.kind] || 'SMS'}: ${say(r)}`).join('. ') + '.' : 'No SMS has gone out for this order yet.'
                  return <div className="tools" style={{ alignItems: 'center' }}><small>{text}</small><button className="btn ghost" onClick={() => resendThanks(o)}>{rows.length ? 'Send thank-you again' : 'Send thank-you message'}</button></div>
                })()}
                {o.status !== 'Cancelled' && <div className="tools" style={{ alignItems: 'center' }}>{o.payment_status === 'paid'
                  ? <><b>Paid by {o.payment_type}: {money(o.total)}</b><button className="btn ghost" onClick={() => recordPayment(o, false)}>Undo payment</button></>
                  : <><b>Payment of {money(o.total)} not yet received</b><select value={method} onChange={(e) => setMethod(e.target.value)} style={{ maxWidth: 140 }}>{['Cash', 'MoMo', 'Card'].map((m) => <option key={m}>{m}</option>)}</select><button className="btn" onClick={() => recordPayment(o, true)}>Record payment</button></>}</div>}
                {o.status === 'Cancelled' ? (
                  <div className="cancelbox"><b>Cancelled</b> by {o.cancelled_by || 'staff'}{o.cancelled_at && <> on {dateTime(o.cancelled_at)}</>}<br />Reason: {o.cancel_reason}
                    {o.refund_amount > 0 && <><br /><b>Refund due to customer: {money(o.refund_amount)}</b></>}</div>
                ) : cancelFor === o.id ? (
                  <div className="cancelbox">
                    <label>Why is this order being cancelled?<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer changed their mind" autoFocus /></label>
                    {o.payment_status === 'paid' && <label>Refund to give the customer (GH₵)<input type="number" min="0" max={o.total} step="0.01" value={refund} onChange={(e) => setRefund(e.target.value)} /></label>}
                    <label className="chk"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put the doors back in stock</label>
                    <div className="tools"><button className="btn danger" disabled={busy} onClick={() => cancelOrder(o)}>{busy ? 'Cancelling...' : 'Confirm cancellation'}</button><button className="btn ghost" onClick={() => setCancelFor(null)}>Keep order</button></div>
                  </div>
                ) : o.payment_status === 'paid' && !admin
                  ? <p style={{ marginBottom: 12 }}><small>A paid order can only be cancelled by an admin, because the money must be refunded.</small></p>
                  : <div className="tools"><button className="btn ghost danger" onClick={() => { setCancelFor(o.id); setReason(''); setRestock(true); setRefund(String(o.total)) }}>Cancel order</button></div>}
                <table className="mini"><thead><tr><th></th><th>Product</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{o.order_items.map((i, n) => (
                  <tr key={n}><td>{i.products?.images?.[0] ? <img className="thumb" src={i.products.images[0]} alt="" /> : <div className="thumb" />}</td><td>{i.products?.name || 'Removed product'}</td><td>{i.qty}</td><td>{money(i.unit_price)}</td><td>{money(i.qty * i.unit_price)}</td></tr>))}</tbody></table>
              </td></tr>}
            </Fragment>))}</tbody></table>}
      </div>
    </section>
  )
}
