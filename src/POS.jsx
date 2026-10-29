import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Minus, Trash2, Printer } from 'lucide-react'
import { supabase } from './supabase.js'
import { money } from './lib.js'
import Receipt, { printReceipt } from './Receipt.jsx'
import { callBroadcast, normGhana } from './sms.js'

const METHODS = ['Cash', 'MoMo', 'Card']
const blank = { name: '', phone: '', method: 'Cash', discount: '', received: '', note: '' }

export default function POS({ onDone }) {
  const [products, setProducts] = useState([]), [q, setQ] = useState(''), [cart, setCart] = useState([]), [f, setF] = useState(blank)
  const [settings, setSettings] = useState(null), [today, setToday] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(null), [smsNote, setSmsNote] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function load() {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const [p, s, t] = await Promise.all([
      supabase.from('products').select('id,name,price,stock,images').order('name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('orders').select('total,payment_type').eq('channel', 'walk-in').neq('status', 'Cancelled').gte('created_at', start.toISOString()),
    ])
    if (p.error) setErr(p.error.message)
    setProducts(p.data || []); setSettings(s.data); setToday(t.data || [])
  }
  useEffect(() => { load() }, [])

  const needPhone = !!settings && 'thank_you_enabled' in settings && settings.thank_you_enabled !== false && settings.require_sale_phone !== false
  const shown = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [products, q])
  const add = (p) => setCart((c) => {
    const ex = c.find((l) => l.id === p.id)
    if (ex) return c.map((l) => (l.id === p.id ? { ...l, qty: Math.min(l.qty + 1, p.stock) } : l))
    return [...c, { id: p.id, name: p.name, stock: p.stock, price: String(p.price), qty: 1 }]
  })
  const setQty = (id, qty) => setCart((c) => c.flatMap((l) => (l.id !== id ? [l] : qty < 1 ? [] : [{ ...l, qty: Math.min(qty, l.stock) }])))
  const setPrice = (id, v) => setCart((c) => c.map((l) => (l.id === id ? { ...l, price: v } : l)))

  const sub = cart.reduce((s, l) => s + (+l.price || 0) * l.qty, 0)
  const disc = Math.min(Math.max(+f.discount || 0, 0), sub)
  const total = sub - disc
  const received = +f.received || 0
  const change = received - total
  const cashShort = f.method === 'Cash' && received < total

  async function complete() {
    setErr('')
    if (!cart.length) return setErr('Add at least one door to the sale.')
    if (needPhone && !normGhana(f.phone)) return setErr("Enter the customer's Ghana mobile number (for example 0241234567) so they receive their thank-you message.")
    if (cashShort) return setErr('Cash received is less than the total.')
    setBusy(true)
    const { data: id, error } = await supabase.rpc('record_walkin_sale', {
      p_customer_name: f.name, p_phone: f.phone, p_payment: f.method,
      p_items: cart.map((l) => ({ product_id: l.id, qty: l.qty, unit_price: +l.price })),
      p_discount: disc, p_amount_paid: f.method === 'Cash' ? received : null, p_note: f.note,
    })
    if (error) { setBusy(false); return setErr(error.message) }
    const { data: order } = await supabase.from('orders').select('*, order_items(qty,unit_price,products(name))').eq('id', id).single()
    const hasPhone = !!normGhana(f.phone)
    setBusy(false); setDone(order); setCart([]); setF(blank); load(); onDone?.()
    // The database queues the customer's thank-you message; this sends it right away.
    setSmsNote(hasPhone ? 'Sending a thank-you message to the customer...' : 'No phone number was entered, so no thank-you message was sent.')
    if (hasPhone) callBroadcast(supabase, { mode: 'flush' }).then((r) => setSmsNote(!r.ok ? `The thank-you message has not gone yet: ${r.error}` : r.sent > 0 ? 'Thank-you message sent to the customer.' : ''))
  }

  if (done) return (
    <section className="page">
      <div className="head"><div><h1>Sale recorded</h1><p>Stock has been updated. Print the receipt for the customer.</p></div></div>
      <div className="card" style={{ maxWidth: 420 }}>
        <Receipt order={done} settings={settings} />
        {smsNote && <p style={{ marginTop: 10 }}><small>{smsNote}</small></p>}
        <div className="tools" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => printReceipt(done, settings)}><Printer size={16} /> Print receipt</button>
          <button className="btn ghost" onClick={() => { setDone(null); setSmsNote('') }}>New sale</button>
        </div>
      </div>
    </section>
  )

  const by = (m) => today.filter((o) => o.payment_type === m).reduce((s, o) => s + +o.total, 0)
  return (
    <section className="page">
      <div className="head"><div><h1>Point of Sale</h1><p>Record a sale when a customer buys in the shop.</p></div></div>
      <div className="chips">
        <div className="card"><small>Shop sales today</small><div className="kv">{today.length}</div></div>
        <div className="card"><small>Cash today</small><div className="kv">{money(by('Cash'))}</div></div>
        <div className="card"><small>MoMo today</small><div className="kv">{money(by('MoMo'))}</div></div>
        <div className="card"><small>Card today</small><div className="kv">{money(by('Card'))}</div></div>
      </div>
      <div className="pos">
        <div className="card">
          <label className="search" style={{ maxWidth: 'none', marginBottom: 12 }}><Search size={17} /><input placeholder="Search doors" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {products.length === 0 ? <p className="empty">No products yet. Add doors in Products first.</p> :
            <div className="pgrid">{shown.map((p) => (
              <button key={p.id} className="pitem" disabled={p.stock < 1} onClick={() => add(p)}>
                {p.images?.[0] ? <img src={p.images[0]} alt="" /> : <div className="thumb" style={{ width: '100%', height: 90 }} />}
                <b>{p.name}</b><span>{money(p.price)}</span><small className={p.stock < 1 ? 'low' : ''}>{p.stock < 1 ? 'Out of stock' : `${p.stock} in stock`}</small>
              </button>))}</div>}
        </div>

        <div className="card" id="cart">
          <h2 style={{ marginBottom: 8 }}>Current sale</h2>
          {cart.length === 0 ? <p className="empty">Tap a door to add it.</p> : cart.map((l) => (
            <div className="cartline" key={l.id}>
              <div><b>{l.name}</b>
                <div className="stepper" style={{ marginTop: 6 }}>
                  <button onClick={() => setQty(l.id, l.qty - 1)} aria-label="Less"><Minus size={14} /></button><span style={{ width: 28, textAlign: 'center' }}>{l.qty}</span>
                  <button onClick={() => setQty(l.id, l.qty + 1)} aria-label="More"><Plus size={14} /></button>
                  <input type="number" min="0" step="0.01" value={l.price} onChange={(e) => setPrice(l.id, e.target.value)} style={{ width: 100 }} aria-label="Price each" />
                </div></div>
              <div style={{ textAlign: 'right' }}><b>{money((+l.price || 0) * l.qty)}</b><br /><button className="act-btn" onClick={() => setQty(l.id, 0)} aria-label="Remove"><Trash2 size={15} /></button></div>
            </div>))}

          <div className="sheet" style={{ width: 'auto', marginTop: 12 }}>
            <div className="two"><label>Customer name (optional)<input value={f.name} onChange={set('name')} /></label><label>Phone{needPhone ? ' (needed for the thank-you SMS)' : ' (optional)'}<input type="tel" placeholder="0241234567" value={f.phone} onChange={set('phone')} /></label></div>
            <label>Payment method<div className="methods">{METHODS.map((m) => <button type="button" key={m} className={f.method === m ? 'on' : ''} onClick={() => setF({ ...f, method: m })}>{m}</button>)}</div></label>
            <div className="two"><label>Discount (GH₵)<input type="number" min="0" step="0.01" value={f.discount} onChange={set('discount')} /></label>
              {f.method === 'Cash' && <label>Cash received<input type="number" min="0" step="0.01" value={f.received} onChange={set('received')} /></label>}</div>
            {f.method === 'Cash' && total > 0 && <button type="button" className="linkbtn" onClick={() => setF({ ...f, received: String(total) })}>Customer paid exact amount</button>}
            <label>Note (optional)<input value={f.note} onChange={set('note')} /></label>
          </div>

          <div className="totals">
            {disc > 0 && <div className="row"><span>Subtotal</span><span>{money(sub)}</span></div>}
            {disc > 0 && <div className="row"><span>Discount</span><span>-{money(disc)}</span></div>}
            <div className="row big"><span>Total</span><span>{money(total)}</span></div>
            {f.method === 'Cash' && received > 0 && <div className="row"><span>Change to give</span><b className={change < 0 ? 'low' : ''}>{change < 0 ? `Short by ${money(-change)}` : money(change)}</b></div>}
          </div>
          {err && <p className="err">{err}</p>}
          <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy || !cart.length} onClick={complete}>{busy ? 'Recording...' : 'Complete sale'}</button>
        </div>
      </div>
      {cart.length > 0 && <div className="posbar"><span><b>{cart.reduce((n, l) => n + l.qty, 0)}</b> in sale</span><b>{money(total)}</b>
        <button className="btn" onClick={() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' })}>Review sale</button></div>}
    </section>
  )
}
