import { useEffect, useState } from 'react'
import { Download, Eye, X } from 'lucide-react'
import { supabase } from './supabase.js'
import { downloadCSV, dateTime } from './lib.js'

const iso = (d) => d.toISOString().slice(0, 10)
const cards = [
  ['sales', 'Sales history', 'One row per order with customer, payment, status and total.'],
  ['items', 'Order line items', 'One row per door sold, for stock reconciliation.'],
  ['customers', 'Customer roster', 'Every customer in the period with orders placed and total spent.'],
  ['stock', 'Stock levels', 'Current stock for every product. Ignores the date range.'],
]
export default function Reports() {
  const now = new Date()
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1))), [to, setTo] = useState(iso(now)), [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [prev, setPrev] = useState(null)
  async function run(kind) {
    setBusy(kind); setMsg('')
    const tag = kind === 'stock' ? iso(now) : `${from}_to_${to}`
    if (kind === 'stock') {
      const { data, error } = await supabase.from('products').select('name,price,stock,low_stock_threshold,available,categories(name)').order('name')
      if (error) setMsg(error.message)
      else setPrev({ title: 'Stock levels', name: `keystel-stock-${tag}.csv`, rows: [['Product', 'Category', 'Price (GHS)', 'Stock', 'Low stock alert', 'Shown on storefront'], ...data.map((p) => [p.name, p.categories?.name, p.price, p.stock, p.low_stock_threshold, p.available ? 'Yes' : 'No'])] })
    } else {
      const { data, error } = await supabase.from('orders').select('*, order_items(qty,unit_price,products(name,categories(name)))')
        .gte('created_at', new Date(from + 'T00:00:00').toISOString()).lte('created_at', new Date(to + 'T23:59:59.999').toISOString()).order('created_at').limit(5000)
      if (error) setMsg(error.message)
      else if (!data.length) setMsg('There are no orders in this date range.')
      else if (kind === 'sales') setPrev({ title: 'Sales history', name: `keystel-sales-${tag}.csv`, rows: [['Order #', 'Date', 'Channel', 'Customer', 'Phone', 'Address', 'Payment', 'Payment status', 'Reference', 'Status', 'Doors', 'Discount (GHS)', 'Total (GHS)', 'Refunded (GHS)', 'Served by'],
        ...data.map((o) => [o.id, dateTime(o.created_at), o.channel, o.customer_name, o.phone, o.address, o.payment_type, o.payment_status, o.payment_ref, o.status, o.order_items.reduce((s, i) => s + i.qty, 0), o.discount, o.total, o.refund_amount, o.served_by])] })
      else if (kind === 'items') setPrev({ title: 'Order line items', name: `keystel-items-${tag}.csv`, rows: [['Order #', 'Date', 'Product', 'Category', 'Qty', 'Unit price (GHS)', 'Line total (GHS)', 'Status'],
        ...data.filter((o) => o.status !== 'Cancelled').flatMap((o) => o.order_items.map((i) => [o.id, dateTime(o.created_at), i.products?.name || 'Removed product', i.products?.categories?.name, i.qty, i.unit_price, i.qty * i.unit_price, o.status]))] })
      else {
        const m = {}
        data.filter((o) => o.status !== 'Cancelled').forEach((o) => { const c = m[o.phone] || (m[o.phone] = { name: o.customer_name, phone: o.phone, address: o.address, orders: 0, spent: 0 }); c.name = o.customer_name; c.address = o.address; c.orders++; c.spent += +o.total })
        setPrev({ title: 'Customer roster', name: `keystel-customers-${tag}.csv`, rows: [['Customer', 'Phone', 'Latest address', 'Orders', 'Total spent (GHS)'], ...Object.values(m).map((c) => [c.name, c.phone, c.address, c.orders, c.spent])] })
      }
    }
    setBusy('')
  }
  return (
    <section className="page">
      <div className="head"><div><h1>Reports</h1><p>Preview your records here, then download them as CSV files that open in Excel.</p></div></div>
      <div className="card tools"><label>From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label></div>
      {msg && <p className="err">{msg}</p>}
      <div className="grid rep">{cards.map(([k, t, d]) => (
        <div className="card" key={k}><div className="ch"><h2>{t}</h2></div><p className="empty" style={{ padding: '0 0 14px' }}>{d}</p>
          <button className="btn" disabled={busy === k} onClick={() => run(k)}><Eye size={16} /> {busy === k ? 'Preparing...' : 'Preview'}</button></div>))}</div>
      {prev && <Preview prev={prev} onClose={() => setPrev(null)} />}
    </section>
  )
}

const SHOW = 100
function Preview({ prev, onClose }) {
  const [head, ...body] = prev.rows
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="modal dlg" onClick={onClose}>
      <div className="card prevbox" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="prevhead">
          <div><h2>{prev.title}</h2><small>{body.length} row{body.length === 1 ? '' : 's'}{body.length > SHOW ? `. Showing the first ${SHOW} here, the download has all of them.` : ''}</small></div>
          <button type="button" className="x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="tbl">{body.length === 0 ? <p className="empty">Nothing to show.</p> :
          <table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{body.slice(0, SHOW).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c ?? ''}</td>)}</tr>)}</tbody></table>}</div>
        <div className="tools dlgbtns" style={{ margin: 0 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn" disabled={!body.length} onClick={() => { downloadCSV(prev.name, prev.rows); onClose() }}><Download size={16} /> Download CSV</button>
        </div>
      </div>
    </div>
  )
}
