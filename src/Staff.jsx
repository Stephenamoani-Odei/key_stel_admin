import { useEffect, useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'

const label = { superadmin: 'Super Admin', admin: 'Admin', staff: 'Staff' }
export default function Staff({ me, myRole }) {
  const [rows, setRows] = useState([]), [email, setEmail] = useState(''), [role, setRole] = useState('staff'), [err, setErr] = useState(''), [ok, setOk] = useState(''), [loading, setLoading] = useState(true)
  const sup = myRole === 'superadmin'
  const opts = sup ? ['staff', 'admin'] : ['staff']
  const locked = (r) => r.user_id === me || r.role === 'superadmin' || (!sup && r.role !== 'staff')
  async function load() { const { data, error } = await supabase.rpc('list_staff'); if (error) setErr(error.message); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  async function save(em, ro) {
    setErr(''); setOk(''); const { error } = await supabase.rpc('add_staff', { p_email: em, p_role: ro })
    if (error) return setErr(error.message)
    setEmail(''); load()
  }
  async function remove(r) {
    if (!confirm(`Remove access for ${r.display_name || r.email}?`)) return
    setErr(''); setOk('')
    const { error } = await supabase.rpc('remove_staff', { p_user_id: r.user_id })
    if (error) setErr(error.message); else load()
  }
  async function reset(r) {
    if (!confirm(`Reset the password for ${r.display_name || r.email}?\n\nIt becomes keyStel1234, they are signed out, and they must choose their own password at their next sign in.`)) return
    setErr(''); setOk('')
    const { error } = await supabase.rpc('reset_staff_password', { p_user_id: r.user_id })
    if (error) setErr(error.message); else { setOk(`Password for ${r.display_name || r.email} is now keyStel1234. Tell them to sign in and choose a new one.`); load() }
  }
  return (
    <section className="page">
      <div className="head"><div><h1>Staff &amp; Access Control</h1><p>{sup ? 'You are the super admin. You can add admins and staff, and reset any password.' : 'You can add staff and reset their passwords. Only the super admin can manage admins.'} Create the person's login under Authentication in Supabase first, then add their email here. Each person then picks their own sign-in name in Settings.</p></div></div>
      <form className="card tools" onSubmit={(e) => { e.preventDefault(); save(email, role) }}>
        <input required type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 140 }}>{opts.map((o) => <option key={o} value={o}>{label[o]}</option>)}</select>
        <button className="btn">Give access</button>
      </form>
      {err && <p className="err">{err}</p>}{ok && <p><b>{ok}</b></p>}
      <div className="card">{loading ? <p>Loading...</p> :
        <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>{rows.map((r) => (
          <tr key={r.user_id}>
            <td><b>{r.display_name || 'No name yet'}</b>{r.user_id === me && <small>This is you</small>}</td>
            <td>{r.email}</td>
            <td>{locked(r) ? <span className="pill">{label[r.role]}</span> : <select value={r.role} onChange={(e) => save(r.email, e.target.value)} style={{ maxWidth: 140 }}>{opts.map((o) => <option key={o} value={o}>{label[o]}</option>)}</select>}</td>
            <td className="act">{!locked(r) && <><button onClick={() => reset(r)} aria-label="Reset password" title="Reset password"><KeyRound size={16} /></button><button onClick={() => remove(r)} aria-label="Remove" title="Remove access"><Trash2 size={16} /></button></>}</td></tr>))}</tbody></table>}</div>
    </section>
  )
}
