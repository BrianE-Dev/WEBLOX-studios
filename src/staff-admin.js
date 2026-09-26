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
  $('loginPanel').classList.add('hidden')
  $('adminConsole').classList.remove('hidden')
  $('adminActions').classList.remove('hidden')
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
    meta.textContent = [person.role, person.jobType || '—', person.email, `Added ${person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '—'} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''}`].join(' · ')
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
  await Promise.all([refreshStaff(), refreshActivity(), refreshInterns()])
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

$('changePasswordButton').addEventListener('click', () => $('passwordPanel').classList.toggle('hidden'))
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
