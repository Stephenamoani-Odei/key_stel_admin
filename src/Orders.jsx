import { Fragment, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { money, dateTime, statuses } from './lib.js'
import { printReceipt } from './Receipt.jsx'

export default function Orders({ q: q0 = '', onChange }) {
  const [rows, setRows] = useState([]), [tab, setTab] = useState('All'), [q, setQ] = useState(q0), [open, setOpen] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(true), [settings, setSettings] = useState(null)
  useEffect(() => { supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data)) }, [])
  async function setPaid(o, paid) {
    const payment_status = paid ? 'paid' : 'unpaid'
    const { error } = await supabase.from('orders').update({ payment_status }).eq('id', o.id)
    if (error) return setErr(error.message)
    setRows((r) => r.map((x) => (x.id === o.id ? { ...x, payment_status } : x)))
  }
  useEffect(() => {
    supabase.from('orders').select('*, order_items(qty,unit_price,products(name,images))').order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }) => { if (error) setErr(error.message); setRows(data || []); setLoading(false) })
  }, [])
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
      <div className="tools"><div className="tabs" style={{ margin: 0 }}>{['All', ...statuses].map((s) => <button key={s} className={tab === s ? 'on' : ''} onClick={() => setTab(s)}>{s} ({count(s)})</button>)}</div>
        <input placeholder="Search by order number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {loading ? <p>Loading...</p> : shown.length === 0 ? <p className="empty">{rows.length ? 'No orders match this filter.' : 'No orders yet. Orders placed on the storefront will appear here.'}</p> :
          <table><thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th></tr></thead><tbody>{shown.map((o) => (
            <Fragment key={o.id}>
              <tr className="click" onClick={() => setOpen(open === o.id ? null : o.id)}>
                <td><b>#{o.id}</b></td><td>{o.customer_name}{o.channel === 'walk-in' && <span className="tag">Walk-in</span>}<small>{o.phone}</small></td><td>{qty(o)}</td><td>{money(o.total)}</td>
                <td><span className="pill">{o.payment_type}</span><small className={o.payment_status === 'paid' ? 'ok' : 'low'}>{o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</small></td>
                <td onClick={(e) => e.stopPropagation()}><select className={'st ' + o.status.toLowerCase()} value={o.status} onChange={(e) => setStatus(o, e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></td>
                <td>{dateTime(o.created_at)}</td>
              </tr>
              {open === o.id && <tr><td colSpan="7" className="detail">
                <div className="dgrid"><div><small>Phone</small>{o.phone}</div><div><small>Delivery address</small>{o.address}</div><div><small>Payment reference</small>{o.payment_ref || 'None'}</div></div>
                <div className="tools"><button className="btn" onClick={() => printReceipt(o, settings)}>Print receipt</button><button className="btn ghost" onClick={() => setPaid(o, o.payment_status !== 'paid')}>{o.payment_status === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}</button></div>
                <table className="mini"><thead><tr><th></th><th>Product</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{o.order_items.map((i, n) => (
                  <tr key={n}><td>{i.products?.images?.[0] ? <img className="thumb" src={i.products.images[0]} alt="" /> : <div className="thumb" />}</td><td>{i.products?.name || 'Removed product'}</td><td>{i.qty}</td><td>{money(i.unit_price)}</td><td>{money(i.qty * i.unit_price)}</td></tr>))}</tbody></table>
              </td></tr>}
            </Fragment>))}</tbody></table>}
      </div>
    </section>
  )
}
