import { useState } from 'react'
import { Download } from 'lucide-react'
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
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1))), [to, setTo] = useState(iso(now)), [busy, setBusy] = useState(''), [msg, setMsg] = useState('')
  async function run(kind) {
    setBusy(kind); setMsg('')
    const tag = kind === 'stock' ? iso(now) : `${from}_to_${to}`
    if (kind === 'stock') {
      const { data, error } = await supabase.from('products').select('name,price,stock,low_stock_threshold,available,categories(name)').order('name')
      if (error) setMsg(error.message)
      else downloadCSV(`keystel-stock-${tag}.csv`, [['Product', 'Category', 'Price (GHS)', 'Stock', 'Low stock alert', 'Shown on storefront'], ...data.map((p) => [p.name, p.categories?.name, p.price, p.stock, p.low_stock_threshold, p.available ? 'Yes' : 'No'])])
    } else {
      const { data, error } = await supabase.from('orders').select('*, order_items(qty,unit_price,products(name,categories(name)))')
        .gte('created_at', new Date(from + 'T00:00:00').toISOString()).lte('created_at', new Date(to + 'T23:59:59.999').toISOString()).order('created_at').limit(5000)
      if (error) setMsg(error.message)
      else if (!data.length) setMsg('There are no orders in this date range.')
      else if (kind === 'sales') downloadCSV(`keystel-sales-${tag}.csv`, [['Order #', 'Date', 'Channel', 'Customer', 'Phone', 'Address', 'Payment', 'Payment status', 'Reference', 'Status', 'Doors', 'Discount (GHS)', 'Total (GHS)', 'Served by'],
        ...data.map((o) => [o.id, dateTime(o.created_at), o.channel, o.customer_name, o.phone, o.address, o.payment_type, o.payment_status, o.payment_ref, o.status, o.order_items.reduce((s, i) => s + i.qty, 0), o.discount, o.total, o.served_by])])
      else if (kind === 'items') downloadCSV(`keystel-items-${tag}.csv`, [['Order #', 'Date', 'Product', 'Category', 'Qty', 'Unit price (GHS)', 'Line total (GHS)', 'Status'],
        ...data.flatMap((o) => o.order_items.map((i) => [o.id, dateTime(o.created_at), i.products?.name || 'Removed product', i.products?.categories?.name, i.qty, i.unit_price, i.qty * i.unit_price, o.status]))])
      else {
        const m = {}
        data.forEach((o) => { const c = m[o.phone] || (m[o.phone] = { name: o.customer_name, phone: o.phone, address: o.address, orders: 0, spent: 0 }); c.name = o.customer_name; c.address = o.address; c.orders++; c.spent += +o.total })
        downloadCSV(`keystel-customers-${tag}.csv`, [['Customer', 'Phone', 'Latest address', 'Orders', 'Total spent (GHS)'], ...Object.values(m).map((c) => [c.name, c.phone, c.address, c.orders, c.spent])])
      }
    }
    setBusy('')
  }
  return (
    <section className="page">
      <div className="head"><div><h1>Reports</h1><p>Download your records as CSV files that open in Excel.</p></div></div>
      <div className="card tools"><label>From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label></div>
      {msg && <p className="err">{msg}</p>}
      <div className="grid rep">{cards.map(([k, t, d]) => (
        <div className="card" key={k}><div className="ch"><h2>{t}</h2></div><p className="empty" style={{ padding: '0 0 14px' }}>{d}</p>
          <button className="btn" disabled={busy === k} onClick={() => run(k)}><Download size={16} /> {busy === k ? 'Preparing...' : 'Download CSV'}</button></div>))}</div>
    </section>
  )
}
