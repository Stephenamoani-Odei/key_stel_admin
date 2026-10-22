import { useEffect, useRef, useState } from 'react'
import { DollarSign, ShoppingBag, DoorOpen, AlertTriangle, BarChart3, ArrowUp, Plus, ShoppingCart, FileText, Download } from 'lucide-react'
import { supabase } from './supabase.js'
import { money } from './lib.js'

const DAY = 864e5
export const COLORS = ['#e11d2e', '#2b2b2e', '#9a9aa0', '#d4d4d8']
const icons = { rev: DollarSign, ord: ShoppingBag, sold: DoorOpen, low: AlertTriangle }
export const units = (o) => (o.order_items || []).reduce((s, i) => s + i.qty, 0)
export const fmt = (d, o) => new Date(d).toLocaleDateString('en-US', o)

export function Spark({ data }) {
  const w = 110, h = 44, max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / (max - min || 1)) * (h - 10)])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`}><path d={`${line} L${w} ${h} L0 ${h} Z`} fill="var(--red)" opacity=".1" /><path d={line} fill="none" stroke="var(--red)" strokeWidth="1.8" /></svg>
}

function useWidth() {
  const ref = useRef(null), [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function SalesChart({ days }) {
  const [ref, W] = useWidth()
  const H = 200, L = 50, B = 26
  const top = Math.ceil(Math.max(...days.map((d) => d.rev), 1) / 1000) * 1000
  const x = (i) => L + (i / (days.length - 1)) * (W - L - 20)
  const y = (v) => H - B - (v / top) * (H - B - 10)
  const line = days.map((s, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(s.rev)).join(' ')
  return (
    <div ref={ref}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="chart" role="img" aria-label="Sales chart">
      {[0, .25, .5, .75, 1].map((f) => <g key={f}><line x1={L} x2={W - 20} y1={y(top * f)} y2={y(top * f)} stroke="#ececf0" /><text x={L - 8} y={y(top * f) + 4} textAnchor="end" className="tick">{Math.round(top * f).toLocaleString()}</text></g>)}
      <path d={`${line} L${x(days.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="var(--red)" opacity=".08" />
      <path d={line} fill="none" stroke="var(--red)" strokeWidth="2" />
      {days.map((s, i) => <g key={s.label + i}>{days.length <= 14 && <circle cx={x(i)} cy={y(s.rev)} r="3.5" fill="var(--red)" />}{i % Math.ceil(days.length / (W < 480 ? 4 : 7)) === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="tick">{s.label}</text>}</g>)}
    </svg></div>
  )
}

export function Donut({ cats, total }) {
  const r = 40, c = 2 * Math.PI * r
  let off = 0
  return (
    <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Best selling categories">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#ececf0" strokeWidth="18" />
      {cats.map((k, i) => { const len = (k.units / total) * c; const el = <circle key={k.name} cx="60" cy="60" r={r} fill="none" stroke={COLORS[i]} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />; off += len; return el })}
      <text x="60" y="58" textAnchor="middle" className="donut-n">{total}</text><text x="60" y="73" textAnchor="middle" className="donut-l">Doors Sold</text>
    </svg>
  )
}

