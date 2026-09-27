import { useCallback, useEffect, useState } from 'react'
import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'
import ThemeSettings, { useThemePreference } from './components/ThemeSettings.jsx'

const pages = ['overview', 'people', 'applicants', 'history', 'settings', 'portfolio']
const fmt = (value) => value ? new Date(value).toLocaleString() : '—'
const date = (value) => value ? new Date(value).toLocaleDateString() : '—'
const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

async function adminRequest(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'include', headers: { 'content-type': 'application/json', ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}

function Notice({ children, success = false }) {
  return <p className={`master-notice${success ? ' success' : ''}`} role="status">{children}</p>
}

export default function MasterAdmin() {
  const [account, setAccount] = useState(null)
  const [loginReady, setLoginReady] = useState(false)
  const [page, setPage] = useState(() => pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview')
  const [loginNotice, setLoginNotice] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [staff, setStaff] = useState([])
  const [interns, setInterns] = useState([])
  const [admins, setAdmins] = useState([])
  const [applications, setApplications] = useState([])
  const [activity, setActivity] = useState({ staffActivity: [], internCheckins: [], audit: [] })
  const [workspace, setWorkspace] = useState({ recipients: [], sentMessages: [] })
  const [attendance, setAttendance] = useState(null)
  const [attendanceNotice, setAttendanceNotice] = useState('')
  const [notice, setNotice] = useState({ text: '', success: false })
  const [messageNotice, setMessageNotice] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [messageBusy, setMessageBusy] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState('')
  const [portfolio, setPortfolio] = useState({ status: 'draft', updatedAt: null, slug: '' })
  const [projectRows, setProjectRows] = useState([])
  const [portfolioNotice, setPortfolioNotice] = useState('')
  const [theme, setTheme] = useThemePreference()
  const [portfolioBusy, setPortfolioBusy] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark' }, [])

  const refreshStaff = useCallback(async () => setStaff((await adminRequest('/api/admin/staff')).staff), [])
  const refreshInterns = useCallback(async () => setInterns((await adminRequest('/api/admin/interns')).interns), [])
  const refreshAdmins = useCallback(async () => setAdmins((await adminRequest('/api/admin/admins')).admins), [])
  const refreshApplicants = useCallback(async () => setApplications((await adminRequest('/api/admin/internship-applications')).applications), [])
  const refreshActivity = useCallback(async () => {
    const data = await adminRequest('/api/admin/activity')
    setActivity({ staffActivity: data.staffActivity || [], internCheckins: data.internCheckins || [], audit: data.audit || [] })
  }, [])
  const refreshWorkspace = useCallback(async () => setWorkspace(await adminRequest('/api/admin/workspace/recipients')), [])

  const loadMasterPortfolio = useCallback(async () => {
    const { portfolio: record } = await adminRequest('/api/admin/portfolio/me')
    const draft = record?.draft || {}
    const form = document.getElementById('masterPortfolioForm')
    if (form) {
      for (const field of form.elements) if (field.name) {
        field.value = field.name === 'skills' ? (draft.skills || []).join(', ') : field.name === 'linkedin' ? draft.socialLinks?.linkedin || '' : field.name === 'website' ? draft.socialLinks?.website || '' : draft[field.name] || ''
      }
    }
    setProjectRows((draft.projects || []).map((project) => ({ ...project, technologiesText: (project.technologies || []).join(', ') })))
    setPortfolio(record || { status: 'draft' })
  }, [])

  const loadAll = useCallback(async () => {
    const results = await Promise.allSettled([refreshStaff(), refreshInterns(), refreshAdmins(), refreshApplicants(), refreshActivity(), refreshWorkspace(), loadMasterPortfolio()])
    const error = results.find((result) => result.status === 'rejected')
    if (error) setNotice({ text: error.reason?.message || 'Some administrator data could not be loaded.', success: false })
  }, [refreshStaff, refreshInterns, refreshAdmins, refreshApplicants, refreshActivity, refreshWorkspace, loadMasterPortfolio])

  useEffect(() => {
    let active = true
    authRequest('/session').then(async ({ account: current }) => {
      if (!active) return
      if (current?.accountType !== 'master_admin') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        clearStaffSession()
        setLoginReady(true)
        return
      }
      saveStaffSession(current)
      setAccount(current)
      setLoginReady(true)
    }).catch(() => { if (active) { clearStaffSession(); setLoginReady(true) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!account) return undefined
    let active = true
    loadAll().then(() => { if (!active) return })
    adminRequest('/api/staff/attendance').then((result) => { if (active) setAttendance(result.attendance) }).catch((error) => { if (active) setAttendanceNotice(error.message) })
    const timer = setInterval(() => Promise.allSettled([refreshStaff(), refreshInterns(), refreshAdmins(), refreshApplicants(), refreshActivity()]), 30_000)
    return () => { active = false; clearInterval(timer) }
  }, [account, loadAll, refreshStaff, refreshInterns, refreshAdmins, refreshApplicants, refreshActivity])

  useEffect(() => {
    const sync = () => setPage(pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview')
    addEventListener('hashchange', sync)
    return () => removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    if (account && page === 'portfolio') loadMasterPortfolio().catch((error) => setPortfolioNotice(error.message))
  }, [account, page, loadMasterPortfolio])

  const showPage = (next) => {
    setPage(next)
    if (location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`)
    if (next === 'applicants') refreshApplicants().catch((error) => setNotice({ text: error.message, success: false }))
    if (next === 'history') refreshWorkspace().catch((error) => setMessageNotice(error.message))
  }

  const signIn = async (event) => {
    event.preventDefault(); setLoginBusy(true); setLoginNotice('')
    const form = event.currentTarget
    try {
      const { account: current } = await authRequest('/login', { method: 'POST', body: JSON.stringify({ email: form.elements.email.value.trim().toLowerCase(), password: form.elements.password.value }) })
      if (current.accountType !== 'master_admin') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        clearStaffSession()
        throw new Error('This login is not a master administrator account.')
      }
      saveStaffSession(current); setAccount(current); setLoginReady(true)
    } catch (error) { setLoginNotice(error.message || 'Could not sign in.') }
    finally { setLoginBusy(false) }
  }

  const signOut = async () => {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession(); location.reload()
  }

  const updateAttendance = async (action) => {
    try {
      const result = await adminRequest('/api/staff/attendance', action ? { method: 'POST', body: JSON.stringify({ action }) } : {})
      setAttendance(result.attendance)
      setAttendanceNotice(action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : '')
    } catch (error) { setAttendanceNotice(error.message) }
  }

  const submitForm = async (event, path, onSuccess, successText, noticeTarget = 'main') => {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await adminRequest(path, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })
      form.reset()
      if (form.elements.role && noticeTarget === 'intern') form.elements.role.value = 'Intern'
      await onSuccess?.()
      setNotice({ text: successText, success: true })
    } catch (error) { setNotice({ text: error.message || 'Request failed.', success: false }) }
  }

  const updatePerson = async (person, type, action) => {
    if (action === 'remove' && !confirm(`Remove ${person.email} from active ${type}?`)) return
    try {
      if (type === 'staff' && !person.activated) {
        if (action === 'restore') return
        await adminRequest(`/api/admin/staff-directory/${encodeURIComponent(person.email)}`, { method: 'DELETE' })
      } else {
        const path = `/api/admin/${type}/${encodeURIComponent(person.id)}${action === 'restore' ? '/restore' : ''}`
        await adminRequest(path, { method: action === 'remove' ? 'DELETE' : 'POST' })
      }
      await Promise.all([refreshStaff(), refreshInterns()])
    } catch (error) { setNotice({ text: error.message, success: false }) }
  }

  const editPerson = async (person, type) => {
    const name = prompt(`${type === 'staff' ? 'Staff member' : 'Intern'} name`, person.name || '')
    if (name === null) return
    const email = prompt('Email address', person.email || '')
    if (email === null) return
    const role = prompt(type === 'staff' ? 'Staff role' : 'Program or track', person.role || '')
    if (role === null) return
    const jobType = prompt('Job type', person.jobType || (type === 'staff' ? 'Full-time' : 'Internship'))
    if (jobType === null) return
    const gender = prompt('Gender (Male or Female)', person.gender || '')
    if (gender === null) return
    try {
      if (type === 'staff' && !person.activated) {
        await adminRequest(`/api/admin/staff-directory/${encodeURIComponent(person.email)}`, { method: 'PUT', body: JSON.stringify({ name, role, jobType }) })
      } else {
        await adminRequest(`/api/admin/${type}/${encodeURIComponent(person.id)}`, { method: 'PUT', body: JSON.stringify({ ...(type === 'staff' ? { oldEmail: person.email } : {}), name, email, role, jobType, gender }) })
      }
      await Promise.all([refreshStaff(), refreshInterns()])
    } catch (error) { setNotice({ text: error.message || 'Could not update account.', success: false }) }
  }

  const updateAdmin = async (person) => {
    if (!confirm(`Remove administrator access for ${person.email}?`)) return
    try { await adminRequest(`/api/admin/admins/${encodeURIComponent(person.id)}`, { method: 'DELETE' }); await refreshAdmins() }
    catch (error) { setNotice({ text: error.message, success: false }) }
  }

  const downloadResume = async (application) => {
    try {
      const response = await fetch(`/api/admin/internship-applications/${application.id}/resume`, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not download applicant CV.')
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = application.resume.name; anchor.click(); URL.revokeObjectURL(url)
    } catch (error) { alert(error.message) }
  }

  const selectGroup = (type) => setSelectedRecipients(type === 'none' ? [] : workspace.recipients.filter((person) => type === 'all' || person.accountType === type).map((person) => person.id))
  const toggleRecipient = (id) => setSelectedRecipients((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!selectedRecipients.length) { setMessageNotice('Select at least one recipient.'); return }
    setMessageBusy(true)
    const form = event.currentTarget
    try {
      const result = await adminRequest('/api/admin/workspace/messages', { method: 'POST', body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), recipientIds: selectedRecipients }) })
      setMessageNotice(`Sent to ${result.recipientCount} recipients.`); form.reset(); setSelectedRecipients([]); await refreshWorkspace()
    } catch (error) { setMessageNotice(error.message || 'Could not send the message.') }
    finally { setMessageBusy(false) }
  }

  const loadWeeklyReport = async () => {
    try {
      const report = await adminRequest('/api/admin/workspace/report-preview')
      const form = document.getElementById('workspaceMessageForm')
      form.elements.type.value = 'weekly_report'; form.elements.subject.value = report.subject; form.elements.body.value = report.body
      setMessageNotice(report.alreadySent ? 'The scheduled report was already sent; this manual send will create another copy.' : 'Weekly report loaded.')
    } catch (error) { setMessageNotice(error.message) }
  }

  const addProject = () => setProjectRows((rows) => [...rows, { title: '', description: '', technologiesText: '', imageUrl: '', liveUrl: '', sourceUrl: '' }])
  const updateProject = (index, key, value) => setProjectRows((rows) => rows.map((row, item) => item === index ? { ...row, [key]: value } : row))

  const savePortfolio = async (publish = false) => {
    setPortfolioBusy(true); setPortfolioNotice('')
    const form = document.getElementById('masterPortfolioForm')
    const values = Object.fromEntries(new FormData(form))
    values.skills = splitList(values.skills)
    values.socialLinks = { linkedin: values.linkedin, website: values.website }
    delete values.linkedin; delete values.website
    values.projects = projectRows.map(({ technologiesText, ...project }) => ({ ...project, technologies: splitList(technologiesText) })).filter((project) => project.title || project.description)
    try {
      let { portfolio: record } = await adminRequest('/api/admin/portfolio/me', { method: 'PUT', body: JSON.stringify(values) })
      if (publish) ({ portfolio: record } = await adminRequest('/api/admin/portfolio/me/publish', { method: 'POST', body: '{}' }))
      setPortfolio(record); setPortfolioNotice(publish ? 'Portfolio published.' : 'Draft saved.')
    } catch (error) { setPortfolioNotice(error.message || 'Could not save the portfolio.') }
    finally { setPortfolioBusy(false) }
  }

  const updatePassword = async (event) => {
    event.preventDefault(); const form = event.currentTarget
    try {
      await authRequest('/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }) })
      form.reset(); setPasswordNotice('Password updated.')
    } catch (error) { setPasswordNotice(error.message || 'Could not update the password.') }
  }

  if (!loginReady && !account) return null

  return <main className="master-shell">
    <header className="master-head"><div className="master-brand"><img src="/assets/weblox-logo.png" alt="WEBLOX Studios" /><div><span className="eyebrow">WEBLOX · ADMINISTRATION</span><h1 className="master-title">Master admin</h1><p>Manage staff, interns, and administrator accounts.</p></div></div>{account && <div className="master-actions"><span className="eyebrow">{account.email}</span><button className="button secondary" type="button" onClick={loadAll}>Refresh</button><button className="button secondary" type="button" onClick={signOut}>Sign out</button></div>}</header>
    {!account ? <section className="master-card"><h2>Administrator sign in</h2><p>Sign in with your backend administrator email and password.</p><form className="master-form" onSubmit={signIn}><label className="wide">Email address<input name="email" type="email" autoComplete="username" required /></label><label className="wide">Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button wide" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button></form><Notice>{loginNotice}</Notice></section> : <div id="masterConsole">
      <aside className="master-card master-sidebar"><span className="eyebrow">ADMIN PROFILE</span><h2>{account.name || 'Administrator'}</h2><p>{account.email}</p><nav aria-label="Master admin navigation">{[['overview', 'Overview'], ['people', 'People'], ['applicants', 'Applicants'], ['history', 'History'], ['settings', 'Settings'], ['portfolio', 'My portfolio']].map(([key, label]) => <a key={key} href={`#${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} onClick={(event) => { event.preventDefault(); showPage(key) }}>{label}</a>)}</nav><section><span className="eyebrow">TODAY’S ATTENDANCE</span><p className="master-attendance-status">{attendance ? `In: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : '—'} · Out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : '—'}` : attendanceNotice || 'Loading attendance…'}</p><div className="master-attendance"><button className="button" type="button" onClick={() => updateAttendance('clock_in')}>Clock in</button><button className="button secondary" type="button" onClick={() => updateAttendance('clock_out')}>Clock out</button></div><Notice>{attendanceNotice}</Notice></section></aside>
      <div className="master-pages">
        {page === 'overview' && <section className="master-card"><span className="eyebrow">OVERVIEW</span><h2>Master admin overview</h2><p>Review internship applicants, manage people, check sent reports, and build your portfolio.</p><div className="master-summary-grid"><article><b>{staff.filter((person) => person.activated && person.active).length}</b><span>Active staff</span></article><article><b>{interns.filter((person) => person.active).length}</b><span>Active interns</span></article><article><b>{applications.length}</b><span>Applications</span></article><article><b>{admins.length}</b><span>Administrators</span></article></div>{notice.text && <Notice success={notice.success}>{notice.text}</Notice>}</section>}

        {page === 'people' && <>
          <section className="master-card"><span className="eyebrow">ALL STAFF</span><h2>Staff accounts</h2><p>Review onboarded team members and update their directory details.</p><div className="master-list">{staff.length ? staff.map((person) => <article className="master-row" key={person.id || person.email}><div><b>{person.name || person.email}</b><small>{[person.email, person.role, person.jobType || '—', person.gender || 'Gender undisclosed', `Added ${date(person.createdAt)} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''}`, person.activated ? person.active ? 'ACTIVE' : 'DISABLED' : 'INVITATION PENDING'].join(' · ')}</small></div>{person.activated && <span className="master-state">{person.active ? 'ACTIVE' : 'DISABLED'}</span>}<button className="button secondary" type="button" onClick={() => editPerson(person, 'staff')}>Edit</button>{person.activated ? <button className={`button secondary${person.active ? ' master-danger' : ''}`} type="button" onClick={() => updatePerson(person, 'staff', person.active ? 'remove' : 'restore')}>{person.active ? 'Disable' : 'Restore access'}</button> : <button className="button secondary master-danger" type="button" onClick={() => updatePerson(person, 'staff', 'remove')}>Remove invitation</button>}</article>) : <p>No staff have been onboarded yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">INTERNSHIP PROGRAM</span><h2>Onboard an intern</h2><p>Create an intern workspace account for a future program participant. Share the temporary password privately. Intern check-ins are submitted at <a href="/intern-portal.html">the intern portal</a>.</p><form className="master-form" onSubmit={(event) => submitForm(event, '/api/admin/interns', async () => { await refreshInterns() }, 'Intern onboarded. Share the temporary password securely.')}><label>Full name<input name="name" maxLength="120" required /></label><label>Email address<input name="email" type="email" maxLength="254" required /></label><label>Program or track<input name="role" maxLength="80" defaultValue="Intern" required /></label><label>Gender<select name="gender"><option value="">Select gender</option><option>Male</option><option>Female</option></select></label><label>Job type<select name="jobType" required><option>Internship</option><option>Part-time</option><option>Full-time</option><option>Contract</option></select></label><label className="wide">Temporary password<input name="password" type="password" minLength="8" autoComplete="new-password" required /></label><button className="button" type="submit">Onboard intern</button></form>{notice.text && <Notice success={notice.success}>{notice.text}</Notice>}<div className="master-list">{interns.length ? interns.map((person) => <article className="master-row" key={person.id}><div><b>{person.name}</b><small>{[person.email, person.role, person.jobType, person.gender || 'Gender undisclosed', `Added ${date(person.createdAt)} by ${person.createdByName || 'Unknown'}`].join(' · ')}</small></div><span className="master-state">{person.active ? 'ACTIVE' : 'DISABLED'}</span><button className="button secondary" type="button" onClick={() => editPerson(person, 'intern')}>Edit</button><button className="button secondary" type="button" onClick={() => updatePerson(person, 'intern', person.active ? 'remove' : 'restore')}>{person.active ? 'Disable' : 'Restore access'}</button></article>) : <p>No interns onboarded yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">STAFF ADMINISTRATORS</span><h2>Add an administrator account</h2><p>Create a backend account directly. The password is stored as a salted hash. Share the login details securely with the administrator.</p><form className="master-form" onSubmit={(event) => submitForm(event, '/api/admin/admins', refreshAdmins, 'Administrator account created.')}><label>Full name<input name="name" maxLength="120" autoComplete="name" required /></label><label>Email address<input name="email" type="email" maxLength="254" autoComplete="email" required /></label><label className="wide">Temporary password<input name="password" type="password" minLength="8" autoComplete="new-password" required /><small>At least 8 characters. The new administrator can sign in immediately.</small></label><button className="button" type="submit">Add administrator</button></form>{notice.text && <Notice success={notice.success}>{notice.text}</Notice>}<h2>Current administrators</h2><div className="master-list">{admins.length ? admins.map((person) => <article className="master-row" key={person.id}><div><b>{person.name}</b><small>{person.email} · {person.gender || 'Gender undisclosed'} · Added {date(person.createdAt)}</small></div><span className="master-state">ADMIN</span>{!person.isCurrent && <button className="remove-admin" type="button" onClick={() => updateAdmin(person)}>Remove</button>}</article>) : <p>No administrator accounts found.</p>}</div></section>
        </>}

        {page === 'applicants' && <section className="master-card"><span className="eyebrow">INTERNSHIP APPLICANTS</span><h2>Applicant submissions</h2><div className="master-list">{applications.length ? applications.map((app) => <article className="master-row" key={app.id}><div><b>{app.fullName}</b><small>{app.email} · {app.phone} · {app.track} · Received {fmt(app.createdAt)}</small>{[['Background', app.background], ['Background details', app.backgroundDetails], ['Skills', app.skills], ['Motivation', app.motivation], ['Availability', `${app.startDate || ''} · ${app.duration || ''} · ${app.availability || ''}`], ['Contribution', app.contribution]].filter(([, value]) => value).map(([label, value]) => <small key={label}>{label}: {Array.isArray(value) ? value.join(', ') : value}</small>)}<div>{[['Portfolio', app.portfolioUrl], ['GitHub', app.githubUrl], ['LinkedIn', app.linkedinUrl]].filter(([, url]) => /^https?:\/\//i.test(url || '')).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label} </a>)}</div>{app.resume?.name && <button className="button secondary" type="button" onClick={() => downloadResume(app)}>Download CV · {app.resume.name}</button>}</div></article>) : <p>No internship applications have been received yet.</p>}</div></section>}

        {page === 'history' && <>
          <section className="master-card"><span className="eyebrow">MESSAGE HISTORY</span><h2>Sent announcements and reports</h2><div className="master-list">{workspace.sentMessages?.length ? workspace.sentMessages.map((item) => <article className="master-row" key={item.id}><div><b>{item.type === 'announcement' ? 'ANNOUNCEMENT' : 'WEEKLY REPORT'} · {item.subject}</b><small>Sent by {item.senderName}{item.senderEmail ? ` (${item.senderEmail})` : ''} · {fmt(item.createdAt)} · {item.recipientCount} recipients</small></div></article>) : <p>No messages have been sent.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">ANNOUNCEMENTS & REPORTS</span><h2>Compose a message</h2><p>Choose everyone, a whole group, or any combination of individual staff and interns.</p><form id="workspaceMessageForm" className="master-form" onSubmit={sendMessage}><label>Message type<select name="type"><option value="announcement">Announcement</option><option value="weekly_report">Weekly report</option></select></label><label>Subject<input name="subject" maxLength="180" required /></label><label className="wide">Message<textarea name="body" rows="6" maxLength="20000" required /></label><button className="button secondary" type="button" onClick={loadWeeklyReport}>Load weekly summary</button><button className="button" type="submit" disabled={messageBusy}>{messageBusy ? 'Sending…' : 'Send to selected'}</button><fieldset className="wide master-recipient-fieldset"><legend>Recipients</legend><div className="master-recipient-actions">{[['all', 'Everyone'], ['staff', 'All staff'], ['intern', 'All interns'], ['none', 'Clear']].map(([key, label]) => <button className="button secondary" key={key} type="button" onClick={() => selectGroup(key)}>{label}</button>)}</div><div className="master-recipient-groups">{[['staff', 'Staff'], ['intern', 'Interns']].map(([type, label]) => { const people = workspace.recipients.filter((person) => person.accountType === type); return <section className="master-recipient-group" key={type}><h3>{label} ({people.length})</h3>{people.length ? people.map((person) => <label className="master-recipient-option" key={person.id}><input type="checkbox" checked={selectedRecipients.includes(person.id)} onChange={() => toggleRecipient(person.id)} /><span>{[person.name, person.role, person.email].filter(Boolean).join(' · ')}</span></label>) : <p>No active {label.toLowerCase()} accounts.</p>}</section> })}</div></fieldset></form><Notice>{messageNotice}</Notice></section>
          <section className="master-card"><span className="eyebrow">STAFF SIGN-INS & ATTENDANCE</span><h2>Daily team activity</h2><div className="master-list">{activity.staffActivity.length ? activity.staffActivity.map((item, index) => <article className="master-row" key={`${item.email}-${item.occurredAt}-${index}`}><div><b>{item.name}</b><small>{item.email} · {item.eventType === 'login' ? `Signed in · ${fmt(item.occurredAt)}` : `Attendance ${item.attendanceDate}: in ${item.clockInAt ? new Date(item.clockInAt).toLocaleTimeString() : '—'}, out ${item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '—'}`}</small></div></article>) : <p>No staff login or attendance records yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">INTERN CHECK-INS</span><h2>Morning and evening updates</h2><div className="master-list">{activity.internCheckins.length ? activity.internCheckins.map((item, index) => <article className="master-row" key={`${item.email}-${item.date}-${index}`}><div><b>{item.name}</b><small>{item.email} · {item.date || 'No check-ins yet'} · Morning: {item.morning || '—'} · Evening: {item.evening || '—'}</small></div></article>) : <p>No onboarded interns or check-ins yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">ADMIN CHANGE HISTORY</span><h2>People changes by administrator</h2><div className="master-list">{activity.audit.length ? activity.audit.map((event, index) => <article className="master-row" key={`${event.id || event.createdAt}-${index}`}><div><b>{event.action.toUpperCase()} · {event.personName} ({event.personType})</b><small>{event.personEmail} · {event.role} · {event.jobType || '—'} · {fmt(event.createdAt)} · By {event.performedByName} ({event.performedByEmail || 'no email'}){event.details?.before && event.details?.after ? ` · Change: ${JSON.stringify(event.details.before)} → ${JSON.stringify(event.details.after)}` : ''}</small></div></article>) : <p>No onboarding changes have been recorded yet.</p>}</div></section>
        </>}

        {page === 'settings' && <><section className="master-card"><span className="eyebrow">APPEARANCE</span><h2>Color theme</h2><p className="theme-settings-copy">Choose how the dashboard looks. Your preference is saved for your next visit.</p><ThemeSettings theme={theme} onChange={setTheme} /></section><section className="master-card"><span className="eyebrow">ACCOUNT SETTINGS</span><h2>Master admin settings</h2><button className="button secondary" type="button" onClick={() => setPasswordOpen((open) => !open)}>Change password</button>{passwordOpen && <><form className="master-form" onSubmit={updatePassword}><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength="8" required /></label><button className="button" type="submit">Update password</button></form><Notice>{passwordNotice}</Notice></>}</section></>}

        {page === 'portfolio' && <section className="master-card"><span className="eyebrow">MASTER ADMIN PORTFOLIO</span><h2>My portfolio</h2><p>Build and publish a portfolio for your administrator account.</p><form id="masterPortfolioForm" className="master-form" onSubmit={(event) => { event.preventDefault(); savePortfolio() }}><label>Name<input name="name" required /></label><label>Professional title<input name="title" required /></label><label>Location<input name="location" /></label><label>Contact email<input name="contactEmail" type="email" /></label><label className="wide">About<textarea name="biography" rows="5" /></label><label className="wide">Skills, separated by commas<input name="skills" /></label><label>LinkedIn URL<input name="linkedin" type="url" /></label><label>Website URL<input name="website" type="url" /></label><div className="wide"><h3>Projects</h3>{projectRows.map((project, index) => <fieldset className="master-project-card" key={project.id || index}><legend>Project {index + 1}</legend><div className="master-form"><label>Project title<input value={project.title || ''} onChange={(event) => updateProject(index, 'title', event.target.value)} /></label><label>Technologies<input value={project.technologiesText || ''} onChange={(event) => updateProject(index, 'technologiesText', event.target.value)} /></label><label className="wide">Description<textarea value={project.description || ''} onChange={(event) => updateProject(index, 'description', event.target.value)} /></label><label>Cover image URL<input type="url" value={project.imageUrl || ''} onChange={(event) => updateProject(index, 'imageUrl', event.target.value)} /></label><label>Live project URL<input type="url" value={project.liveUrl || ''} onChange={(event) => updateProject(index, 'liveUrl', event.target.value)} /></label><label>Source code URL<input type="url" value={project.sourceUrl || ''} onChange={(event) => updateProject(index, 'sourceUrl', event.target.value)} /></label></div><button className="button secondary" type="button" onClick={() => setProjectRows((rows) => rows.filter((_, item) => item !== index))}>Remove project</button></fieldset>)}<button className="button secondary" type="button" onClick={addProject}>Add project</button></div><div className="wide"><button className="button" type="submit" disabled={portfolioBusy}>Save draft</button> <button className="button secondary" type="button" disabled={portfolioBusy} onClick={() => savePortfolio(true)}>Publish</button></div></form><Notice success={portfolioNotice.includes('saved') || portfolioNotice.includes('published')}>{portfolioNotice}</Notice><p>{portfolio.status === 'published' ? 'Published' : portfolio.updatedAt ? `Draft saved ${fmt(portfolio.updatedAt)}` : 'No saved draft yet.'}</p>{portfolio.status === 'published' && portfolio.slug && <a href={`/portfolio.html?slug=${encodeURIComponent(portfolio.slug)}`} target="_blank" rel="noopener noreferrer">Open published portfolio</a>}</section>}
      </div>
    </div>}
  </main>
}
