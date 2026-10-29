import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// One shared popup for the whole app, used instead of the browser's alert() and confirm().
//   const { confirm, notify } = useDialog()
//   if (!(await confirm({ title: 'Delete door?', message: 'This cannot be undone.', yes: 'Delete', danger: true }))) return
//   await notify({ title: 'Password reset', message: 'The new password is keyStel1234.' })
const Ctx = createContext(null)

export function DialogProvider({ children }) {
  const [d, setD] = useState(null)
  const done = useRef(null)
  const btn = useRef(null)

  const open = useCallback((opts) => new Promise((resolve) => { done.current = resolve; setD(opts) }), [])
  const close = (value) => { const r = done.current; done.current = null; setD(null); r?.(value) }

  const api = useMemo(() => ({
    confirm: (o) => open({ ask: true, ...o }),
    notify: (o) => open({ ask: false, ...o }),
  }), [open])

  useEffect(() => {
    if (!d) return
    btn.current?.focus()
    const key = (e) => { if (e.key === 'Escape') close(d.ask ? false : undefined) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [d])

  return (
    <Ctx.Provider value={api}>
      {children}
      {d && (
        <div className="modal dlg" onClick={() => close(d.ask ? false : undefined)}>
          <div className="card dlgbox" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="dlg-title">{d.title || (d.ask ? 'Are you sure?' : 'Notice')}</h2>
            {d.message && <p className="dlgmsg">{d.message}</p>}
            {d.children}
            <div className="tools dlgbtns">
              {d.ask && <button type="button" className="btn ghost" onClick={() => close(false)}>{d.no || 'Cancel'}</button>}
              <button type="button" ref={btn} className={'btn' + (d.danger ? ' danger' : '')} onClick={() => close(d.ask ? true : undefined)}>{d.yes || (d.ask ? 'Yes' : 'OK')}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useDialog = () => useContext(Ctx)
