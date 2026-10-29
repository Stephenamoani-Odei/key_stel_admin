import { useEffect, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { dateTime, downloadCSV } from './lib.js'
import { useDialog } from './Dialog.jsx'

const PAGE = 100
const TABS = {
  All: null,
  'Orders & sales': 'action.like.order.*,action.like.sale.*',
  Products: 'action.like.product.*,action.like.category.*',
  Staff: 'action.like.staff.*',
  Settings: 'action.like.settings.*',
  Broadcasts: 'action.like.broadcast.*,action.like.sms.*',
}
const LABEL = {
  'sale.walkin': 'Shop sale', 'order.placed': 'Online order', 'order.status': 'Order status', 'order.payment': 'Payment', 'order.cancelled': 'Cancelled order',
  'product.created': 'Product added', 'product.deleted': 'Product deleted', 'product.price': 'Price change', 'product.stock': 'Stock change', 'product.visibility': 'Visibility', 'product.renamed': 'Renamed', 'product.photos': 'Photos changed',
  'category.created': 'Category added', 'category.updated': 'Category changed', 'category.deleted': 'Category deleted',
  'staff.added': 'Staff added', 'staff.removed': 'Staff removed', 'staff.role': 'Role change', 'staff.name': 'Name set', 'staff.password_reset': 'Password reset', 'settings.updated': 'Settings changed', 'broadcast.started': 'Broadcast started', 'broadcast.sent': 'Broadcast sent', 'sms.optout': 'Message opt-out', 'audit.deleted': 'Log entries deleted',
}
const RISKY = new Set(['order.cancelled', 'product.deleted', 'product.price', 'staff.removed', 'staff.role', 'staff.password_reset', 'category.deleted'])

export default function Audit({ myRole }) {
  const { confirm, notify } = useDialog()
  const sup = myRole === 'superadmin'
  const [sel, setSel] = useState(new Set()), [deleting, setDeleting] = useState(false)
  const [rows, setRows] = useState([]), [tab, setTab] = useState('All'), [q, setQ] = useState(''), [more, setMore] = useState(false), [err, setErr] = useState(''), [loading, setLoading] = useState(true)

  async function load(reset) {
    setLoading(true); setErr('')
    const from = reset ? 0 : rows.length
    let query = supabase.from('audit_log').select('*').order('id', { ascending: false }).range(from, from + PAGE - 1)
    if (TABS[tab]) query = query.or(TABS[tab])
    const term = q.trim().replace(/[%,()*]/g, '')
    if (term) query = query.ilike('summary', `%${term}%`)
    const { data, error } = await query
    if (error) setErr(error.message.includes('audit_log') ? 'The audit log is not set up yet. Run 009_cancel_and_audit.sql in the Supabase SQL editor.' : error.message)
    setRows(reset ? data || [] : [...rows, ...(data || [])]); setMore((data || []).length === PAGE); setLoading(false)
  }
  async function removeSelected() {
    const ids = [...sel]
    if (!ids.length) return
    const ok = await confirm({ title: `Delete ${ids.length} audit log ${ids.length === 1 ? 'entry' : 'entries'}?`, message: 'They will be removed for good and cannot be brought back. A note saying how many were deleted, and by whom, is added to the log.', yes: 'Delete', danger: true })
    if (!ok) return
    setDeleting(true)
    const { error } = await supabase.rpc('delete_audit_entries', { p_ids: ids })
    setDeleting(false)
    if (error) {
      const missing = error.message.includes('delete_audit_entries') && (error.code === 'PGRST202' || error.message.includes('Could not find'))
      return notify({ title: 'Could not delete', message: missing ? 'Deleting is not switched on in the database yet. Run delete_audit_entries.sql in the Supabase SQL editor, then try again.' : error.message })
    }
    setSel(new Set()); load(true)
  }
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id))
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))
  useEffect(() => { setSel(new Set()) }, [tab, q])
  useEffect(() => { const t = setTimeout(() => load(true), q ? 300 : 0); return () => clearTimeout(t) }, [tab, q])

  return (
    <section className="page">
      <div className="head"><div><h1>Audit Log</h1><p>Who did what, and when. Entries are written by the database itself and cannot be edited. {sup ? 'Only you, as super admin, can delete entries.' : ''}</p></div>
        <div className="tools" style={{ margin: 0 }}>
        {sup && <button className="btn ghost danger" disabled={!sel.size || deleting} onClick={removeSelected}><Trash2 size={16} /> {deleting ? 'Deleting...' : `Delete selected${sel.size ? ` (${sel.size})` : ''}`}</button>}
        <button className="btn ghost" disabled={!rows.length} onClick={() => downloadCSV('keystel-audit-log.csv', [['When', 'Who', 'Action', 'Details'], ...rows.map((r) => [dateTime(r.at), r.actor_name, LABEL[r.action] || r.action, r.summary])])}><Download size={16} /> Download CSV</button></div></div>
      <div className="tools"><div className="tabs" style={{ margin: 0 }}>{Object.keys(TABS).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
        <input placeholder="Search the details, e.g. an order number or door name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {loading && !rows.length ? <p>Loading...</p> : rows.length === 0 ? <p className="empty">Nothing recorded yet.</p> :
          <table><thead><tr>{sup && <th className="chkcol"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all entries shown" /></th>}<th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>{rows.map((r) => (
            <tr key={r.id}>{sup && <td className="chkcol"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select entry" /></td>}<td>{dateTime(r.at)}</td><td><b>{r.actor_name}</b></td>
              <td><span className={'tag' + (RISKY.has(r.action) ? ' risk' : '')} style={{ marginLeft: 0 }}>{LABEL[r.action] || r.action}</span></td>
              <td className="wrap">{r.summary}</td></tr>))}</tbody></table>}
        {more && <div className="tools" style={{ justifyContent: 'center', marginTop: 12 }}><button className="btn ghost" disabled={loading} onClick={() => load(false)}>{loading ? 'Loading...' : 'Load older entries'}</button></div>}
      </div>
    </section>
  )
}
