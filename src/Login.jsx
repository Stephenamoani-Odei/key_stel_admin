import { useState } from 'react'
import { supabase } from './supabase.js'
import PasswordInput from './PasswordInput.jsx'
export default function Login() {
  const [who, setWho] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('')
    let email = who.trim()
    if (!email.includes('@')) {
      const { data } = await supabase.rpc('login_email', { p_name: email })
      email = data || ''
    }
    const { error } = email ? await supabase.auth.signInWithPassword({ email, password }) : { error: { message: 'Invalid login credentials' } }
    if (error) setErr(error.message)
    setBusy(false)
  }
  return (
    <div className="login"><form className="card" onSubmit={submit}>
      <span className="logo">KEY-STEL</span><small>Staff sign in</small>
      <input placeholder="Your name or email" value={who} onChange={(e) => setWho(e.target.value)} required autoComplete="username" autoCapitalize="off" />
      <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <small>Forgot your password? Ask your admin to reset it.</small>
    </form></div>
  )
}
