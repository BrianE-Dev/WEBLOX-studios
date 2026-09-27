import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'

async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}

function mountWorkspaceComposer() {
  if (document.getElementById('workspaceMessageComposer')) return
  const panel = document.createElement('section'); panel.id = 'workspaceMessageComposer'; panel.className = 'admin-card'
  panel.innerHTML = '<span class="eyebrow">ANNOUNCEMENTS & REPORTS</span><h2>Compose a message</h2><p>Choose recipients individually; unchecked people will not receive it.</p><form id="workspaceMessageForm" class="admin-form"><label>Type<select name="type"><option value="announcement">Announcement</option><option value="weekly_report">Weekly report</option></select></label><label>Subject<input name="subject" maxlength="180" required></label><label class="wide">Message<textarea name="body" rows="6" maxlength="20000" required></textarea></label><button id="loadReportPreview" class="button secondary" type="button">Load weekly summary</button><button class="button" type="submit">Send to selected</button><fieldset class="wide" id="workspaceRecipientList"><legend>Recipients</legend><button type="button" data-select-all>Select all</button> <button type="button" data-select-none>Select none</button><div id="workspaceRecipients"></div></fieldset></form><p id="workspaceMessageNotice" class="admin-notice" role="status"></p>'
  ;(document.querySelector('[data-admin-view="history"]') || document.querySelector('.admin-main') || $('adminConsole')).append(panel)
  const list = document.getElementById('workspaceRecipients')
  async function loadRecipients() {
    const { recipients, sentMessages } = await adminRequest('/api/admin/workspace/recipients')
    list.replaceChildren()
    for (const person of recipients) { const label = document.createElement('label'); label.style.display = 'block'; const box = document.createElement('input'); box.type = 'checkbox'; box.value = person.id; box.checked = true; label.append(box, document.createTextNode(` ${person.name} · ${person.accountType} · ${person.email}`)); list.append(label) }
  }
  const history = document.getElementById('workspaceHistory'); history.replaceChildren(); for (const item of sentMessages) { const row = document.createElement('article'); row.className = 'admin-person'; const title = document.createElement('b'); title.textContent = `${item.type === 'announcement' ? 'Announcement' : 'Weekly report'} · ${item.subject}`; const meta = document.createElement('small'); meta.textContent = `Sent by ${item.senderName} · ${new Date(item.createdAt).toLocaleString()} · ${item.recipientCount} recipients`; row.append(title, meta); history.append(row) } if (!sentMessages.length) history.textContent = 'No announcements or reports have been sent.'
  panel.querySelector('[data-select-all]').addEventListener('click', () => list.querySelectorAll('input').forEach((box) => { box.checked = true }))
  panel.querySelector('[data-select-none]').addEventListener('click', () => list.querySelectorAll('input').forEach((box) => { box.checked = false }))
  document.getElementById('loadReportPreview').addEventListener('click', async () => { try { const report = await adminRequest('/api/admin/workspace/report-preview'); panel.querySelector('[name="type"]').value = 'weekly_report'; panel.querySelector('[name="subject"]').value = report.subject; panel.querySelector('[name="body"]').value = report.body; document.getElementById('workspaceMessageNotice').textContent = report.alreadySent ? 'The scheduled report was already sent; this manual send will create another copy.' : 'Weekly report loaded.' } catch (error) { document.getElementById('workspaceMessageNotice').textContent = error.message } })
  document.getElementById('workspaceMessageForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const payload = Object.fromEntries(new FormData(form)); const recipientIds = [...list.querySelectorAll('input:checked')].map((box) => box.value); const result = await adminRequest('/api/admin/workspace/messages', { method: 'POST', body: JSON.stringify({ ...payload, recipientIds }) }); document.getElementById('workspaceMessageNotice').textContent = `Sent to ${result.recipientCount} recipients.`; await loadRecipients() } catch (error) { document.getElementById('workspaceMessageNotice').textContent = error.message } })
  loadRecipients().catch((error) => { document.getElementById('workspaceMessageNotice').textContent = error.message })
}

function setupAdminPages() {
  const links = [...document.querySelectorAll('[data-admin-page]')]
  const views = [...document.querySelectorAll('[data-admin-view]')]
  const show = (page) => {
    views.forEach((view) => view.classList.toggle('hidden', view.dataset.adminView !== page))
    links.forEach((link) => link.classList.toggle('active', link.dataset.adminPage === page))
  }
  links.forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); show(link.dataset.adminPage) }))
  show('overview')
}

