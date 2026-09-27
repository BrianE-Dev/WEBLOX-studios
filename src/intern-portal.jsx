import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'

function InternPortal() {
  const [intern, setIntern] = useState(null)
  const [loginNotice, setLoginNotice] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [checkins, setCheckins] = useState([])
  const [drafts, setDrafts] = useState({ morning: '', evening: '' })
  const [inbox, setInbox] = useState([])
  const [portalNotice, setPortalNotice] = useState('')
  const [portalError, setPortalError] = useState('')
  const [busySlot, setBusySlot] = useState('')

  const loadCheckins = useCallback(async () => {
    const { checkins: entries } = await staffRequest('/api/intern/me/checkins')
    setCheckins(entries)
    const today = new Date().toISOString().slice(0, 10)
    const current = entries.find((entry) => String(entry.date).slice(0, 10) === today)
    setDrafts({ morning: current?.morning || '', evening: current?.evening || '' })
  }, [])

  const loadInbox = useCallback(async () => {
    const { messages } = await staffRequest('/api/workspace/inbox')
    setInbox(messages)
  }, [])

  useEffect(() => {
    let active = true
    authRequest('/session').then(({ account }) => {
      if (!active) return
      if (account?.accountType === 'intern') setIntern(account)
      else clearStaffSession()
    }).catch(() => clearStaffSession())
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!intern) return
    setPortalError('')
    Promise.all([loadCheckins(), loadInbox()]).catch((error) => setPortalError(error.message || 'Could not load your workspace.'))
  }, [intern, loadCheckins, loadInbox])

  const signIn = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setLoginNotice('')
    setLoginBusy(true)
    try {
      const { account } = await authRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.elements.email.value.trim().toLowerCase(), password: form.elements.password.value }),
      })
      if (account?.accountType !== 'intern') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        throw new Error('This account is not an intern account.')
      }
      setIntern(account)
    } catch (error) {
      setLoginNotice(error.message || 'Could not sign in.')
    } finally {
      setLoginBusy(false)
    }
  }

  const submitCheckin = async (event, slot) => {
    event.preventDefault()
    setBusySlot(slot)
    setPortalNotice('')
    setPortalError('')
    try {
      await staffRequest('/api/intern/me/checkins', {
        method: 'POST',
        body: JSON.stringify({ slot, text: drafts[slot] }),
      })
      setPortalNotice(`${slot} check-in saved.`)
      await loadCheckins()
    } catch (error) {
      setPortalError(error.message || 'Could not save your check-in.')
    } finally {
      setBusySlot('')
    }
  }

  const markRead = async (messageId) => {
    setPortalError('')
    try {
      await staffRequest(`/api/workspace/inbox/${encodeURIComponent(messageId)}/read`, { method: 'POST' })
      await loadInbox()
    } catch (error) {
      setPortalError(error.message || 'Could not mark the message as read.')
    }
  }

  const signOut = async () => {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    location.reload()
  }

  const updateDraft = (slot, value) => setDrafts((current) => ({ ...current, [slot]: value }))

  return (
    <main className="intern-shell">
      <a className="intern-brand" href="/"><img src="/assets/weblox-logo.png" alt="WEBLOX Studios" /> WEBLOX STUDIOS</a>
      {!intern ? (
        <section className="intern-card"><span className="eyebrow">WEBLOX INTERNSHIP PROGRAM</span><h1>Intern sign in</h1><p>Use the email and temporary password provided by your administrator.</p>
          <form className="intern-form" onSubmit={signIn}><label>Email address<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button></form>
          {loginNotice && <div className="intern-notice" role="alert">{loginNotice}</div>}
        </section>
      ) : (
        <>
          <header className="intern-card"><span className="eyebrow">WEBLOX INTERNSHIP PROGRAM</span><h1>Daily check-ins</h1><p>{intern.name} · {intern.role}</p><button className="button secondary" type="button" onClick={signOut}>Sign out</button></header>
          <section className="intern-card"><span className="eyebrow">WORKSPACE INBOX</span><h2>Reports and announcements</h2><p>{inbox.filter((item) => !item.readAt).length ? `${inbox.filter((item) => !item.readAt).length} unread message(s)` : 'You’re up to date.'}</p>
            {inbox.length === 0 ? <div className="intern-empty">Reports and announcements will appear here.</div> : inbox.map((item) => <article className="intern-row" key={item.id}><b>{item.subject}</b><small>{item.type === 'announcement' ? 'Announcement' : 'Weekly report'} · {item.senderName} · {new Date(item.createdAt).toLocaleString()}</small><p>{item.body}</p>{!item.readAt && <button className="button secondary" type="button" onClick={() => markRead(item.id)}>Mark as read</button>}</article>)}
          </section>
          {(['morning', 'evening']).map((slot) => <section className="intern-card" key={slot}><span className="eyebrow">{slot === 'morning' ? 'START OF DAY' : 'END OF DAY'}</span><h2>{slot === 'morning' ? 'Morning check-in' : 'Evening check-in'}</h2>
            <form className="intern-form" onSubmit={(event) => submitCheckin(event, slot)}><label>{slot === 'morning' ? 'What are you focusing on today?' : 'What did you complete, and what needs follow-up?'}<textarea name="text" rows="4" maxLength="3000" required value={drafts[slot]} onChange={(event) => updateDraft(slot, event.target.value)} /></label><button className="button" type="submit" disabled={busySlot === slot}>{busySlot === slot ? 'Saving…' : drafts[slot] ? `Update ${slot} check-in` : `Submit ${slot} check-in`}</button></form>
          </section>)}
          <section className="intern-card"><span className="eyebrow">YOUR ACTIVITY</span><h2>Previous check-ins</h2>
            {checkins.length === 0 ? <div className="intern-empty">Your submitted check-ins will appear here.</div> : checkins.map((entry) => <article className="intern-row" key={String(entry.date)}><small>{String(entry.date).slice(0, 10)}</small><div>Morning: {entry.morning || 'Not submitted'}</div><div>Evening: {entry.evening || 'Not submitted'}</div></article>)}
          </section>
          {portalError && <div className="intern-notice" role="alert">{portalError}</div>}
          {portalNotice && <div className="intern-notice success" role="status">{portalNotice}</div>}
        </>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<InternPortal />)
