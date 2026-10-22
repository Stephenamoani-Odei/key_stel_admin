import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Home, Package, LayoutGrid, Boxes, ShoppingCart, BarChart3, FileText, Users, Settings as Cog, LogOut, Menu, Bell, Search, ChevronDown, UserRound, MessageSquare, Receipt as ReceiptIcon } from 'lucide-react'
import { supabase } from './supabase.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import Products from './Products.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import ResetPassword from './ResetPassword.jsx'

const POS = lazy(() => import('./POS.jsx'))
const Categories = lazy(() => import('./Categories.jsx'))
const Inventory = lazy(() => import('./Inventory.jsx'))
const Orders = lazy(() => import('./Orders.jsx'))
const Customers = lazy(() => import('./Customers.jsx'))
const Messages = lazy(() => import('./Messages.jsx'))
const Analytics = lazy(() => import('./Analytics.jsx'))
const Reports = lazy(() => import('./Reports.jsx'))
const Staff = lazy(() => import('./Staff.jsx'))
const Settings = lazy(() => import('./Settings.jsx'))

const NAV = [[Home, 'Overview'], [ReceiptIcon, 'Point of Sale'], [Package, 'Products'], [LayoutGrid, 'Categories'], [Boxes, 'Inventory'], [ShoppingCart, 'Orders'], [UserRound, 'Customers'], [MessageSquare, 'Messages'], [BarChart3, 'Sales & Analytics'], [FileText, 'Reports'], [Users, 'Staff & Access Control'], [Cog, 'Settings']]

