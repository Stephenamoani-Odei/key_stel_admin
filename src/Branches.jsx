import { useEffect, useState } from 'react'
import { Store, Plus, Pencil, Check, X, LogIn } from 'lucide-react'
import { supabase } from './supabase.js'
import { useDialog } from './Dialog.jsx'

const NOT_SETUP = 'Branches are not set up in the database yet. Run 015_branches.sql in the Supabase SQL editor.'

export default function Branches({ onOpen }) {
  const { confirm } = useDialog()
  const [rows, setRows] = useState([]), [name, setName] = useState(''), [edit, setEdit] = useState(null), [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(''), [loading, setLoading] = useState(true)

  async function load() {
    const { data, error } = await supabase.rpc('list_branches')
    if (error) setErr(error.message.includes('list_branches') ? NOT_SETUP : error.message)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy('add')
    const { error } = await supabase.rpc('add_branch', { p_name: name })
    setBusy('')
    if (error) return setErr(error.message)
    setOk(`${name.trim()} was added. Press "Open this branch" to start managing it.`); setName(''); load()
  }
  async function rename() {
    setErr(''); setOk('')
    const { error } = await supabase.rpc('rename_branch', { p_id: edit.id, p_name: edit.name })
    if (error) return setErr(error.message)
    setEdit(null); load(); onOpen?.(null)   // refreshes the branch name shown at the top
  }
  async function toggle(b) {
    setErr(''); setOk('')
    if (b.active && !(await confirm({ title: `Switch off ${b.name}?`, message: 'Nobody will be able to work in this branch until you switch it back on. Its data is kept.', yes: 'Switch off', danger: true }))) return
    const { error } = await supabase.rpc('set_branch_active', { p_id: b.id, p_active: !b.active })
    if (error) return setErr(error.message)
    load(); onOpen?.(null)
  }
  async function open(b) { setBusy('open' + b.id); setErr(''); const msg = await onOpen?.(b.id); if (msg) { setErr(msg); setBusy('') } }

  return (
    <section className="page">
      <div className="head"><div><h1>Branches</h1><p>Each branch has its own products, stock, orders, customers and audit log. Open a branch to manage it, then come back here to switch.</p></div></div>
      <form className="card tools" onSubmit={add}>
        <input required maxLength="60" placeholder="New branch name, e.g. Kasoa" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={busy === 'add'}><Plus size={16} /> {busy === 'add' ? 'Adding...' : 'Add a branch'}</button>
      </form>
      {err && <p className="err">{err}</p>}{ok && <p className="okmsg">{ok}</p>}
      <div className="card">{loading ? <p>Loading...</p> : rows.length === 0 ? <p className="empty">No branches yet.</p> :
        <table><thead><tr><th>Branch</th><th>Status</th><th>Staff</th><th>Products</th><th>Orders</th><th></th></tr></thead><tbody>{rows.map((b) => (
          <tr key={b.id}>
            <td>{edit?.id === b.id
              ? <input autoFocus maxLength="60" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEdit(null) }} />
              : <><b><Store size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />{b.name}</b>{b.is_main && <small> Main branch (shown on the website)</small>}{b.is_open && <span className="tag" style={{ marginLeft: 8 }}>Open now</span>}</>}</td>
            <td>{b.active ? 'Active' : 'Switched off'}</td>
            <td>{b.staff_count}</td><td>{b.product_count}</td><td>{b.order_count}</td>
            <td className="act">
              {edit?.id === b.id
                ? <><button onClick={rename} aria-label="Save" title="Save"><Check size={16} /></button><button onClick={() => setEdit(null)} aria-label="Cancel" title="Cancel"><X size={16} /></button></>
                : <>{b.active && !b.is_open && <button className="btn" disabled={!!busy} onClick={() => open(b)}><LogIn size={15} /> {busy === 'open' + b.id ? 'Opening...' : 'Open this branch'}</button>}
                    <button onClick={() => setEdit({ id: b.id, name: b.name })} aria-label="Rename" title="Rename"><Pencil size={16} /></button>
                    {!b.is_main && <button className="linkbtn" style={{ marginLeft: 6 }} onClick={() => toggle(b)}>{b.active ? 'Switch off' : 'Switch on'}</button>}</>}
            </td></tr>))}</tbody></table>}</div>
    </section>
  )
}