async function refreshApplicants() {
  const { applications } = await adminRequest('/api/admin/internship-applications')
  const list = $('applicantList')
  list.replaceChildren()
  if (!applications.length) { list.textContent = 'No internship applications have been received yet.'; return }
  for (const application of applications) {
    const card = document.createElement('article'); card.className = 'admin-person applicant-card'
    const details = document.createElement('div'); details.className = 'applicant-details'
    const name = document.createElement('b'); name.textContent = application.fullName
    const meta = document.createElement('small'); meta.textContent = `${application.email} · ${application.phone} · ${application.track} · Received ${new Date(application.createdAt).toLocaleString()}`
    details.append(name, meta)
    for (const [label, value] of [['Background', application.background], ['Skills', application.skills], ['Motivation', application.motivation], ['Availability', `${application.startDate} · ${application.duration} · ${application.availability}`], ['Additional background', application.backgroundDetails], ['Contribution', application.contribution]]) if (value) { const p = document.createElement('p'); p.textContent = `${label}: ${value}`; details.append(p) }
    for (const [label, value] of [['Portfolio', application.portfolioUrl], ['GitHub', application.githubUrl], ['LinkedIn', application.linkedinUrl]]) if (value && /^https?:\/\//i.test(value)) { const link = document.createElement('a'); link.href = value; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = label; details.append(link, document.createTextNode(' ')) }
    if (application.resume?.name) { const download = document.createElement('button'); download.type = 'button'; download.className = 'button secondary'; download.textContent = `Download CV · ${application.resume.name}`; download.addEventListener('click', async () => { try { const response = await fetch(`/api/admin/internship-applications/${application.id}/resume`, { credentials: 'include' }); if (!response.ok) throw new Error('Could not download applicant CV.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = application.resume.name; anchor.click(); URL.revokeObjectURL(url) } catch (error) { alert(error.message) } }); details.append(download) }
    card.append(details); list.append(card)
  }
}

function message(id, text, success = false) {
  const el = $(id)
  el.textContent = text
  el.classList.toggle('success', success)
}

function showAdmin(account) {
  if (account?.accountType !== 'admin') {
    $('loginPanel').classList.remove('hidden')
    $('adminConsole').classList.add('hidden')
    $('adminActions').classList.add('hidden')
    return false
  }
  saveStaffSession(account)
  $('adminProfileName').textContent = account.name || 'Administrator'
  $('adminProfileEmail').textContent = account.email || ''
  $('loginPanel').classList.add('hidden')
  $('adminConsole').classList.remove('hidden')
  $('adminActions').classList.remove('hidden')
  setupAdminPages()
  mountWorkspaceComposer()
  return true
}

async function refreshStaff() {
  const { staff } = await adminRequest('/api/admin/staff')
  const list = $('staffList')
  list.replaceChildren()
  if (!staff.length) {
    const empty = document.createElement('p')
    empty.textContent = 'No staff accounts yet. Create an invitation to onboard the first staff member.'
    list.append(empty)
    return
  }
  for (const person of staff) {
    const row = document.createElement('div')
    row.className = 'admin-person'
    const copy = document.createElement('div')
    const name = document.createElement('b')
    name.textContent = person.name
    const meta = document.createElement('small')
    meta.textContent = `${person.role} · ${person.email}`
    copy.append(name, meta)
    const state = document.createElement('span')
    state.className = `admin-state${person.activated ? '' : ' pending'}`
    state.textContent = person.activated
      ? 'ACTIVE'
      : person.inviteExpiresAt
        ? `INVITED · EXPIRES ${new Date(person.inviteExpiresAt).toLocaleDateString()}`
        : 'NOT ACTIVATED'
    if (person.activated) state.textContent = person.active ? 'ACTIVE' : 'DISABLED'
    meta.textContent = [person.role, person.jobType || '—', person.gender || 'Gender undisclosed', person.email, `Added ${person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '—'} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''}`].join(' · ')
    row.append(copy, state)
    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'secondary'
    action.textContent = person.activated ? (person.active ? 'Remove' : 'Restore') : 'Remove invitation'
    action.addEventListener('click', async () => {
      if (person.active || !person.activated) if (!confirm(`Remove ${person.name || person.email} from active staff?`)) return
      const path = person.activated
        ? `/api/admin/staff/${encodeURIComponent(person.id)}${person.active ? '' : '/restore'}`
        : `/api/admin/staff-directory/${encodeURIComponent(person.email)}`
      try {
        await adminRequest(path, { method: person.activated ? (person.active ? 'DELETE' : 'POST') : 'DELETE' })
        await refreshStaff()
      } catch (error) { message('loginNotice', error.message || 'Could not update staff access.') }
    })
    row.append(action)
    list.append(row)
  }
}

async function refreshActivity() {
  const { staffActivity, internCheckins } = await adminRequest('/api/admin/activity')
  const staffList = $('staffActivityList')
  staffList.replaceChildren()
  for (const item of staffActivity) {
    const row = document.createElement('div')
    row.className = 'admin-person'
    const copy = document.createElement('div')
    const name = document.createElement('b')
    name.textContent = item.name
    const detail = document.createElement('small')
    detail.textContent = item.eventType === 'login'
      ? `${item.email} · Signed in ${new Date(item.occurredAt).toLocaleString()}`
      : `${item.email} · ${item.attendanceDate} · In ${item.clockInAt ? new Date(item.clockInAt).toLocaleTimeString() : '—'} · Out ${item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '—'}`
    copy.append(name, detail)
    row.append(copy)
    staffList.append(row)
  }
  if (!staffActivity.length) staffList.textContent = 'No staff activity recorded yet.'

  const internList = $('internCheckinList')
  internList.replaceChildren()
  for (const item of internCheckins) {
    const row = document.createElement('div')
    row.className = 'admin-person'
    const copy = document.createElement('div')
    const name = document.createElement('b')
    name.textContent = item.name
    const detail = document.createElement('small')
    detail.textContent = `${item.email} · ${item.date || 'No check-ins'} · Morning: ${item.morning || '—'} · Evening: ${item.evening || '—'}`
    copy.append(name, detail)
    row.append(copy)
    internList.append(row)
  }
  if (!internCheckins.length) internList.textContent = 'No onboarded interns or check-ins yet.'
}

async function startSession(account) {
  if (!showAdmin(account)) {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    throw new Error('This login is not an administrator account.')
  }
  message('loginNotice', '')
  await Promise.all([refreshStaff(), refreshActivity(), refreshInterns(), refreshApplicants()])
}

async function refreshInterns() {
  const { interns } = await adminRequest('/api/admin/interns')
  const list = $('internList')
  list.replaceChildren()
  if (!interns.length) { list.textContent = 'No interns onboarded yet.'; return }
  for (const intern of interns) {
    const row = document.createElement('div')
    row.className = 'admin-person'
    const info = document.createElement('div')
    const title = document.createElement('b')
    title.textContent = intern.name
    const details = document.createElement('small')
    details.textContent = [intern.email, intern.role, intern.jobType || '—', `Added ${new Date(intern.createdAt).toLocaleDateString()} by ${intern.createdByName || 'Unknown'}${intern.createdByEmail ? ` (${intern.createdByEmail})` : ''}`, intern.active ? 'ACTIVE' : 'DISABLED'].join(' · ')
    info.append(title, details)
    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'secondary'
    action.textContent = intern.active ? 'Remove' : 'Restore'
    action.addEventListener('click', async () => {
      if (intern.active && !confirm(`Remove ${intern.name} from active interns?`)) return
      try {
        const path = `/api/admin/interns/${encodeURIComponent(intern.id)}${intern.active ? '' : '/restore'}`
        await adminRequest(path, { method: intern.active ? 'DELETE' : 'POST' })
        await refreshInterns()
      } catch (error) { message('internNotice', error.message || 'Could not update intern access.') }
    })
    row.append(info, action)
    list.append(row)
  }
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const submit = form.querySelector('button[type="submit"]')
  submit.disabled = true
  message('loginNotice', '')
  try {
    const { account } = await authRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.elements.email.value.trim().toLowerCase(), password: form.elements.password.value }),
    })
    await startSession(account)
  } catch (error) {
    message('loginNotice', error.message || 'Could not sign in.')
  } finally {
    submit.disabled = false
  }
})

async function adminAttendance(action) {
  const result = await fetch('/api/staff/attendance', {
    method: action ? 'POST' : 'GET', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...(action ? { body: JSON.stringify({ action }) } : {}),
  })
  const data = await result.json().catch(() => ({}))
  if (!result.ok) throw new Error(data.error || 'Could not update attendance.')
  const attendance = data.attendance
  $('adminAttendanceStatus').textContent = attendance
    ? `In: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : '—'} · Out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : '—'}`
    : 'No attendance recorded today.'
  $('adminAttendanceNotice').textContent = action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : ''
}
for (const [id, action] of [['adminClockIn', 'clock_in'], ['adminClockOut', 'clock_out']]) $(id).addEventListener('click', () => adminAttendance(action).catch((error) => { $('adminAttendanceNotice').textContent = error.message }))
adminAttendance().catch((error) => { $('adminAttendanceStatus').textContent = error.message })

$('inviteForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const values = Object.fromEntries(new FormData(form))
  message('inviteNotice', '')
  $('inviteResult').classList.add('hidden')
  const submit = form.querySelector('button[type="submit"]')
  submit.disabled = true
  try {
    const { inviteUrl, expiresInHours } = await adminRequest('/api/admin/staff/invitations', {
      method: 'POST',
      body: JSON.stringify(values),
    })
    $('inviteUrl').value = inviteUrl
    $('inviteResult').classList.remove('hidden')
    form.reset()
    message('inviteNotice', `Invitation created. It expires in ${expiresInHours} hours.`, true)
    await refreshStaff()
  } catch (error) {
    message('inviteNotice', error.message || 'Could not create invitation.')
  } finally {
    submit.disabled = false
  }
})

