import { useCallback, useEffect, useState } from 'react'
import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'

export default function StaffDashboard() {
  const [staff, setStaff] = useState(null)
  const [page, setPage] = useState(() => ['overview', 'inbox'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview')
  const [theme, setTheme] = useState(() => localStorage.getItem('weblox-theme') || 'dark')
  const [attendance, setAttendance] = useState(null)
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [attendanceNotice, setAttendanceNotice] = useState('')
  const [attendanceError, setAttendanceError] = useState('')
  const [inbox, setInbox] = useState([])
  const [inboxError, setInboxError] = useState('')
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioLoaded, setPortfolioLoaded] = useState(false)
  const [portfolioError, setPortfolioError] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('weblox-theme', theme)
  }, [theme])

  useEffect(() => {
    let current = true
    authRequest('/session').then(({ account }) => {
      if (!current) return
      if (!account || account.accountType !== 'staff') {
        clearStaffSession()
        location.replace('/staff-sign-in.html')
        return
      }
      setStaff(account)
    }).catch(() => {
      if (!current) return
      clearStaffSession()
      location.replace('/staff-sign-in.html')
    })
    return () => { current = false }
  }, [])

  const loadInbox = useCallback(async () => {
    try {
      const { messages } = await staffRequest('/api/workspace/inbox')
      setInbox(messages)
      setInboxError('')
    } catch (error) {
      setInboxError(error.message || 'Could not load your inbox.')
    }
  }, [])

  useEffect(() => {
    if (!staff) return
    staffRequest('/api/staff/attendance').then(({ attendance: today }) => { setAttendance(today); setAttendanceLoaded(true) }).catch((error) => { setAttendanceError(error.message); setAttendanceLoaded(true) })
    staffRequest('/api/portfolios/me').then(({ portfolio: saved }) => { setPortfolio(saved); setPortfolioLoaded(true) }).catch((error) => { setPortfolioError(error.message || 'Portfolio details are temporarily unavailable.'); setPortfolioLoaded(true) })
    loadInbox()
  }, [staff, loadInbox])

  const showPage = (nextPage) => {
    if (nextPage === 'portfolio') {
      location.assign('/staff-portfolio.html')
      return
    }
    const selected = ['overview', 'inbox'].includes(nextPage) ? nextPage : 'overview'
    setPage(selected)
    if (location.hash !== `#${selected}`) history.replaceState(null, '', `#${selected}`)
    if (selected === 'inbox') loadInbox()
  }

  const updateAttendance = async (action) => {
    setAttendanceNotice('')
    setAttendanceError('')
    try {
      const { attendance: updated } = await staffRequest('/api/staff/attendance', action
        ? { method: 'POST', body: JSON.stringify({ action }) }
        : {})
      setAttendance(updated)
      setAttendanceNotice(action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : '')
    } catch (error) {
      setAttendanceError(error.message || 'Could not update attendance.')
    }
  }

  const markAsRead = async (messageId) => {
    try {
      await staffRequest(`/api/workspace/inbox/${encodeURIComponent(messageId)}/read`, { method: 'POST' })
      await loadInbox()
    } catch (error) {
      setInboxError(error.message || 'Could not update this message.')
    }
  }

  const signOut = async () => {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    location.replace('/staff-sign-in.html')
  }

  if (!staff) return null

  const unreadCount = inbox.filter((message) => !message.readAt).length
  const portfolioDraft = portfolio?.draft || {}
  const portfolioProgress = [portfolioDraft.name && portfolioDraft.title, portfolioDraft.biography, portfolioDraft.skills?.length, portfolioDraft.projects?.length, portfolioDraft.experience?.length, portfolioDraft.education?.length]
  const completion = Math.round((portfolioProgress.filter(Boolean).length / portfolioProgress.length) * 100)

  return (
    <main className="staff-dash">
      <header className="dash-head">
        <a href="/" className="dash-brand"><img src="/assets/weblox-logo.png" alt="" /> WEBLOX <span className="eyebrow">STAFF WORKSPACE</span></a>
        <div className="dash-actions">
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><span aria-hidden="true">{theme === 'light' ? '☀' : '◐'}</span></button>
          <button className="button secondary dash-secondary" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <aside id="staffSidebar" className="dash-panel">
        <div className="dash-sidebar-profile">
          <span className="eyebrow">SIGNED IN AS</span>
          <strong>{staff.name || 'Staff member'}</strong>
          <small>{staff.role} · {staff.email}</small>
        </div>
        <nav className="dash-nav" aria-label="Staff dashboard navigation">
          <button className={page === 'overview' ? 'active' : ''} aria-current={page === 'overview' ? 'page' : undefined} type="button" onClick={() => showPage('overview')}>Overview</button>
          <button className={page === 'inbox' ? 'active' : ''} aria-current={page === 'inbox' ? 'page' : undefined} type="button" onClick={() => showPage('inbox')}>Inbox <span className={`inbox-unread${unreadCount ? '' : ' hidden'}`} aria-label={`${unreadCount} unread messages`}>{unreadCount > 99 ? '99+' : unreadCount}</span></button>
          <button type="button" onClick={() => showPage('portfolio')}>Portfolio builder</button>
        </nav>
        <section className="dash-attendance" aria-label="Attendance">
          <span className="eyebrow">TODAY’S ATTENDANCE</span>
          <p>{attendance ? `Clock in: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : 'not recorded'} · Clock out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : 'not recorded'}` : attendanceError || (attendanceLoaded ? 'No attendance recorded today.' : 'Loading attendance…')}</p>
          <div className="dash-clock-actions">
            <button className="button" type="button" onClick={() => updateAttendance('clock_in')}>Clock in</button>
            <button className="button secondary" type="button" onClick={() => updateAttendance('clock_out')}>Clock out</button>
          </div>
          {attendanceNotice && <p className="dash-notice" role="status">{attendanceNotice}</p>}
          {attendanceError && <p className="dash-error" role="alert">{attendanceError}</p>}
        </section>
      </aside>

      <section className="dash-hero">
        <div><span className="eyebrow">STAFF DASHBOARD</span><h1>Welcome, {staff.name?.split(' ')[0] || 'Staff member'}.</h1><p>Your studio work and professional portfolio live here.</p></div>
        <span className="dash-role">{(staff.role || 'STAFF').toUpperCase()}</span>
      </section>

      {page === 'overview' && (
        <section id="overview" className="dash-grid" aria-label="Overview">
          <article className="dash-panel"><span className="eyebrow">YOUR PROFILE</span><h2>{staff.name || 'Staff member'}</h2><p>{staff.role} · {staff.email}</p>
            {portfolioError ? <div className="dash-muted">{portfolioError}</div> : portfolio ? <div className="dash-muted"><strong>{portfolio.status === 'published' ? 'Published' : portfolio.status === 'unpublished' ? 'Unpublished' : 'Draft'}</strong><p>Portfolio completion: {completion}%</p><p>Last saved: {portfolio.updatedAt ? new Date(portfolio.updatedAt).toLocaleString() : 'Not saved yet'}</p>{portfolio.status === 'published' && portfolio.slug && <a className="dash-public-link" href={`/portfolio.html?slug=${encodeURIComponent(portfolio.slug)}`} target="_blank" rel="noopener noreferrer">Open public portfolio →</a>}<button className="button secondary dash-secondary dash-edit-portfolio" type="button" onClick={() => showPage('portfolio')}>Edit portfolio</button></div> : portfolioLoaded ? <div className="dash-muted">Your portfolio is empty. Add your profile and work to get started.</div> : <div className="dash-muted">Loading portfolio…</div>}
          </article>
          <article className="dash-panel"><span className="eyebrow">PROFESSIONAL PORTFOLIO</span><h2>Show the work you do.</h2><p>Build a simple portfolio with your introduction, skills, and selected projects. Save it and share your link.</p><button className="button" type="button" onClick={() => showPage('portfolio')}>Open portfolio builder →</button></article>
          <article className="dash-panel dash-workspace-card"><span className="eyebrow">WORKSPACE ACCESS</span><h2>Welcome to WEBLOX</h2><p>Your account has signed in. Team tasks, check-ins, and project tools can be connected to this dashboard as the server API grows.</p></article>
        </section>
      )}

      {page === 'inbox' && (
        <section id="inbox" className="dash-panel" aria-label="Workspace inbox">
          <span className="eyebrow">WORKSPACE INBOX</span><h2>Reports and announcements</h2>
          {inboxError ? <p className="dash-error" role="alert">{inboxError}</p> : <p>{unreadCount ? `${unreadCount} unread message(s)` : 'You’re up to date.'}</p>}
          {!inboxError && inbox.length === 0 && <div className="dash-muted">Reports and announcements will appear here.</div>}
          {inbox.map((message) => <article className="dash-muted inbox-message" key={message.id}><b>{message.subject}</b><p>{message.type === 'announcement' ? 'Announcement' : 'Weekly report'} · {message.senderName} · {new Date(message.createdAt).toLocaleString()}</p><p className="inbox-message-body">{message.body}</p>{!message.readAt && <button className="button secondary dash-secondary" type="button" onClick={() => markAsRead(message.id)}>Mark as read</button>}</article>)}
        </section>
      )}
    </main>
  )
}
