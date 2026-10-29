import { useEffect, useState } from 'react'
import { DollarSign, ShoppingBag, DoorOpen, BarChart3 } from 'lucide-react'
import { supabase } from './supabase.js'
import { money } from './lib.js'
import { SalesChart, Donut, COLORS, units, fmt } from './Dashboard.jsx'

const DAY = 864e5
export default function Analytics() {
  const [n, setN] = useState(30), [d, setD] = useState(null), [err, setErr] = useState('')
  useEffect(() => {
    setD(null);
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { data, error } = await supabase.from('orders').select('total,payment_type,created_at,order_items(qty,unit_price,products(name,categories(name,group_name)))').neq('status', 'Cancelled').gte('created_at', new Date(+start - (n - 1) * DAY).toISOString())
      if (error) return setErr(error.message)
      const days = Array.from({ length: n }, (_, i) => { const day = new Date(+start - (n - 1 - i) * DAY); return { key: day.toDateString(), label: fmt(day, { month: 'short', day: 'numeric' }), rev: 0 } })
      const idx = Object.fromEntries(days.map((x, i) => [x.key, i]))
      const pay = {}, cat = {}, prod = {}
      data.forEach((o) => {
        days[idx[new Date(o.created_at).toDateString()]].rev += +o.total
        pay[o.payment_type] = pay[o.payment_type] || { count: 0, total: 0 }; pay[o.payment_type].count++; pay[o.payment_type].total += +o.total
        o.order_items.forEach((i) => {
          const c = i.products?.categories?.group_name || i.products?.categories?.name || 'Other', nm = i.products?.name || 'Removed product'
          cat[c] = (cat[c] || 0) + i.qty
          prod[nm] = prod[nm] || { name: nm, units: 0, revenue: 0 }; prod[nm].units += i.qty; prod[nm].revenue += i.qty * i.unit_price
        })
      })
      const sorted = Object.entries(cat).map(([name, u]) => ({ name, units: u })).sort((a, b) => b.units - a.units)
      const cats = sorted.slice(0, 3), rest = sorted.slice(3).reduce((s, x) => s + x.units, 0)
      if (rest) cats.push({ name: 'Other', units: rest })
      const rev = data.reduce((s, o) => s + +o.total, 0)
      setD({ days, pay, cats, rev, orders: data.length, sold: data.reduce((s, o) => s + units(o), 0), top: Object.values(prod).sort((a, b) => b.revenue - a.revenue).slice(0, 10) })
    })()
  }, [n])
  return (
    <section className="page">
      <div className="head"><div><h1>Sales &amp; Analytics</h1><p>See what is selling and how customers pay.</p></div>
        <div className="tabs" style={{ margin: 0 }}>{[7, 30, 90].map((k) => <button key={k} className={n === k ? 'on' : ''} onClick={() => setN(k)}>Last {k} days</button>)}</div></div>
      {err && <p className="err">{err}</p>}
      {!d ? <p>Loading...</p> : <>
        <div className="chips">
          {[[DollarSign, 'Revenue', money(d.rev)], [ShoppingBag, 'Orders', d.orders], [DoorOpen, 'Doors sold', d.sold], [BarChart3, 'Average order', money(d.orders ? d.rev / d.orders : 0)]].map(([Icon, l, v]) => (
            <div className="card kpi" key={l}><div className="kt"><span className="ic"><Icon size={20} /></span>{l}</div><div className="kv">{v}</div></div>))}
        </div>
        <div className="grid">
          <div className="card span2"><div className="ch"><h2><BarChart3 size={18} /> Revenue by day</h2></div><SalesChart days={d.days} /></div>
          <div className="card"><div className="ch"><h2>Best Selling Categories</h2></div>
            {d.sold ? <div className="cats"><Donut cats={d.cats} total={d.sold} /><ul>{d.cats.map((k, i) => <li key={k.name}><i style={{ background: COLORS[i] }} />{k.name}<b>{Math.round((k.units / d.sold) * 100)}%</b></li>)}</ul></div> : <p className="empty">No sales in this period.</p>}</div>
          <div className="card span2"><div className="ch"><h2>Top products by revenue</h2></div>
            {d.top.length ? <table><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{d.top.map((p) => <tr key={p.name}><td><b>{p.name}</b></td><td>{p.units}</td><td>{money(p.revenue)}</td></tr>)}</tbody></table> : <p className="empty">No sales in this period.</p>}</div>
          <div className="card"><div className="ch"><h2>Payment methods</h2></div>
            {Object.keys(d.pay).length ? Object.entries(d.pay).map(([k, v]) => <div key={k} style={{ marginBottom: 14 }}><div className="ch" style={{ margin: '0 0 6px' }}><span>{k}</span><b>{money(v.total)}</b></div><div className="pbar"><i style={{ width: (v.total / d.rev) * 100 + '%' }} /></div><small>{v.count} order{v.count > 1 && 's'}</small></div>) : <p className="empty">No payments in this period.</p>}</div>
        </div>
      </>}
    </section>
  )
}
