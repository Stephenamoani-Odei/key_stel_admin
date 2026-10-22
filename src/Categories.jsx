import { useEffect, useState } from 'react'
import { Pencil, Trash2, Check } from 'lucide-react'
import { supabase } from './supabase.js'

const groups = ['Security & Entrance Doors', 'Specialty & Architectural', 'Interior & Utility Doors']

export default function Categories() {
  const [rows, setRows] = useState([]), [name, setName] = useState(''), [group, setGroup] = useState('')
  const [edit, setEdit] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(true)
  async function load() {
    const { data, error } = await supabase.from('categories').select('*, products(count)').order('name')
    if (error) setErr(error.message); setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  async function add(e) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('categories').insert({ name: name.trim(), group_name: group.trim() || null })
    if (error) return setErr(error.message)
    setName(''); setGroup(''); load()
  }
  async function saveEdit() {
    const { error } = await supabase.from('categories').update({ name: edit.name.trim(), group_name: edit.group_name?.trim() || null }).eq('id', edit.id)
    if (error) return setErr(error.message)
    setEdit(null); load()
  }
  async function remove(c) {
    if (!confirm(`Delete ${c.name}? Its products will become uncategorised.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) setErr(error.message); else load()
  }
  return (
    <section className="page">
      <div className="head"><div><h1>Categories</h1><p>Group your doors so customers can filter the shop. The group decides how sales are rolled up on the dashboard.</p></div></div>
      <form className="card tools" onSubmit={add}>
        <input required placeholder="Category name, e.g. Heavy Duty Steel" value={name} onChange={(e) => setName(e.target.value)} />
        <input list="groups" placeholder="Group, e.g. Security & Entrance Doors" value={group} onChange={(e) => setGroup(e.target.value)} />
        <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        <button className="btn">Add category</button>
      </form>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {loading ? <p>Loading...</p> : rows.length === 0 ? <p className="empty">No categories yet. Add your first one above.</p> :
          <table><thead><tr><th>Category</th><th>Group</th><th>Products</th><th></th></tr></thead><tbody>{rows.map((c) => (
            <tr key={c.id}>
              {edit?.id === c.id ? <>
                <td><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></td>
                <td><input list="groups" value={edit.group_name || ''} onChange={(e) => setEdit({ ...edit, group_name: e.target.value })} /></td>
                <td>{c.products?.[0]?.count || 0}</td>
                <td className="act"><button onClick={saveEdit} aria-label="Save"><Check size={16} /></button></td>
              </> : <>
                <td><b>{c.name}</b></td><td>{c.group_name || 'None'}</td><td>{c.products?.[0]?.count || 0}</td>
                <td className="act"><button onClick={() => setEdit(c)} aria-label="Edit"><Pencil size={16} /></button><button onClick={() => remove(c)} aria-label="Delete"><Trash2 size={16} /></button></td>
              </>}
            </tr>))}</tbody></table>}
      </div>
    </section>
  )
}