$('internForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const submit = form.querySelector('button[type="submit"]')
  submit.disabled = true
  message('internNotice', '')
  try {
    await adminRequest('/api/admin/interns', {
      method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))),
    })
    form.reset()
    form.elements.role.value = 'Intern'
    message('internNotice', 'Intern onboarded. Share the temporary password privately.', true)
    await refreshInterns()
  } catch (error) { message('internNotice', error.message || 'Could not onboard intern.') }
  finally { submit.disabled = false }
})

$('copyInvite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('inviteUrl').value)
    message('inviteNotice', 'Invitation link copied. Send it to the staff member through a private channel.', true)
  } catch {
    $('inviteUrl').select()
    document.execCommand('copy')
    message('inviteNotice', 'Invitation link copied. Send it to the staff member through a private channel.', true)
  }
})

$('passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  message('passwordNotice', '')
  try {
    await authRequest('/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }),
    })
    form.reset()
    message('passwordNotice', 'Administrator password updated.', true)
  } catch (error) {
    message('passwordNotice', error.message || 'Could not update the password.')
  }
})

$('logoutButton').addEventListener('click', async () => {
  await authRequest('/logout', { method: 'POST' }).catch(() => {})
  clearStaffSession()
  location.reload()
})

try {
  const { account } = await authRequest('/session')
  if (showAdmin(account)) await Promise.all([refreshStaff(), refreshActivity()])
} catch {
  clearStaffSession()
}