export default function Dashboard({ go }) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const from = new Date(start - 13 * DAY)
      const [o, p] = await Promise.all([
        supabase.from('orders').select('id,customer_name,total,payment_type,status,created_at,order_items(qty,unit_price,products(name,images,categories(name,group_name)))').gte('created_at', from.toISOString()).order('created_at', { ascending: false }),
        supabase.from('products').select('stock,low_stock_threshold'),
      ])
      if (o.error || p.error) return setState({ error: (o.error || p.error).message })
      const cutoff = start - 6 * DAY
      const cur = o.data.filter((x) => new Date(x.created_at) >= cutoff), prev = o.data.filter((x) => new Date(x.created_at) < cutoff)
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(+start - (6 - i) * DAY), os = cur.filter((x) => new Date(x.created_at).toDateString() === d.toDateString())
        return { label: fmt(d, { month: 'short', day: 'numeric' }), rev: os.reduce((s, x) => s + +x.total, 0), ord: os.length, sold: os.reduce((s, x) => s + units(x), 0) }
      })
      const sum = (a, f) => a.reduce((s, x) => s + f(x), 0)
      const pct = (c, q) => (q ? Math.round(((c - q) / q) * 100) : null)
      const items = cur.flatMap((x) => x.order_items || [])
      const byCat = {}, byProd = {}
      items.forEach((i) => {
        const cat = i.products?.categories?.group_name || i.products?.categories?.name || 'Other', nm = i.products?.name || 'Removed product'
        byCat[cat] = (byCat[cat] || 0) + i.qty
        byProd[nm] = byProd[nm] || { name: nm, cat, units: 0, revenue: 0 }
        byProd[nm].units += i.qty; byProd[nm].revenue += i.qty * i.unit_price
      })
      const sorted = Object.entries(byCat).map(([name, u]) => ({ name, units: u })).sort((a, b) => b.units - a.units)
      const cats = sorted.slice(0, 3); const rest = sorted.slice(3).reduce((s, x) => s + x.units, 0)
      if (rest) cats.push({ name: 'Other', units: rest })
      const soldNow = sum(cur, units)
      setState({
        days, cats, soldNow, recent: o.data.slice(0, 5), top: Object.values(byProd).sort((a, b) => b.units - a.units).slice(0, 3),
        range: `${fmt(start - 6 * DAY, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmt(start, { month: 'short', day: 'numeric', year: 'numeric' })}`,
        kpis: [
          { key: 'rev', label: 'Total Revenue', value: money(sum(cur, (x) => +x.total)), d: pct(sum(cur, (x) => +x.total), sum(prev, (x) => +x.total)), spark: days.map((d) => d.rev) },
          { key: 'ord', label: 'Total Orders', value: cur.length, d: pct(cur.length, prev.length), spark: days.map((d) => d.ord) },
          { key: 'sold', label: 'Doors Sold', value: soldNow, d: pct(soldNow, sum(prev, units)), spark: days.map((d) => d.sold) },
          { key: 'low', label: 'Low Stock Products', value: p.data.filter((x) => x.stock <= x.low_stock_threshold).length, note: 'At or below their alert level', spark: null },
        ],
      })
    })()
  }, [])

  if (state.loading) return <section className="page"><p>Loading...</p></section>
  if (state.error) return <section className="page"><p className="err">Could not load data: {state.error}</p></section>
  const { kpis, days, cats, soldNow, recent, top, range } = state
  return (
    <section className="page">
      <div className="head"><div><h1>Dashboard</h1><p>Your store over the last 7 days.</p></div><span className="range">{range}</span></div>
      <div className="kpis">{kpis.map((k) => { const Icon = icons[k.key]; return (
        <div className="card kpi" key={k.key}>
          <div className="kt"><span className="ic"><Icon size={20} /></span>{k.label}</div>
          <div className="kv">{k.value}</div>
          <div className="kd">{k.d != null ? <><ArrowUp size={13} style={k.d < 0 ? { transform: 'rotate(180deg)' } : {}} /> {Math.abs(k.d)}% <small>vs. previous 7 days</small></> : <small>{k.note || 'No earlier data to compare'}</small>}</div>
          {k.spark && <Spark data={k.spark} />}
        </div>) })}</div>
      <div className="grid">
        <div className="card span2"><div className="ch"><h2><BarChart3 size={18} /> Sales Overview</h2></div><SalesChart days={days} /></div>
        <div className="card"><div className="ch"><h2>Best Selling Categories</h2></div>
          {soldNow ? <div className="cats"><Donut cats={cats} total={soldNow} /><ul>{cats.map((k, i) => <li key={k.name}><i style={{ background: COLORS[i] }} />{k.name}<b>{Math.round((k.units / soldNow) * 100)}%</b></li>)}</ul></div> : <p className="empty">No doors sold in this period yet.</p>}
        </div>
        <div className="card span2"><div className="ch"><h2>Recent Orders</h2><a href="#" className="lnk" onClick={(e) => { e.preventDefault(); go('Orders') }}>View all orders</a></div>
          {recent.length ? <table><thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>{recent.map((o) => <tr key={o.id}><td className="oid">{o.order_items?.[0]?.products?.images?.[0] ? <img className="thumb" src={o.order_items[0].products.images[0]} alt="" /> : <div className="thumb" />}<b>#{o.id}</b></td><td>{o.customer_name}</td><td>{units(o)} item{units(o) !== 1 && 's'}</td><td>{money(o.total)}</td><td><span className="pill">{o.payment_type}</span></td><td><span className={'st ' + (o.status || '').toLowerCase()}>{o.status}</span></td><td>{fmt(o.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}<small>{new Date(o.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></td></tr>)}</tbody></table>
            : <p className="empty">Orders from the storefront will appear here.</p>}
        </div>
        <div className="stack"><div className="card"><div className="ch"><h2>Quick Actions</h2></div><div className="qa">
          <button onClick={() => go('Products', '', true)}><Plus size={18} /><span>Add Product<small>Create a new door listing</small></span></button>
          <button onClick={() => go('Orders')}><ShoppingCart size={18} /><span>Manage Orders<small>View and update orders</small></span></button>
          <button onClick={() => go('Reports')}><FileText size={18} /><span>View Reports<small>Download sales reports</small></span></button>
          <button onClick={() => go('Reports')}><Download size={18} /><span>Export Data<small>CSV / Excel export</small></span></button></div></div>
        <div className="card"><div className="ch"><h2>Top Products</h2><a href="#" className="lnk" onClick={(e) => { e.preventDefault(); go('Products') }}>View all products</a></div>
          {top.length ? <ol className="top">{top.map((p) => <li key={p.name}><span>{p.name}<small>{p.cat}</small></span><em>{p.units} units</em><b>{money(p.revenue)}</b></li>)}</ol> : <p className="empty">Your best sellers will show here once orders come in.</p>}
        </div></div>
      </div>
    </section>
  )
}
