import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { supabase } from './supabase.js'
import { money } from './lib.js'

export default function Inventory({ q: q0 = '' }) {
  const [rows, setRows] = useState([]), [tab, setTab] = useState('All'), [q, setQ] = useState(q0), [err, setErr] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('products').select('*, categories(name)').order('name').then(({ data, error }) => { if (error) setErr(error.message); setRows(data || []); setLoading(false) })
  }, [])
  async function patch(p, change) {
    const { error } = await supabase.from('products').update(change).eq('id', p.id)
    if (error) return setErr(error.message)
    setRows(rows.map((r) => (r.id === p.id ? { ...r, ...change } : r)))
  }
  const setStock = (p, v) => patch(p, { stock: Math.max(0, parseInt(v) || 0) })
  const low = (p) => p.stock > 0 && p.stock <= p.low_stock_threshold
  const tabs = { All: rows, 'Low stock': rows.filter(low), 'Out of stock': rows.filter((p) => p.stock === 0) }
  const shown = tabs[tab].filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  const units = rows.reduce((s, p) => s + p.stock, 0), value = rows.reduce((s, p) => s + p.stock * p.price, 0)
  return (
    <section className="page">
      <div className="head"><div><h1>Inventory</h1><p>Adjust stock counts as doors come in and go out.</p></div></div>
      <div className="chips">
        <div className="card"><small>Products</small><div className="kv">{rows.length}</div></div>
        <div className="card"><small>Doors in stock</small><div className="kv">{units}</div></div>
        <div className="card"><small>Stock value at selling price</small><div className="kv">{money(value)}</div></div>
        <div className="card"><small>Needs attention</small><div className="kv">{tabs['Low stock'].length + tabs['Out of stock'].length}</div></div>
      </div>
      <div className="tools"><div className="tabs" style={{ margin: 0 }}>{Object.keys(tabs).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t} ({tabs[t].length})</button>)}</div>
        <input placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {loading ? <p>Loading...</p> : shown.length === 0 ? <p className="empty">{rows.length ? 'Nothing matches this filter.' : 'Add products first, then manage their stock here.'}</p> :
          <table><thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Alert at</th><th>Availability</th></tr></thead><tbody>{shown.map((p) => (
            <tr key={p.id}>
              <td>{p.images?.[0] ? <img className="thumb" src={p.images[0]} alt="" /> : <div className="thumb" />}</td>
              <td><b>{p.name}</b></td><td>{p.categories?.name || 'Uncategorised'}</td><td>{money(p.price)}</td>
              <td><div className="stepper">
                <button onClick={() => setStock(p, p.stock - 1)} aria-label="Remove one"><Minus size={14} /></button>
                <input key={p.stock} type="number" min="0" defaultValue={p.stock} onBlur={(e) => +e.target.value !== p.stock && setStock(p, e.target.value)} />
                <button onClick={() => setStock(p, p.stock + 1)} aria-label="Add one"><Plus size={14} /></button></div>
                {low(p) && <small className="low">Low stock</small>}{p.stock === 0 && <small className="low">Out of stock</small>}</td>
              <td>{p.low_stock_threshold}</td>
              <td><button className={'st ' + (p.available ? 'delivered' : 'pending')} onClick={() => patch(p, { available: !p.available })}>{p.available ? 'Shown' : 'Hidden'}</button></td>
            </tr>))}</tbody></table>}
      </div>
    </section>
  )
}
