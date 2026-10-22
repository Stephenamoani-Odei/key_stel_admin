import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from './supabase.js'
import { money, resizeImage } from './lib.js'

const blank = { name: '', category_id: '', newCat: '', description: '', price: '', sizes: '', stock: 0, low_stock_threshold: 5, images: [], available: true }

export default function Products({ q: q0 = '', startNew }) {
  const [q, setQ] = useState(q0)
  const [rows, setRows] = useState([]), [cats, setCats] = useState([]), [form, setForm] = useState(null)
  const [file, setFile] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])
    if (p.error) setErr(p.error.message)
    setRows(p.data || []); setCats(c.data || []); setLoading(false)
  }
  useEffect(() => { load(); if (startNew) open() }, [])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr('')
    let image = form.images?.[0]
    if (file) {
      const f = await resizeImage(file)
      const path = `${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, '_')}`
      const up = await supabase.storage.from('product-images').upload(path, f, { contentType: f.type })
      if (up.error) { setErr(up.error.message); return setBusy(false) }
      image = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
    }
    let category_id = form.category_id || null
    if (form.newCat.trim()) {
      const c = await supabase.from('categories').insert({ name: form.newCat.trim() }).select().single()
      if (c.error) { setErr(c.error.message); return setBusy(false) }
      category_id = c.data.id
    }
    const payload = {
      category_id, name: form.name, description: form.description, price: +form.price,
      sizes: form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
      stock: +form.stock, low_stock_threshold: +form.low_stock_threshold, available: form.available, images: image ? [image] : [],
    }
    const { error } = form.id ? await supabase.from('products').update(payload).eq('id', form.id) : await supabase.from('products').insert(payload)
    if (error) setErr(error.message)
    else { setForm(null); setFile(null); await load() }
    setBusy(false)
  }
  async function remove(p) {
    if (!confirm(`Delete ${p.name}?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) setErr(error.message.includes('foreign key') ? `${p.name} has orders, so it can't be deleted. Mark it unavailable instead.` : error.message)
    else load()
  }
  async function toggle(p) { await supabase.from('products').update({ available: !p.available }).eq('id', p.id); load() }
  const open = (p) => { setErr(''); setFile(null); setForm(p ? { ...blank, ...p, newCat: '', sizes: (p.sizes || []).join(', '), description: p.description || '', category_id: p.category_id || '' } : { ...blank }) }

  const shown = rows.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="page">
      <div className="head"><div><h1>Products</h1><p>Every door, price and stock level on the storefront comes from here.</p></div><button className="btn" onClick={() => open()}><Plus size={16} /> Add product</button></div>
      <div className="tools"><input placeholder="Filter products by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && !form && <p className="err">{err}</p>}
      <div className="card">
        {loading ? <p>Loading...</p> : rows.length === 0 ? <p className="empty">No products yet. Add your first door to get started.</p> :
          <table><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Availability</th><th></th></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id}>
                <td>{p.images?.[0] ? <img className="thumb" src={p.images[0]} alt="" /> : <div className="thumb" />}</td>
                <td><b>{p.name}</b></td><td>{p.categories?.name || 'Uncategorised'}</td><td>{money(p.price)}</td>
                <td>{p.stock}{p.stock <= p.low_stock_threshold && <small className="low">Low stock</small>}</td>
                <td><button className={'st ' + (p.available && p.stock > 0 ? 'delivered' : 'pending')} onClick={() => toggle(p)}>{p.available && p.stock > 0 ? 'In stock' : 'Out of stock'}</button></td>
                <td className="act"><button onClick={() => open(p)} aria-label="Edit"><Pencil size={16} /></button><button onClick={() => remove(p)} aria-label="Delete"><Trash2 size={16} /></button></td>
              </tr>))}</tbody></table>}
      </div>

      {form && <div className="modal" onClick={() => setForm(null)}><form className="card sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="ch"><h2>{form.id ? 'Edit product' : 'Add product'}</h2><button type="button" className="bell" onClick={() => setForm(null)}><X size={18} /></button></div>
        <label>Name<input required value={form.name} onChange={set('name')} /></label>
        <div className="two">
          <label>Category<select value={form.category_id} onChange={set('category_id')}><option value="">Choose a category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Or create a new one<input placeholder="e.g. Heavy Duty Steel" value={form.newCat} onChange={set('newCat')} /></label>
        </div>
        <div className="two">
          <label>Price (GH₵)<input required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} /></label>
          <label>Sizes (comma separated)<input placeholder="3x7 ft, 3.5x7 ft" value={form.sizes} onChange={set('sizes')} /></label>
        </div>
        <div className="two">
          <label>Stock count<input required type="number" min="0" value={form.stock} onChange={set('stock')} /></label>
          <label>Low stock alert at<input required type="number" min="0" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} /></label>
        </div>
        <label>Description and key features<textarea rows="3" value={form.description} onChange={set('description')} /></label>
        <label>Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const x = e.target.files[0]; if (x && (!/^image\/(jpeg|png|webp)$/.test(x.type) || x.size > 15 * 1024 * 1024)) { setErr("Photos must be JPG, PNG or WebP and under 15 MB."); e.target.value = ""; return } setErr(""); setFile(x) }} />{form.images?.[0] && !file && <small>Current photo kept unless you choose a new one.</small>}</label>
        <label className="chk"><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Show on storefront</label>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save product'}</button>
      </form></div>}
    </section>
  )
}
