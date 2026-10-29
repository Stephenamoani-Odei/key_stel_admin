import { useEffect, useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { supabase } from './supabase.js'
import { dateTime } from './lib.js'
import { smsInfo, TEMPLATES, callBroadcast } from './sms.js'

export default function Broadcast({ go }) {
  const [settings, setSettings] = useState(null), [count, setCount] = useState(null), [history, setHistory] = useState([]), [setupErr, setSetupErr] = useState('')
  const [msg, setMsg] = useState(''), [testPhone, setTestPhone] = useState(''), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(''), [result, setResult] = useState(null)

  async function load() {
    const [s, r, h] = await Promise.all([
      supabase.from('settings').select('store_name,phone,sms_sender_id').eq('id', 1).maybeSingle(),
      supabase.rpc('broadcast_recipients'),
      supabase.from('broadcasts').select('*').order('id', { ascending: false }).limit(5),
    ])
    if (s.error || r.error || h.error) setSetupErr('Messaging is not set up in the database yet. Run 012_sms_broadcast.sql in the Supabase SQL editor.')
    else setSetupErr('')
    setSettings(s.data || {}); setCount(r.error ? null : (r.data || []).length); setHistory(h.data || [])
  }
  useEffect(() => { load() }, [])

  const shop = settings?.store_name || 'Key-Stel'
  const sender = settings?.sms_sender_id
  const info = smsInfo(msg)
  const ready = !setupErr && sender && msg.trim() && count > 0
  const pick = (e) => { const t = TEMPLATES[e.target.value]; if (t) setMsg(t[1](shop, settings?.phone)); setConfirm(false); setResult(null) }

  async function run(body, label) {
    setBusy(label); setResult(null)
    const r = await callBroadcast(supabase, body)
    setBusy(''); setConfirm(false)
    setResult(r.ok ? { ok: true, text: label === 'test' ? 'Test message sent. Check the phone.' : `Sent to ${r.sent} of ${r.recipients} customers.${r.failed ? ` ${r.failed} were not accepted by the SMS service${r.note ? ` (${r.note})` : ''}.` : ''}` } : { ok: false, text: r.error })
    if (label === 'send') { setMsg(r.ok ? '' : msg); load() }
  }

  return (
    <div className="card bcbox">
      <div className="ch"><h2><Megaphone size={18} /> Message all customers</h2></div>
      {setupErr && <p className="err">{setupErr}</p>}
      {settings && !sender && !setupErr && <p className="err">Set your SMS sender name first. <a href="#" className="lnk" onClick={(e) => { e.preventDefault(); go?.('Settings') }}>Open Settings</a></p>}
      {sender && <p><small>Customers will see the message from <b>{sender}</b>. {count != null && <>It goes to <b>{count}</b> customer{count === 1 ? '' : 's'}. People who asked not to be messaged and cancelled orders are left out.</>}</small></p>}

      <label>Start from a ready message
        <select defaultValue="" onChange={pick}><option value="" disabled>Choose a holiday or occasion</option>{TEMPLATES.map(([name], i) => <option key={name} value={i}>{name}</option>)}</select></label>
      <label>Your message
        <textarea rows="4" maxLength="640" value={msg} onChange={(e) => { setMsg(e.target.value); setConfirm(false); setResult(null) }} placeholder="Type your message to customers here" /></label>
      <small>{info.length} characters, {info.parts} SMS part{info.parts > 1 ? 's' : ''} per customer.{info.unicode && ' It has emoji or special characters, so each part holds only 70 characters.'}{count > 0 && msg.trim() ? ` About ${info.parts * count} SMS credits in total.` : ''}</small>

      <div className="tools" style={{ alignItems: 'end', marginTop: 8 }}>
        <label>Send a test to my phone first<input type="tel" placeholder="0241234567" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} /></label>
        <button className="btn ghost" disabled={!sender || !msg.trim() || !testPhone || !!busy} onClick={() => run({ mode: 'test', message: msg, phone: testPhone }, 'test')}>{busy === 'test' ? 'Sending...' : 'Send test'}</button>
      </div>

      {confirm ? (
        <div className="confirmbox">
          <p><b>Send this to {count} customers?</b> It cannot be undone, and uses about {info.parts * count} SMS credits.</p>
          <p className="preview">{msg}</p>
          <div className="tools"><button className="btn" disabled={!!busy} onClick={() => run({ mode: 'send', message: msg, expected: count }, 'send')}>{busy === 'send' ? 'Sending to everyone...' : 'Yes, send now'}</button><button className="btn ghost" disabled={!!busy} onClick={() => setConfirm(false)}>Cancel</button></div>
        </div>
      ) : (
        <button className="btn" disabled={!ready || !!busy} onClick={() => setConfirm(true)}><Send size={16} /> Send to all {count ?? ''} customers</button>
      )}
      {result && <p className={result.ok ? 'okmsg' : 'err'}>{result.text}</p>}

      {history.length > 0 && <>
        <h2 style={{ marginTop: 18, marginBottom: 8, fontSize: 14 }}>Recent broadcasts</h2>
        <table><thead><tr><th>When</th><th>By</th><th>Message</th><th>Sent</th><th>Status</th></tr></thead><tbody>{history.map((b) => (
          <tr key={b.id}><td>{dateTime(b.created_at)}</td><td>{b.sent_by}</td><td className="wrap">{b.message}</td><td>{b.sent} of {b.recipients}</td><td>{b.status === 'done' ? 'Done' : b.status === 'partial' ? 'Partly sent' : b.status === 'failed' ? 'Failed' : 'Sending'}</td></tr>))}</tbody></table>
      </>}
    </div>
  )
}
