import { useState } from 'react'
import { supabase } from './supabase.js'
import PasswordInput from './PasswordInput.jsx'
export default function ResetPassword({ onDone, title = 'Choose a new password', forbid }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setErr('')
    if (pw !== pw2) return setErr('The two passwords do not match.')
    if (forbid && pw === forbid) return setErr('Choose a different password from the temporary one.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { setBusy(false); return setErr(error.message) }
    await onDone(); setBusy(false)
  }
  return (
    <div className="login"><form className="card" onSubmit={submit}>
      <span className="logo">KEY-STEL</span><small>{title}</small>
      <p style={{ margin: 0 }}>Your password was reset by an admin. Pick a new one that only you know.</p>
      <PasswordInput placeholder="New password (8+ characters)" minLength="8" required value={pw} onChange={(e) => setPw(e.target.value)} />
      <PasswordInput placeholder="Repeat new password" minLength="8" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save password'}</button>
      <button type="button" className="linkbtn" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </form></div>
  )
}
