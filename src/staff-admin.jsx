import { useCallback, useEffect, useState } from 'react'
import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'
import ThemeSettings, { useThemePreference } from './components/ThemeSettings.jsx'
import ImageLibrary from './components/ImageLibrary.jsx'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'
import PageLoadingSkeleton from './components/PageLoadingSkeleton.jsx'
import DashboardNavIcon from './components/DashboardNavIcon.jsx'

async function adminRequest(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'include', headers: { 'content-type': 'application/json', ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}

const fmt = (value) => value ? new Date(value).toLocaleString() : '—'
const display = (value) => Array.isArray(value) ? value.join(', ') : value

export default function StaffAdmin() {
  const [account, setAccount] = useState(null)
  const [loginReady, setLoginReady] = useState(false)
  const [activePage, setActivePage] = useState(() => ['overview', 'people', 'applicants', 'history', 'images', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginNotice, setLoginNotice] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [attendance, setAttendance] = useState(null)
  const [attendanceNotice, setAttendanceNotice] = useState('')
  const [attendanceError, setAttendanceError] = useState('')
  const [staff, setStaff] = useState([])
  const [interns, setInterns] = useState([])
  const [activity, setActivity] = useState({ staffActivity: [], internCheckins: [] })
  const [applications, setApplications] = useState([])
  const [workspace, setWorkspace] = useState({ recipients: [], sentMessages: [] })
  const [inviteNotice, setInviteNotice] = useState({ text: '', success: false })
  const [inviteUrl, setInviteUrl] = useState('')
  const [internNotice, setInternNotice] = useState({ text: '', success: false })
  const [passwordNotice, setPasswordNotice] = useState({ text: '', success: false })
  const [messageNotice, setMessageNotice] = useState('')
  const [recipientIds, setRecipientIds] = useState([])
  const [messageBusy, setMessageBusy] = useState(false)
  const [theme, setTheme] = useThemePreference()

  const refreshStaff = useCallback(async () => {
    const result = await adminRequest('/api/admin/staff')
    setStaff(result.staff)
  }, [])
  const refreshInterns = useCallback(async () => {
    const result = await adminRequest('/api/admin/interns')
    setInterns(result.interns)
  }, [])
  const refreshActivity = useCallback(async () => {
    const result = await adminRequest('/api/admin/activity')
    setActivity({ staffActivity: result.staffActivity, internCheckins: result.internCheckins })
  }, [])
  const refreshApplications = useCallback(async () => {
    const result = await adminRequest('/api/admin/internship-applications')
    setApplications(result.applications)
  }, [])
  const refreshWorkspace = useCallback(async () => {
    const result = await adminRequest('/api/admin/workspace/recipients')
    setWorkspace(result)
  }, [])

  useEffect(() => {
    let active = true
    authRequest('/session').then(async ({ account: current }) => {
      if (!active) return
      if (current?.accountType !== 'admin') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        clearStaffSession()
        setLoginReady(true)
        return
      }
      saveStaffSession(current)
      setAccount(current)
      setLoginReady(true)
    }).catch(() => {
      if (!active) return
      clearStaffSession()
      setLoginReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (loginReady) window.webloxDismissBrandedLoader?.()
  }, [loginReady])

  useEffect(() => {
    if (!account) return undefined
    let active = true
    const loadAll = async () => {
      const results = await Promise.allSettled([refreshStaff(), refreshActivity(), refreshInterns(), refreshApplications(), refreshWorkspace()])
      if (!active) return
      const failed = results.find((result) => result.status === 'rejected')
      if (failed) setLoginNotice(failed.reason?.message || 'Some workspace data could not be loaded.')
    }
    loadAll()
    const timer = setInterval(() => refreshApplications().catch(() => {}), 30_000)
    return () => { active = false; clearInterval(timer) }
  }, [account, refreshStaff, refreshActivity, refreshInterns, refreshApplications, refreshWorkspace])

  const showPage = (page) => {
    const next = ['overview', 'people', 'applicants', 'history', 'images', 'settings'].includes(page) ? page : 'overview'
    setActivePage(next)
    setSidebarOpen(false)
    if (location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`)
    if (next === 'applicants') refreshApplications().catch((error) => setLoginNotice(error.message))
    if (next === 'history') refreshWorkspace().catch((error) => setMessageNotice(error.message))
    if (matchMedia('(max-width: 800px)').matches) requestAnimationFrame(() => document.querySelector('.admin-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const signIn = async (event) => {
    event.preventDefault()
    setLoginBusy(true)
    setLoginNotice('')
    const form = event.currentTarget
    try {
      const { account: current } = await authRequest('/login', { method: 'POST', body: JSON.stringify({ email: form.elements.email.value.trim().toLowerCase(), password: form.elements.password.value }) })
      if (current.accountType !== 'admin') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        clearStaffSession()
        throw new Error('This login is not a staff administrator account.')
      }
      saveStaffSession(current)
      setAccount(current)
      setLoginReady(true)
      window.webloxShowBrandedLoader?.()
      location.assign('/staff-admin.html')
    } catch (error) {
      setLoginNotice(error.message || 'Could not sign in.')
    } finally {
      setLoginBusy(false)
    }
  }

  const signOut = async () => {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    location.reload()
  }

  const updateAttendance = async (action) => {
    setAttendanceError('')
    try {
      const result = await adminRequest('/api/staff/attendance', action ? { method: 'POST', body: JSON.stringify({ action }) } : {})
      setAttendance(result.attendance)
      setAttendanceNotice(action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : '')
    } catch (error) { setAttendanceError(error.message) }
  }
  useEffect(() => { if (account) updateAttendance() }, [account])

  const submitInvite = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setInviteNotice({ text: '', success: false })
    setInviteUrl('')
    try {
      const result = await adminRequest('/api/admin/staff/invitations', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })
      setInviteUrl(result.inviteUrl)
      setInviteNotice({ text: `Invitation created. It expires in ${result.expiresInHours} hours.`, success: true })
      form.reset()
      await refreshStaff()
    } catch (error) { setInviteNotice({ text: error.message || 'Could not create invitation.', success: false }) }
  }

  const updateStaffAccess = async (person) => {
    if ((person.active || !person.activated) && !confirm(`Remove ${person.name || person.email} from active staff?`)) return
    const path = person.activated ? `/api/admin/staff/${encodeURIComponent(person.id)}${person.active ? '' : '/restore'}` : `/api/admin/staff-directory/${encodeURIComponent(person.email)}`
    try {
      await adminRequest(path, { method: person.activated ? person.active ? 'DELETE' : 'POST' : 'DELETE' })
      await refreshStaff()
    } catch (error) { setLoginNotice(error.message || 'Could not update staff access.') }
  }

  const submitIntern = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await adminRequest('/api/admin/interns', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })
      form.reset()
      form.elements.role.value = 'Intern'
      setInternNotice({ text: 'Intern onboarded. Share the temporary password privately.', success: true })
      await refreshInterns()
    } catch (error) { setInternNotice({ text: error.message || 'Could not onboard intern.', success: false }) }
  }

  const updateInternAccess = async (intern) => {
    if (intern.active && !confirm(`Remove ${intern.name} from active interns?`)) return
    try {
      const path = `/api/admin/interns/${encodeURIComponent(intern.id)}${intern.active ? '' : '/restore'}`
      await adminRequest(path, { method: intern.active ? 'DELETE' : 'POST' })
      await refreshInterns()
    } catch (error) { setInternNotice({ text: error.message || 'Could not update intern access.', success: false }) }
  }

  const downloadResume = async (application) => {
    try {
      const response = await fetch(`/api/admin/internship-applications/${application.id}/resume`, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not download applicant CV.')
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = application.resume.name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) { alert(error.message) }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await authRequest('/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }) })
      form.reset()
      setPasswordNotice({ text: 'Administrator password updated.', success: true })
    } catch (error) { setPasswordNotice({ text: error.message || 'Could not update the password.', success: false }) }
  }

  const sendWorkspaceMessage = async (event) => {
    event.preventDefault()
    if (!recipientIds.length) { setMessageNotice('Select at least one recipient.'); return }
    setMessageBusy(true)
    const form = event.currentTarget
    try {
      const result = await adminRequest('/api/admin/workspace/messages', { method: 'POST', body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), recipientIds }) })
      setMessageNotice(`Sent to ${result.recipientCount} recipients.`)
      form.reset()
      setRecipientIds([])
      await refreshWorkspace()
    } catch (error) { setMessageNotice(error.message || 'Could not send the message.') }
    finally { setMessageBusy(false) }
  }

  const loadReport = async () => {
    try {
      const report = await adminRequest('/api/admin/workspace/report-preview')
      const form = document.getElementById('workspaceMessageForm')
      form.elements.type.value = 'weekly_report'
      form.elements.subject.value = report.subject
      form.elements.body.value = report.body
      setMessageNotice(report.alreadySent ? 'The scheduled report was already sent; this manual send will create another copy.' : 'Weekly report loaded.')
    } catch (error) { setMessageNotice(error.message) }
  }

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl) }
    catch { const input = document.getElementById('inviteUrl'); input?.select(); document.execCommand('copy') }
    setInviteNotice({ text: 'Invitation link copied. Send it to the staff member through a private channel.', success: true })
  }

  const selectRecipients = (type) => setRecipientIds(type === 'none' ? [] : workspace.recipients.filter((person) => type === 'all' || person.accountType === type).map((person) => person.id))
  const toggleRecipient = (id) => setRecipientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  if (!loginReady && !account) return <PageLoadingSkeleton label="Loading staff administration" />

  return (
    <main className="admin-shell">
      <header className="admin-head"><ThemeAwareLogo /><div><span className="eyebrow">WEBLOX · STAFF ACCESS</span><h1 className="admin-title">Staff administrator</h1><p>Invite staff and manage account access.</p></div>{account && <div className="admin-actions"><button className="button secondary" type="button" onClick={signOut}>Sign out</button></div>}</header>
      {!account ? <section className="admin-card"><h2>Administrator sign in</h2><p>Use the administrator account created by the local bootstrap command.</p><form className="admin-form" onSubmit={signIn}><label className="wide">Email address<input name="email" type="email" autoComplete="username" required /></label><label className="wide">Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button wide" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button></form>{loginNotice && <div className="admin-notice" role="alert">{loginNotice}</div>}</section> : <div className="admin-layout">
        <aside className={`admin-sidebar${sidebarOpen ? ' is-open' : ''}`}>
          <button className="dashboard-sidebar-toggle" type="button" aria-expanded={sidebarOpen} aria-controls="staffAdminSidebarContent" onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? 'Hide dashboard menu' : 'Show dashboard menu'}<span aria-hidden="true">{sidebarOpen ? '−' : '+'}</span></button>
          <div className="dashboard-sidebar-content" id="staffAdminSidebarContent"><div className="admin-profile"><span className="eyebrow">SIGNED IN AS</span><strong>{account.name || 'Administrator'}</strong><small>{account.email}</small></div>
          <nav aria-label="Staff admin navigation">{[['overview', 'Overview'], ['people', 'People'], ['applicants', 'Applicants'], ['history', 'History'], ['images', 'Image library'], ['settings', 'Settings']].map(([page, label]) => <a key={page} href={`#${page}`} className={activePage === page ? 'active' : ''} aria-current={activePage === page ? 'page' : undefined} onClick={(event) => { event.preventDefault(); showPage(page) }}><DashboardNavIcon name={page} />{label}</a>)}</nav>
          <section aria-label="Attendance"><span className="eyebrow">TODAY’S ATTENDANCE</span><p className="admin-notice">{attendance ? `In: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : '—'} · Out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : '—'}` : attendanceError || 'Loading attendance…'}</p><div className="admin-clock"><button className="button" type="button" onClick={() => updateAttendance('clock_in')}>Clock in</button><button className="button secondary" type="button" onClick={() => updateAttendance('clock_out')}>Clock out</button></div>{attendanceNotice && <p className="admin-notice success" role="status">{attendanceNotice}</p>}{attendanceError && <p className="admin-notice" role="alert">{attendanceError}</p>}</section>
          </div>
        </aside>
        <div className="admin-main">
          {activePage === 'overview' && <section className="admin-page-section"><section className="admin-card"><span className="eyebrow">OVERVIEW</span><h2>Workspace overview</h2><p>Use the sidebar to review applicants, manage people, view message history, and update your account settings.</p><div className="admin-summary-grid"><article><b>{staff.filter((person) => person.activated && person.active).length}</b><span>Active staff</span></article><article><b>{interns.filter((person) => person.active).length}</b><span>Active interns</span></article><article><b>{applications.length}</b><span>Applications</span></article></div></section></section>}

          {activePage === 'people' && <section className="admin-page-section">
            <section className="admin-card"><span className="eyebrow">NEW STAFF MEMBER</span><h2>Send an account invitation</h2><p>Invitations expire after 48 hours and can only activate one account. Copy the link and send it to the staff member through your usual private channel.</p><form className="admin-form" onSubmit={submitInvite}><label>Full name<input name="name" maxLength="120" required autoComplete="name" /></label><label>Work email<input name="email" type="email" maxLength="254" required autoComplete="email" /></label><label>Job role<select name="role" required defaultValue=""><option value="">Select a role</option>{['Studio Manager', 'Software Engineer', 'Cyber Security Engineer', 'Product Designer', 'Digital Marketer', 'Business Operations', 'People & Culture', 'Finance', 'Other'].map((role) => <option key={role}>{role}</option>)}</select></label><label>Gender<select name="gender" defaultValue=""><option value="">Select gender</option><option>Male</option><option>Female</option></select></label><label>Job type<select name="jobType" required><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label><button className="button" type="submit">Create invitation</button></form><div className={`admin-notice${inviteNotice.success ? ' success' : ''}`} role="status">{inviteNotice.text}</div>{inviteUrl && <div className="admin-invite-result"><input id="inviteUrl" readOnly value={inviteUrl} aria-label="Staff invitation link" /><button className="button secondary" type="button" onClick={copyInvite}>Copy link</button></div>}</section>
            <section className="admin-card"><span className="eyebrow">STAFF DIRECTORY</span><h2>Accounts and invitations</h2><div className="admin-list">{staff.length ? staff.map((person) => <article className="admin-person" key={person.email}><div><b>{person.name || person.email}</b><small>{[person.role, person.jobType || '—', person.gender || 'Gender undisclosed', person.email, `Added ${person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '—'} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''}`].join(' · ')}</small></div><span className={`admin-state${person.activated ? '' : ' pending'}`}>{person.activated ? (person.active ? 'ACTIVE' : 'DISABLED') : person.inviteExpiresAt ? `INVITED · EXPIRES ${new Date(person.inviteExpiresAt).toLocaleDateString()}` : 'NOT ACTIVATED'}</span><button className="button secondary" type="button" onClick={() => updateStaffAccess(person)}>{person.activated ? person.active ? 'Remove' : 'Restore' : 'Remove invitation'}</button></article>) : <p>No staff accounts yet. Create an invitation to onboard the first staff member.</p>}</div></section>
            <section className="admin-card"><span className="eyebrow">INTERNSHIP PROGRAM</span><h2>Onboard an intern</h2><p>Create an intern account and share the temporary password privately.</p><form className="admin-form" onSubmit={submitIntern}><label>Full name<input name="name" maxLength="120" required /></label><label>Email address<input name="email" type="email" maxLength="254" required /></label><label>Role or program<input name="role" maxLength="80" defaultValue="Intern" required /></label><label>Gender<select name="gender" defaultValue=""><option value="">Select gender</option><option>Male</option><option>Female</option></select></label><label>Job type<select name="jobType"><option>Internship</option><option>Part-time</option><option>Full-time</option><option>Contract</option></select></label><label className="wide">Temporary password<input name="password" type="password" minLength="8" autoComplete="new-password" required /></label><button className="button" type="submit">Onboard intern</button></form><div className={`admin-notice${internNotice.success ? ' success' : ''}`} role="status">{internNotice.text}</div><div className="admin-list">{interns.length ? interns.map((intern) => <article className="admin-person" key={intern.id}><div><b>{intern.name}</b><small>{[intern.email, intern.role, intern.jobType || '—', `Added ${new Date(intern.createdAt).toLocaleDateString()} by ${intern.createdByName || 'Unknown'}${intern.createdByEmail ? ` (${intern.createdByEmail})` : ''}`, intern.active ? 'ACTIVE' : 'DISABLED'].join(' · ')}</small></div><button className="button secondary" type="button" onClick={() => updateInternAccess(intern)}>{intern.active ? 'Remove' : 'Restore'}</button></article>) : <p>No interns onboarded yet.</p>}</div></section>
          </section>}

          {activePage === 'applicants' && <section className="admin-page-section"><section className="admin-card"><span className="eyebrow">INTERNSHIP APPLICATIONS</span><h2>Applicant submissions</h2><div className="admin-list">{applications.length ? applications.map((application) => <article className="admin-person applicant-card" key={application.id}><div className="applicant-details"><b>{application.fullName}</b><small>{application.email} · {application.phone} · {application.track} · Received {new Date(application.createdAt).toLocaleString()}</small>{[['Background', application.background], ['Skills', application.skills], ['Motivation', application.motivation], ['Availability', `${application.startDate} · ${application.duration} · ${application.availability}`], ['Additional background', application.backgroundDetails], ['Contribution', application.contribution]].map(([label, value]) => value && <p key={label}>{label}: {display(value)}</p>)}<div className="applicant-links">{[['Portfolio', application.portfolioUrl], ['GitHub', application.githubUrl], ['LinkedIn', application.linkedinUrl]].filter(([, url]) => /^https?:\/\//i.test(url || '')).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}</a>)}</div>{application.resume?.name && <button className="button secondary" type="button" onClick={() => downloadResume(application)}>Download CV · {application.resume.name}</button>}</div></article>) : <p>No internship applications have been received yet.</p>}</div></section></section>}

          {activePage === 'history' && <section className="admin-page-section">
            <section className="admin-card"><span className="eyebrow">MESSAGE HISTORY</span><h2>Sent announcements and reports</h2><div className="admin-list">{workspace.sentMessages.length ? workspace.sentMessages.map((item) => <article className="admin-person" key={item.id}><div><b>{item.type === 'announcement' ? 'Announcement' : 'Weekly report'} · {item.subject}</b><small>Sent by {item.senderName} · {new Date(item.createdAt).toLocaleString()} · {item.recipientCount} recipients</small></div></article>) : <p>No announcements or reports have been sent.</p>}</div></section>
            <section className="admin-card"><span className="eyebrow">ANNOUNCEMENTS & REPORTS</span><h2>Compose a message</h2><p>Choose everyone, a whole group, or any combination of individual staff and interns.</p><form id="workspaceMessageForm" className="admin-form" onSubmit={sendWorkspaceMessage}><label>Type<select name="type"><option value="announcement">Announcement</option><option value="weekly_report">Weekly report</option></select></label><label>Subject<input name="subject" maxLength="180" required /></label><label className="wide">Message<textarea name="body" rows="6" maxLength="20000" required /></label><button className="button secondary" type="button" onClick={loadReport}>Load weekly summary</button><button className="button" type="submit" disabled={messageBusy}>{messageBusy ? 'Sending…' : 'Send to selected'}</button><fieldset className="wide workspace-recipient-fieldset"><legend>Recipients</legend><div className="recipient-actions">{[['all', 'Everyone'], ['staff', 'All staff'], ['intern', 'All interns'], ['none', 'Clear']].map(([type, label]) => <button key={type} className="button secondary" type="button" onClick={() => selectRecipients(type)}>{label}</button>)}</div><div className="recipient-groups">{[['staff', 'Staff'], ['intern', 'Interns']].map(([type, label]) => { const people = workspace.recipients.filter((person) => person.accountType === type); return <section className="recipient-group" key={type}><h3>{label} <small>{people.length}</small></h3>{people.length ? people.map((person) => <label className="recipient-option" key={person.id}><input type="checkbox" checked={recipientIds.includes(person.id)} onChange={() => toggleRecipient(person.id)} /><span>{[person.name, person.role, person.email].filter(Boolean).join(' · ')}</span></label>) : <p>No active {label.toLowerCase()} accounts.</p>}</section> })}</div></fieldset></form><p className="admin-notice" role="status">{messageNotice}</p></section>
            <section className="admin-card"><span className="eyebrow">TEAM ACTIVITY</span><h2>Staff sign-ins and attendance</h2><div className="admin-list">{activity.staffActivity.length ? activity.staffActivity.map((item, index) => <article className="admin-person" key={`${item.email}-${item.occurredAt}-${index}`}><div><b>{item.name}</b><small>{item.eventType === 'login' ? `${item.email} · Signed in ${new Date(item.occurredAt).toLocaleString()}` : `${item.email} · ${item.attendanceDate} · In ${item.clockInAt ? new Date(item.clockInAt).toLocaleTimeString() : '—'} · Out ${item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '—'}`}</small></div></article>) : <p>No staff activity recorded yet.</p>}</div></section>
            <section className="admin-card"><span className="eyebrow">INTERN PROGRAM</span><h2>Intern check-ins</h2><div className="admin-list">{activity.internCheckins.length ? activity.internCheckins.map((item, index) => <article className="admin-person" key={`${item.email}-${item.date}-${index}`}><div><b>{item.name}</b><small>{item.email} · {item.date || 'No check-ins'} · Morning: {item.morning || '—'} · Evening: {item.evening || '—'}</small></div></article>) : <p>No onboarded interns or check-ins yet.</p>}</div></section>
          </section>}

          {activePage === 'images' && <section className="admin-page-section"><ImageLibrary /></section>}
          {activePage === 'settings' && <section className="admin-page-section"><section className="admin-card"><span className="eyebrow">APPEARANCE</span><h2>Color theme</h2><p className="theme-settings-copy">Choose how the dashboard looks. Your preference is saved for your next visit.</p><ThemeSettings theme={theme} onChange={setTheme} /></section><section className="admin-card"><span className="eyebrow">ACCOUNT SETTINGS</span><h2>Change administrator password</h2><form className="admin-form" onSubmit={changePassword}><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength="8" required /></label><button className="button" type="submit">Update password</button></form><p className={`admin-notice${passwordNotice.success ? ' success' : ''}`} role="status">{passwordNotice.text}</p></section></section>}
        </div>
      </div>}
    </main>
  )
}