function TopSearch({ go }) {
  const [q, setQ] = useState(''), [res, setRes] = useState(null)
  useEffect(() => {
    const term = q.trim().replace(/[%,()]/g, '')
    if (term.length < 2) return setRes(null)
    const t = setTimeout(async () => {
      const num = /^#?\d+$/.test(term) ? `,id.eq.${term.replace('#', '')}` : ''
      const [p, o] = await Promise.all([
        supabase.from('products').select('id,name').ilike('name', `%${term}%`).limit(4),
        supabase.from('orders').select('id,customer_name').or(`customer_name.ilike.%${term}%${num}`).limit(4),
      ])
      setRes({ p: p.data || [], o: o.data || [] })
    }, 250)
    return () => clearTimeout(t)
  }, [q])
  const pick = (page, term) => { setQ(''); setRes(null); go(page, term) }
  return (
    <div className="search dd"><Search size={17} /><input placeholder="Search products, orders, or customers..." value={q} onChange={(e) => setQ(e.target.value)} />
      {res && <div className="pop">
        {!res.p.length && !res.o.length && <h4>No matches</h4>}
        {res.p.length > 0 && <><h4>Products</h4>{res.p.map((p) => <button key={p.id} onClick={() => pick('Products', p.name)}>{p.name}</button>)}</>}
        {res.o.length > 0 && <><h4>Orders and customers</h4>{res.o.map((o) => <button key={o.id} onClick={() => pick('Orders', String(o.id))}>#{o.id} <span>{o.customer_name}</span></button>)}</>}
      </div>}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined), [role, setRole] = useState(null), [pname, setPname] = useState(''), [must, setMust] = useState(false)
  const [nav, setNav] = useState({ page: 'Overview', q: '', startNew: false, n: 0 }), [menu, setMenu] = useState(false), [bell, setBell] = useState(false), [acct, setAcct] = useState(false)
  const [alerts, setAlerts] = useState({ pending: 0, unread: 0, low: 0 })
  const go = (page, q = '', startNew = false) => { setNav((s) => ({ page, q, startNew, n: s.n + 1 })); setMenu(false); setBell(false); setAcct(false) }

  useEffect(() => {
    const label = () => document.querySelectorAll('main table').forEach((t) => {
      const heads = [...t.querySelectorAll(':scope > thead th')].map((h) => h.textContent.trim())
      t.querySelectorAll(':scope > tbody > tr').forEach((tr) => {
        if (tr.children.length !== heads.length) return
        ;[...tr.children].forEach((td, i) => { if (td.dataset.label !== heads[i]) td.dataset.label = heads[i] })
      })
    })
    const mo = new MutationObserver(() => requestAnimationFrame(label))
    mo.observe(document.body, { childList: true, subtree: true })
    label()
    return () => mo.disconnect()
  }, [])
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.dd')) { setBell(false); setAcct(false) } }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return setRole(null)
    supabase.from('staff').select('role,display_name,must_change_password').eq('user_id', session.user.id).maybeSingle().then(({ data }) => { setRole(data ? data.role : false); setPname(data?.display_name || ''); setMust(!!data?.must_change_password) })
  }, [session])
  const refresh = useCallback(async () => {
    const [o, p, u] = await Promise.all([supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'Pending'), supabase.from('products').select('stock,low_stock_threshold'), supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('is_read', false)])
    setAlerts({ pending: o.count || 0, unread: u.count || 0, low: (p.data || []).filter((x) => x.stock <= x.low_stock_threshold).length })
  }, [])
  useEffect(() => { if (!role) return; refresh(); const t = setInterval(refresh, 60000); return () => clearInterval(t) }, [role, nav.n, refresh])

  if (!supabase) return <div className="login"><div className="card"><b>Supabase is not connected.</b><p>Copy .env.example to .env, add your project URL and publishable key, then restart the dev server.</p></div></div>
  if (session === undefined) return null
  if (!session) return <Login />
  if (role === null) return null
  if (!role) return <div className="login"><div className="card"><b>This account is not staff.</b><p>Add its user id to the staff table, then sign in again.</p><button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>
  if (must) return <ResetPassword title="Choose your own password" forbid="keyStel1234" onDone={async () => { await supabase.rpc('password_changed'); setMust(false) }} />

  const admin = role === 'admin' || role === 'superadmin', email = session.user.email, label = pname || email, P = nav.page
  const items = NAV.filter(([, l]) => admin || l !== 'Staff & Access Control')
  const alertCount = alerts.pending + (alerts.unread ? 1 : 0) + (alerts.low ? 1 : 0)
  return (
    <div className="shell">
      <div className={'scrim' + (menu ? ' on' : '')} onClick={() => setMenu(false)} />
      <aside className={'side' + (menu ? ' open' : '')}>
        <div className="brand"><span className="logo">KEY-STEL</span><small>Your Secured Partner!</small></div>
        <nav>{items.map(([Icon, label]) => (
          <a key={label} href="#" className={P === label ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(label) }}>
            <Icon size={19} /><span>{label}</span>{label === 'Orders' && alerts.pending > 0 && <em>{alerts.pending}</em>}{label === 'Messages' && alerts.unread > 0 && <em>{alerts.unread}</em>}
          </a>))}</nav>
        <div className="status"><i /> System Online <small>v1.0.0</small></div>
      </aside>
      <main>
        <header className="top">
          <button className="burger" onClick={() => setMenu(!menu)} aria-label="Menu"><Menu size={22} /></button>
          <TopSearch go={go} />
          <div className="dd" style={{ marginLeft: 'auto' }}>
            <button className="me mebtn" onClick={() => { setAcct(!acct); setBell(false) }} aria-expanded={acct} aria-label="Account menu">
              <b>{label[0].toUpperCase()}</b><div>{label}<small>{role === 'superadmin' ? 'Super Admin' : admin ? 'Admin' : 'Staff'}</small></div><ChevronDown size={16} className="chev" />
            </button>
            {acct && <div className="pop">
              <h4>Signed in as {label}</h4>
              <button onClick={() => go('Settings')}>Settings</button>
              <button onClick={() => supabase.auth.signOut()}>Sign out <LogOut size={15} /></button>
            </div>}
          </div>
          <div className="dd">
            <button className="bell" onClick={() => { setBell(!bell); setAcct(false) }} aria-label="Notifications"><Bell size={20} />{alertCount > 0 && <i />}</button>
            {bell && <div className="pop">
              {alertCount === 0 && <h4>You are all caught up</h4>}
              {alerts.pending > 0 && <button onClick={() => go('Orders')}>{alerts.pending} pending order{alerts.pending > 1 && 's'}<span>View</span></button>}
              {alerts.unread > 0 && <button onClick={() => go('Messages')}>{alerts.unread} new message{alerts.unread > 1 && 's'}<span>View</span></button>}
              {alerts.low > 0 && <button onClick={() => go('Inventory')}>{alerts.low} product{alerts.low > 1 && 's'} low on stock<span>View</span></button>}
            </div>}
          </div>
        </header>
        <ErrorBoundary key={nav.n}><Suspense fallback={<section className="page"><p>Loading...</p></section>}>
          {P === 'Overview' && <Dashboard go={go} />}
          {P === 'Point of Sale' && <POS onDone={refresh} />}
          {P === 'Products' && <Products q={nav.q} startNew={nav.startNew} />}
          {P === 'Categories' && <Categories />}
          {P === 'Inventory' && <Inventory q={nav.q} />}
          {P === 'Orders' && <Orders q={nav.q} onChange={refresh} />}
          {P === 'Customers' && <Customers />}
          {P === 'Messages' && <Messages onChange={refresh} />}
          {P === 'Sales & Analytics' && <Analytics />}
          {P === 'Reports' && <Reports />}
          {P === 'Staff & Access Control' && admin && <Staff me={session.user.id} myRole={role} />}
          {P === 'Settings' && <Settings email={email} name={pname} onName={setPname} />}
        </Suspense></ErrorBoundary>
      </main>
    </div>
  )
}
