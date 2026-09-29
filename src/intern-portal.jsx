import { useCallback, useEffect, useState } from 'react'
import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'
import ThemeSettings, { useThemePreference } from './components/ThemeSettings.jsx'
import ImageLibrary from './components/ImageLibrary.jsx'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'
import { uploadDashboardImage } from './lib/imageLibrary.js'
import PageLoadingSkeleton from './components/PageLoadingSkeleton.jsx'
import DashboardNavIcon from './components/DashboardNavIcon.jsx'

function getInternTitle(role) {
  const value = String(role || '').trim()
  if (!value) return 'Intern'
  return /\bintern\b/i.test(value) ? value : `${value} Intern`
}

export default function InternPortal() {
  const [intern, setIntern] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [loginNotice, setLoginNotice] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [checkins, setCheckins] = useState([])
  const [drafts, setDrafts] = useState({ morning: '', evening: '' })
  const [inbox, setInbox] = useState([])
  const [certificates, setCertificates] = useState([])
  const [portalNotice, setPortalNotice] = useState('')
  const [portalError, setPortalError] = useState('')
  const [busySlot, setBusySlot] = useState('')
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useThemePreference()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState('')
  const internTitle = getInternTitle(intern?.role)

  const showInternPage = (next) => {
    setPage(next)
    setSidebarOpen(false)
    if (matchMedia('(max-width: 800px)').matches) requestAnimationFrame(() => document.querySelector('.intern-main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

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

  const loadCertificates = useCallback(async () => {
    const { certificates: issued } = await staffRequest('/api/intern/me/certificates')
    setCertificates(issued)
  }, [])

  useEffect(() => {
    let active = true
    authRequest('/session').then(({ account }) => {
      if (!active) return
      if (account?.accountType === 'intern') setIntern(account)
      else clearStaffSession()
      setSessionChecked(true)
    }).catch(() => { clearStaffSession(); setSessionChecked(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (sessionChecked) window.webloxDismissBrandedLoader?.()
  }, [sessionChecked])

  useEffect(() => {
    if (!intern) return
    setPortalError('')
    Promise.all([loadCheckins(), loadInbox(), loadCertificates()]).catch((error) => setPortalError(error.message || 'Could not load your workspace.'))
  }, [intern, loadCheckins, loadInbox, loadCertificates])

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
      window.webloxShowBrandedLoader?.('/intern-portal.html')
      location.assign('/intern-portal.html')
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

  const updateProfilePhoto = async (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPortalError('')
    setPortalNotice('')
    try {
      const image = await uploadDashboardImage(file)
      const { account } = await staffRequest('/api/intern/me/profile', {
        method: 'PUT', body: JSON.stringify({ profilePhotoUrl: image.url }),
      })
      setIntern(account)
      setPortalNotice('Profile picture updated.')
    } catch (error) {
      setPortalError(error.message || 'Could not update your profile picture.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const removeProfilePhoto = async () => {
    setPhotoBusy(true)
    setPortalError('')
    setPortalNotice('')
    try {
      const { account } = await staffRequest('/api/intern/me/profile', {
        method: 'PUT', body: JSON.stringify({ profilePhotoUrl: '' }),
      })
      setIntern(account)
      setPortalNotice('Profile picture removed.')
    } catch (error) {
      setPortalError(error.message || 'Could not remove your profile picture.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setPasswordBusy(true)
    setPasswordNotice('')
    try {
      if (form.elements.newPassword.value !== form.elements.confirmPassword.value)
        throw new Error('The new passwords do not match.')
      await authRequest('/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }),
      })
      form.reset()
      setPasswordNotice('Password updated successfully.')
    } catch (error) {
      setPasswordNotice(error.message || 'Could not update your password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    !sessionChecked ? <PageLoadingSkeleton label="Loading intern portal" /> :
    <main className={`intern-shell${intern ? ' has-sidebar' : ''}`}>
      {!intern ? (
        <section className="intern-card intern-login"><a className="intern-brand" href="/"><ThemeAwareLogo /> WEBLOX STUDIOS</a><span className="eyebrow">WEBLOX INTERNSHIP PROGRAM</span><h1>Intern sign in</h1><p>Use the email and temporary password provided by your administrator.</p>
          <form className="intern-form" onSubmit={signIn}><label>Email address<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button></form>
          {loginNotice && <div className="intern-notice" role="alert">{loginNotice}</div>}
        </section>
      ) : (
        <>
          <aside className={`intern-sidebar${sidebarOpen ? ' is-open' : ''}`}>
            <button className="dashboard-sidebar-toggle" type="button" aria-expanded={sidebarOpen} aria-controls="internSidebarContent" onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? 'Hide dashboard menu' : 'Show dashboard menu'}<span aria-hidden="true">{sidebarOpen ? '−' : '+'}</span></button>
            <div className="dashboard-sidebar-content" id="internSidebarContent">
            <a className="intern-brand" href="/"><ThemeAwareLogo /> <span>WEBLOX<small>INTERNSHIP PORTAL</small></span></a>
            <div className="intern-profile">
              <div className="intern-avatar">{intern.profilePhotoUrl ? <img src={intern.profilePhotoUrl} alt={`${intern.name}'s profile`} /> : <span>{intern.name?.trim()?.[0]?.toUpperCase() || 'I'}</span>}</div>
              <b>{intern.name}</b><small>{internTitle}</small>
              <label className="button secondary intern-photo-button" htmlFor="internPhotoUpload">{photoBusy ? 'Saving…' : intern.profilePhotoUrl ? 'Change photo' : 'Add photo'}</label>
              <input id="internPhotoUpload" className="intern-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={photoBusy} onChange={updateProfilePhoto} />
              {intern.profilePhotoUrl && <button type="button" className="intern-remove-photo" disabled={photoBusy} onClick={removeProfilePhoto}>Remove photo</button>}
            </div>
            <nav className="intern-side-nav" aria-label="Intern dashboard navigation">
              <button className={page === 'dashboard' ? 'active' : ''} type="button" onClick={() => showInternPage('dashboard')}><DashboardNavIcon name="dashboard" />Dashboard</button>
              <button className={page === 'images' ? 'active' : ''} type="button" onClick={() => showInternPage('images')}><DashboardNavIcon name="images" />My files</button>
              <button className={page === 'settings' ? 'active' : ''} type="button" onClick={() => showInternPage('settings')}><DashboardNavIcon name="settings" />Settings</button>
            </nav>
            <button className="intern-signout" type="button" onClick={signOut}>Sign out <span>↗</span></button>
            </div>
          </aside>
          <div className="intern-main-content">
          <header className="intern-card intern-head"><div><span className="eyebrow">{internTitle.toUpperCase()} · WEBLOX INTERNSHIP PROGRAM</span><h1>{page === 'images' ? `${internTitle} Files` : page === 'settings' ? `${internTitle} Settings` : `${internTitle} Dashboard`}</h1><p>{intern.name}</p></div></header>
          {page === 'dashboard' && <>
          <section className="intern-card"><span className="eyebrow">WORKSPACE INBOX</span><h2>Reports and announcements</h2><p>{inbox.filter((item) => !item.readAt).length ? `${inbox.filter((item) => !item.readAt).length} unread message(s)` : 'You’re up to date.'}</p>
            {inbox.length === 0 ? <div className="intern-empty">Reports and announcements will appear here.</div> : inbox.map((item) => <article className="intern-row" key={item.id}><b>{item.subject}</b><small>{item.type === 'announcement' ? 'Announcement' : 'Weekly report'} · {item.senderName} · {new Date(item.createdAt).toLocaleString()}</small><p>{item.body}</p>{!item.readAt && <button className="button secondary" type="button" onClick={() => markRead(item.id)}>Mark as read</button>}</article>)}
          </section>
          {(['morning', 'evening']).map((slot) => <section className="intern-card" key={slot}><span className="eyebrow">{slot === 'morning' ? 'START OF DAY' : 'END OF DAY'}</span><h2>{slot === 'morning' ? 'Morning check-in' : 'Evening check-in'}</h2>
            <form className="intern-form" onSubmit={(event) => submitCheckin(event, slot)}><label>{slot === 'morning' ? 'What are you focusing on today?' : 'What did you complete, and what needs follow-up?'}<textarea name="text" rows="4" maxLength="3000" required value={drafts[slot]} onChange={(event) => updateDraft(slot, event.target.value)} /></label><button className="button" type="submit" disabled={busySlot === slot}>{busySlot === slot ? 'Saving…' : drafts[slot] ? `Update ${slot} check-in` : `Submit ${slot} check-in`}</button></form>
          </section>)}
          <section className="intern-card"><span className="eyebrow">YOUR ACTIVITY</span><h2>Previous check-ins</h2>
            {checkins.length === 0 ? <div className="intern-empty">Your submitted check-ins will appear here.</div> : checkins.map((entry) => <article className="intern-row" key={String(entry.date)}><small>{String(entry.date).slice(0, 10)}</small><div>Morning: {entry.morning || 'Not submitted'}</div><div>Evening: {entry.evening || 'Not submitted'}</div></article>)}
          </section>
          <section className="intern-card"><span className="eyebrow">YOUR CREDENTIALS</span><h2>Certificates of internship</h2><p>Certificates issued by the WEBLOX master administrator are available here to view, share, and download.</p>{certificates.length ? <div className="intern-certificate-list">{certificates.map((certificate) => <article className="intern-certificate-card" key={certificate.id}><img src={certificate.imageUrl} alt={`Certificate of internship for ${certificate.certificateData.name}`} /><div><b>{certificate.certificateData.name}</b><small>{certificate.certificateData.track} · Issued {certificate.certificateData.issuedAt}</small><code>Credential ID: {certificate.credentialId}</code><label>Certificate image URL<input readOnly value={new URL(certificate.imageUrl, location.origin).href} onFocus={(event) => event.currentTarget.select()} /></label><a className="button" href={certificate.pdfUrl}>Download certificate PDF</a></div></article>)}</div> : <div className="intern-empty">No certificate has been issued to your account yet.</div>}</section>
          {portalError && <div className="intern-notice" role="alert">{portalError}</div>}
          {portalNotice && <div className="intern-notice success" role="status">{portalNotice}</div>}
          </>}
          {page === 'images' && <ImageLibrary />}
          {page === 'settings' && <>
            <section className="intern-card"><span className="eyebrow">PREFERENCES</span><h2>Appearance</h2><p className="theme-settings-copy">Choose how your intern workspace looks. This preference is saved for your next visit.</p><ThemeSettings theme={theme} onChange={setTheme} /></section>
            <section className="intern-card"><span className="eyebrow">ACCOUNT SECURITY</span><h2>Create or change your password</h2><p className="theme-settings-copy">Use your current password to set a new one. Choose at least 8 characters.</p><form className="intern-form intern-password-form" onSubmit={changePassword}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" minLength="8" autoComplete="new-password" required /></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="8" autoComplete="new-password" required /></label><button className="button" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Update password'}</button></form>{passwordNotice && <div className={`intern-notice${passwordNotice === 'Password updated successfully.' ? ' success' : ''}`} role="status">{passwordNotice}</div>}</section>
          </>}
          </div>
        </>
      )}
    </main>
  )
}
