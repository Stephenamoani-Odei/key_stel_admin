import { useEffect, useState } from 'react'
import { Copy, KeyRound, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { callFunction } from './sms.js'
import { useDialog } from './Dialog.jsx'

const label = { superadmin: 'Super Admin', admin: 'Admin', staff: 'Staff' }
export default function Staff({ me, myRole, branch }) {
  const { confirm, notify } = useDialog()
  const [rows, setRows] = useState([]), [err, setErr] = useState(''), [ok, setOk] = useState(''), [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' }), [busy, setBusy] = useState(false), [created, setCreated] = useState(null)
  const sup = myRole === 'superadmin'
  const opts = sup ? ['staff', 'admin'] : ['staff']
  const locked = (r) => r.user_id === me || r.role === 'superadmin' || (!sup && r.role !== 'staff')
  const [branches, setBranches] = useState([])
  // Shows only the people in the open branch. Falls back to the full list if branches are not set up yet.
  async function load() {
    let { data, error } = await supabase.rpc('list_staff_in_branch')
    if (error && error.message.includes('list_staff_in_branch')) ({ data, error } = await supabase.rpc('list_staff'))
    if (error) setErr(error.message)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (sup) supabase.rpc('list_branches').then(({ data }) => setBranches((data || []).filter((b) => b.active))) }, [sup])
  async function moveTo(r, branchId) {
    setErr(''); setOk('')
    const { error } = await supabase.rpc('set_staff_branch', { p_user_id: r.user_id, p_branch: Number(branchId) })
    if (error) return setErr(error.message)
    const to = branches.find((b) => b.id === Number(branchId))
    setOk(`${r.display_name || r.email} now works in ${to?.name || 'the other branch'}.`); load()
  }

  async function create(e) {
    e.preventDefault(); setErr(''); setOk(''); setCreated(null); setBusy(true)
    const r = await callFunction(supabase, 'create-staff', { email: form.email, role: form.role, name: form.name })
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    // Make sure the new person belongs to the branch that is open right now.
    if (sup && branch) {
      const { data: all } = await supabase.rpc('list_staff')
      const mine = (all || []).find((x) => x.email?.toLowerCase() === form.email.trim().toLowerCase())
      if (mine) await supabase.rpc('set_staff_branch', { p_user_id: mine.user_id, p_branch: branch.id })
    }
    setCreated({ ...r, name: form.name }); setForm({ name: '', email: '', role: 'staff' }); load()
  }
  async function changeRole(r, role) {
    setErr(''); setOk('')
    const { error } = await supabase.rpc('add_staff', { p_email: r.email, p_role: role })
    if (error) return setErr(error.message)
    load()
  }
  async function remove(r) {
    if (!(await confirm({ title: 'Remove access?', message: `${r.display_name || r.email} will no longer be able to sign in.`, yes: 'Remove', danger: true }))) return
    setErr(''); setOk('')
    const { error } = await supabase.rpc('remove_staff', { p_user_id: r.user_id })
    if (error) setErr(error.message); else load()
  }
  async function reset(r) {
    if (!(await confirm({ title: `Reset the password for ${r.display_name || r.email}?`, message: 'It becomes keyStel1234, they are signed out, and they must choose their own password at their next sign in.', yes: 'Reset password', danger: true }))) return
    setErr(''); setOk('')
    const { error } = await supabase.rpc('reset_staff_password', { p_user_id: r.user_id })
    if (error) setErr(error.message); else { load(); await notify({ title: 'Password reset', message: `The password for ${r.display_name || r.email} is now keyStel1234. Tell them to sign in and choose a new one.` }) }
  }
  const sign = created && (created.name?.trim() || created.email)
  return (
    <section className="page">
      <div className="head"><div><h1>Staff &amp; Access Control</h1><p>{sup ? 'You are the super admin. You can add admins and staff, and reset any password.' : 'You can add staff and reset their passwords. Only the super admin can manage admins.'} Fill in the form below and the account is created for you.{branch ? ` People you add here work in ${branch.name}.` : ''}</p></div></div>
      <form className="card sheet" style={{ width: 'auto', marginBottom: 16 }} onSubmit={create}>
        <h2>Add a person</h2>
        <div className="two">
          <label>Email address<input required type="email" placeholder="name@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Sign-in name (optional)<input placeholder="e.g. Kwame" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        </div>
        <div className="two">
          <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{opts.map((o) => <option key={o} value={o}>{label[o]}</option>)}</select></label>
          <div style={{ alignSelf: 'end' }}><button className="btn" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button></div>
        </div>
      </form>
      {err && <p className="err">{err}</p>}{ok && <p><b>{ok}</b></p>}
      {created && (created.existing
        ? <div className="cancelbox" style={{ background: '#f3fbf5', borderColor: '#bfe3c9' }}><b>{created.email} now has access.</b> They already had a login, so they sign in with their usual password.</div>
        : <div className="cancelbox" style={{ background: '#f3fbf5', borderColor: '#bfe3c9' }}>
            <b>Account created. Give them these details:</b>
            <span>Sign in with: <b>{sign}</b>{created.name?.trim() ? ` (or ${created.email})` : ''}</span>
            <span>Temporary password: <b>{created.tempPassword}</b></span>
            <small>They will be asked to choose their own password the first time they sign in.</small>
            <div className="tools"><button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(`Key-Stel admin\nSign in with: ${sign}\nTemporary password: ${created.tempPassword}`)}><Copy size={16} /> Copy details</button></div>
          </div>)}
      <div className="card">{loading ? <p>Loading...</p> :
        <table><thead><tr><th>Name</th><th>Email</th><th>Role</th>{sup && branches.length > 1 && <th>Branch</th>}<th></th></tr></thead><tbody>{rows.map((r) => (
          <tr key={r.user_id}>
            <td><b>{r.display_name || 'No name yet'}</b>{r.user_id === me && <small>This is you</small>}</td>
            <td>{r.email}</td>
            <td>{locked(r) ? <span className="pill">{label[r.role]}</span> : <select value={r.role} onChange={(e) => changeRole(r, e.target.value)} style={{ maxWidth: 140 }}>{opts.map((o) => <option key={o} value={o}>{label[o]}</option>)}</select>}</td>
            {sup && branches.length > 1 && <td>{locked(r) ? <span className="pill">{branch?.name}</span> : <select value={r.branch_id || branch?.id || ''} onChange={(e) => moveTo(r, e.target.value)} style={{ maxWidth: 160 }}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}</td>}
            <td className="act">{!locked(r) && <><button onClick={() => reset(r)} aria-label="Reset password" title="Reset password"><KeyRound size={16} /></button><button onClick={() => remove(r)} aria-label="Remove" title="Remove access"><Trash2 size={16} /></button></>}</td></tr>))}</tbody></table>}</div>
    </section>
  )
}
