import { Fragment, useEffect, useMemo, useState } from 'react'
import { Download, MessageCircle, Phone } from 'lucide-react'
import { supabase } from './supabase.js'
import { money, dateTime, downloadCSV } from './lib.js'

const digits = (p) => (p || '').replace(/\D/g, '')
const waLink = (p) => { let d = digits(p); if (d.startsWith('0')) d = '233' + d.slice(1); return d ? `https://wa.me/${d}` : null }

export default function Customers() {
  const [orders, setOrders] = useState([]), [q, setQ] = useState(''), [open, setOpen] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('orders').select('id,customer_name,phone,address,total,status,payment_type,payment_status,channel,created_at')
      .order('created_at', { ascending: false }).limit(5000)
      .then(({ data, error }) => { if (error) setErr(error.message); setOrders(data || []); setLoading(false) })
  }, [])

  // There is no separate customers table: a customer is everyone who shares a phone number (or a typed name for shop sales).
  const customers = useMemo(() => {
    const m = new Map()
    orders.forEach((o) => {
      const named = o.customer_name && o.customer_name !== 'Walk-in customer'
      const key = digits(o.phone) || (named ? 'n:' + o.customer_name.trim().toLowerCase() : null)
      if (!key) return
      const c = m.get(key) || { key, name: o.customer_name, phone: o.phone, address: '', orders: [], spent: 0, online: 0, shop: 0 }
      if (!c.orders.length) { c.name = named ? o.customer_name : c.name; c.phone = o.phone || c.phone }
      if (!c.address && o.address && o.address !== 'Bought in store') c.address = o.address
      c.orders.push(o); c.spent += +o.total; o.channel === 'walk-in' ? c.shop++ : c.online++
      m.set(key, c)
    })
    return [...m.values()].sort((a, b) => b.spent - a.spent)
  }, [orders])

  const term = q.trim().toLowerCase()
  const shown = customers.filter((c) => !term || c.name.toLowerCase().includes(term) || digits(c.phone).includes(digits(term) || '#none#'))
  const repeat = customers.filter((c) => c.orders.length > 1).length

  function exportCsv() {
    downloadCSV('keystel-customers.csv', [['Customer', 'Phone', 'Address', 'Orders', 'Total spent (GHS)', 'Last order'],
      ...customers.map((c) => [c.name, c.phone, c.address, c.orders.length, c.spent, dateTime(c.orders[0].created_at)])])
  }
  return (
    <section className="page">
      <div className="head"><div><h1>Customers</h1><p>Everyone who has bought from you, built from your orders.</p></div>
        <button className="btn ghost" onClick={exportCsv} disabled={!customers.length}><Download size={16} /> Download CSV</button></div>
      <div className="chips">
        <div className="card"><small>Customers</small><div className="kv">{customers.length}</div></div>
        <div className="card"><small>Repeat customers</small><div className="kv">{repeat}</div></div>
        <div className="card"><small>Bought online</small><div className="kv">{customers.filter((c) => c.online).length}</div></div>
        <div className="card"><small>Bought in shop</small><div className="kv">{customers.filter((c) => c.shop).length}</div></div>
      </div>
      <div className="tools"><input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {loading ? <p>Loading...</p> : shown.length === 0 ? <p className="empty">{customers.length ? 'No customer matches that search.' : 'Customers appear here after their first order. Walk-in sales with no name or phone are not counted.'}</p> :
          <table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Last order</th><th>Contact</th></tr></thead><tbody>{shown.map((c) => (
            <Fragment key={c.key}>
              <tr className="click" onClick={() => setOpen(open === c.key ? null : c.key)}>
                <td><b>{c.name}</b>{c.online > 0 && <span className="tag">Online</span>}{c.shop > 0 && <span className="tag">Shop</span>}</td>
                <td>{c.phone || 'None'}</td><td>{c.orders.length}</td><td>{money(c.spent)}</td><td>{dateTime(c.orders[0].created_at)}</td>
                <td className="act" onClick={(e) => e.stopPropagation()}>
                  {c.phone && <a className="iconlink" href={`tel:${digits(c.phone)}`} aria-label="Call" title="Call"><Phone size={16} /></a>}
                  {waLink(c.phone) && <a className="iconlink" href={waLink(c.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp"><MessageCircle size={16} /></a>}
                </td>
              </tr>
              {open === c.key && <tr><td colSpan="6" className="detail">
                {c.address && <p style={{ marginBottom: 10 }}><small>Delivery address</small>{c.address}</p>}
                <table className="mini"><thead><tr><th>Order</th><th>Date</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead><tbody>{c.orders.map((o) => (
                  <tr key={o.id}><td><b>#{o.id}</b></td><td>{dateTime(o.created_at)}</td><td>{o.payment_type} ({o.payment_status === 'paid' ? 'Paid' : 'Unpaid'})</td><td>{o.status}</td><td>{money(o.total)}</td></tr>))}</tbody></table>
              </td></tr>}
            </Fragment>))}</tbody></table>}
      </div>
    </section>
  )
}
