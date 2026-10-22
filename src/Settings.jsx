import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import PasswordInput from './PasswordInput.jsx'

const fields = [['store_name', 'Store name'], ['phone', 'Call number'], ['whatsapp', 'WhatsApp number'], ['address', 'Store address'], ['map_url', 'Google Maps link'], ['delivery_note', 'Delivery note shown at checkout'], ['receipt_footer', 'Message printed at the bottom of receipts']]
export default function Settings({ email, name, onName }) {
  const [nm, setNm] = useState(name || ''), [nmsg, setNmsg] = useState('')
  const [f, setF] = useState(null), [msg, setMsg] = useState(''), [pw, setPw] = useState(''), [pmsg, setPmsg] = useState('')
  useEffect(() => { supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => { if (error) setMsg(error.message); setF(data || {}) }) }, [])
  async function save(e) {
    e.preventDefault(); setMsg('')
    const { id, updated_at, ...rest } = f
    const { error } = await supabase.from('settings').upsert({ ...rest, id: 1, updated_at: new Date().toISOString() })
    setMsg(error ? error.message : 'Saved.')
  }
  async function saveName(e) {
    e.preventDefault(); setNmsg('')
    const { error } = await supabase.rpc('set_my_name', { p_name: nm })
    if (error) return setNmsg(error.message)
    const clean = nm.trim().replace(/\s+/g, ' ')
    setNm(clean); onName(clean); setNmsg('Saved. You can now sign in with this name.')
  }
  async function changePw(e) {
    e.preventDefault(); const { error } = await supabase.auth.updateUser({ password: pw })
    setPmsg(error ? error.message : 'Password updated.'); if (!error) setPw('')
  }
  if (!f) return <section className="page"><p>Loading...</p></section>
  return (
    <section className="page">
      <div className="head"><div><h1>Settings</h1><p>Contact details here are what the storefront shows customers.</p></div></div>
      <div className="grid"><form className="card span2 sheet" style={{ width: 'auto' }} onSubmit={save}>
        <div className="two">{fields.slice(0, 3).map(([k, l]) => <label key={k}>{l}<input value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>)}</div>
        {fields.slice(3).map(([k, l]) => <label key={k}>{l}<input value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>)}
        {msg && <p className={msg === 'Saved.' ? '' : 'err'}>{msg}</p>}<button className="btn">Save settings</button></form>
        <div className="stack"><form className="card sheet" style={{ width: 'auto' }} onSubmit={saveName}>
          <h2>Your profile</h2>
          <label>Email<input value={email} disabled /></label><small>Your email cannot be changed.</small>
          <label>Sign-in name<input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="e.g. Kwame" /></label><small>Use this name instead of your email to sign in.</small>
          {nmsg && <p className={nmsg.startsWith('Saved') ? '' : 'err'}>{nmsg}</p>}<button className="btn">Save name</button></form>
        <form className="card sheet" style={{ width: 'auto' }} onSubmit={changePw}>
          <h2>Change your password</h2><label>New password<PasswordInput minLength="8" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {pmsg && <p className={pmsg.startsWith('Password updated') ? '' : 'err'}>{pmsg}</p>}<button className="btn">Update password</button></form></div></div>
    </section>
  )
}
