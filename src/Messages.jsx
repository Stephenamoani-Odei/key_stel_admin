import { useEffect, useState } from 'react'
import { MessageCircle, Phone, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { useDialog } from './Dialog.jsx'
import { dateTime } from './lib.js'

const digits = (p) => (p || '').replace(/\D/g, '')
const waLink = (p, text) => { let d = digits(p); if (d.startsWith('0')) d = '233' + d.slice(1); return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null }

export default function Messages({ onChange }) {
  const { confirm } = useDialog()
  const [rows, setRows] = useState([]), [tab, setTab] = useState('All'), [open, setOpen] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }) => { if (error) setErr(error.message.includes('is_read') || error.message.includes('inquiries') ? 'Messages are not set up yet. Run 007_messages.sql in the Supabase SQL editor.' : error.message); setRows(data || []); setLoading(false) })
  }, [])
  async function mark(m, is_read) {
    const { error } = await supabase.from('inquiries').update({ is_read }).eq('id', m.id)
    if (error) return setErr(error.message)
    setRows((r) => r.map((x) => (x.id === m.id ? { ...x, is_read } : x))); onChange?.()
  }
  async function remove(m) {
    if (!(await confirm({ title: 'Delete this message?', message: `The message from ${m.name} will be deleted.`, yes: 'Delete', danger: true }))) return
    const { error } = await supabase.from('inquiries').delete().eq('id', m.id)
    if (error) return setErr(error.message)
    setRows((r) => r.filter((x) => x.id !== m.id)); onChange?.()
  }
  const toggle = (m) => { const o = open === m.id ? null : m.id; setOpen(o); if (o && !m.is_read) mark(m, true) }
  const unread = rows.filter((m) => !m.is_read).length
  const shown = tab === 'Unread' ? rows.filter((m) => !m.is_read) : rows
  return (
    <section className="page">
      <div className="head"><div><h1>Messages</h1><p>Questions sent from the contact form on the website.</p></div></div>
      <div className="tabs">{[['All', rows.length], ['Unread', unread]].map(([t, n]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t} ({n})</button>)}</div>
      {err && <p className="err">{err}</p>}
      {loading ? <p>Loading...</p> : shown.length === 0 ? <div className="card"><p className="empty">{rows.length ? 'No unread messages.' : 'No messages yet. Website contact form messages will appear here.'}</p></div> :
        <div className="msgs">{shown.map((m) => (
          <div className={'card msg' + (m.is_read ? '' : ' unread')} key={m.id}>
            <button className="msghead" onClick={() => toggle(m)}>
              <span className="who">{!m.is_read && <i className="dot" />}<b>{m.name}</b><small>{m.phone}</small></span>
              <span className="when">{dateTime(m.created_at)}</span>
              {open !== m.id && <span className="preview">{m.message}</span>}
            </button>
            {open === m.id && <div className="msgbody">
              <p>{m.message}</p>
              <div className="tools">
                <a className="btn" href={`tel:${digits(m.phone)}`}><Phone size={16} /> Call</a>
                {waLink(m.phone, `Hello ${m.name}, thank you for contacting Key-Stel. `) && <a className="btn ghost" href={waLink(m.phone, `Hello ${m.name}, thank you for contacting Key-Stel. `)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Reply on WhatsApp</a>}
                <button className="btn ghost" onClick={() => mark(m, !m.is_read)}>{m.is_read ? 'Mark as unread' : 'Mark as read'}</button>
                <button className="btn ghost" onClick={() => remove(m)}><Trash2 size={16} /> Delete</button>
              </div>
            </div>}
          </div>))}</div>}
    </section>
  )
}
