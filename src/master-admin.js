import { authRequest, clearStaffSession } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'
let refreshTimer

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
  const element = $(id)
  element.textContent = text
  element.classList.toggle('success', success)
}

function showAdmin(account) {
  if (account?.accountType !== 'master_admin') {
    $('loginPanel').classList.remove('hidden')
    $('adminConsole').classList.add('hidden')
    $('masterActions').classList.add('hidden')
    return false
  }
  $('signedInAs').textContent = account.email
  $('loginPanel').classList.add('hidden')
  $('adminConsole').classList.remove('hidden')
  $('masterActions').classList.remove('hidden')
  return true
}

async function refreshAdmins() {
  const { admins } = await adminRequest('/api/admin/admins')
  const list = $('adminList')
  list.replaceChildren()
  if (!admins.length) {
    const empty = document.createElement('p')
    empty.textContent = 'No administrator accounts found.'
    list.append(empty)
    return
  }
  for (const account of admins) {
    const row = document.createElement('div')
    row.className = 'master-row'
    const details = document.createElement('div')
    const name = document.createElement('b')
    name.textContent = account.name
    const meta = document.createElement('small')
    meta.textContent = `${account.email} · Added ${new Date(account.createdAt).toLocaleDateString()}`
    details.append(name, meta)
    const badge = document.createElement('span')
    badge.className = 'master-state'
    badge.textContent = 'ADMIN'
    row.append(details, badge)
    if (!account.isCurrent) {
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'remove-admin'
      remove.textContent = 'Remove'
      remove.addEventListener('click', async () => {
        if (!confirm(`Remove administrator access for ${account.email}?`)) return
        try {
          await adminRequest(`/api/admin/admins/${encodeURIComponent(account.id)}`, { method: 'DELETE' })
          message('adminNotice', `${account.email} was removed.`, true)
          await refreshAdmins()
        } catch (error) {
          message('adminNotice', error.message || 'Could not remove administrator.')
        }
      })
      row.append(remove)
    }
    list.append(row)
  }
}

function addRow(container, title, detail, actions = []) {
  const row = document.createElement('div')
  row.className = 'master-row'
  const copy = document.createElement('div')
  const name = document.createElement('b')
  name.textContent = title
  const meta = document.createElement('small')
  meta.textContent = detail
  copy.append(name, meta)
  row.append(copy)
  for (const action of actions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = action.danger ? 'remove-admin' : 'button secondary'
    button.textContent = action.label
    button.addEventListener('click', action.run)
    row.append(button)
  }
  container.append(row)
}

async function refreshPeopleAndActivity() {
  const [{ staff }, { interns }, activity] = await Promise.all([
    adminRequest('/api/admin/staff'), adminRequest('/api/admin/interns'), adminRequest('/api/admin/activity'),
  ])
  const staffList = $('staffList')
  staffList.replaceChildren()
  for (const person of staff) {
    const status = person.activated ? (person.active ? 'ACTIVE' : 'DISABLED') : 'INVITATION PENDING'
    const actions = []
    if (person.activated) {
      actions.push({ label: 'Edit', run: async () => {
        const name = prompt('Staff member name', person.name)
        if (name === null) return
        const email = prompt('Staff email address', person.email)
        if (email === null) return
        const role = prompt('Staff role', person.role)
        if (role === null) return
        const jobType = prompt('Job type', person.jobType || 'Full-time')
        if (jobType === null) return
        try {
          await adminRequest(`/api/admin/staff/${encodeURIComponent(person.id)}`, {
            method: 'PUT', body: JSON.stringify({ oldEmail: person.email, name, email, role, jobType }),
          })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not update staff details.') }
      } })
      if (person.active) actions.push({ label: 'Disable', danger: true, run: async () => {
        if (!confirm(`Disable staff access for ${person.email}?`)) return
        try {
          await adminRequest(`/api/admin/staff/${encodeURIComponent(person.id)}`, { method: 'DELETE' })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not disable staff account.') }
      } })
      else actions.push({ label: 'Restore access', run: async () => {
        try {
          await adminRequest(`/api/admin/staff/${encodeURIComponent(person.id)}/restore`, { method: 'POST' })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not restore staff account.') }
      } })
    }
    if (!person.activated) {
      actions.push({ label: 'Edit invitation', run: async () => {
        const name = prompt('Invited staff member name', person.name)
        if (name === null) return
        const role = prompt('Staff role', person.role)
        if (role === null) return
        const jobType = prompt('Job type', person.jobType || 'Full-time')
        if (jobType === null) return
        try {
          await adminRequest(`/api/admin/staff-directory/${encodeURIComponent(person.email)}`, { method: 'PUT', body: JSON.stringify({ name, role, jobType }) })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not update invitation.') }
      } })
      actions.push({ label: 'Remove invitation', danger: true, run: async () => {
        if (!confirm(`Remove the pending invitation for ${person.email}?`)) return
        try {
          await adminRequest(`/api/admin/staff-directory/${encodeURIComponent(person.email)}`, { method: 'DELETE' })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not remove invitation.') }
      } })
    }
    addRow(staffList, person.name || person.email, `${person.email} · ${person.role} · ${person.jobType || '—'} · Added ${person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '—'} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''} · ${status}`, actions)
  }
  if (!staff.length) staffList.textContent = 'No staff have been onboarded yet.'

  const internList = $('internList')
  internList.replaceChildren()
  for (const person of interns) {
    const actions = []
    if (person.active) {
      actions.push({ label: 'Edit', run: async () => {
        const name = prompt('Intern name', person.name)
        if (name === null) return
        const email = prompt('Intern email address', person.email)
        if (email === null) return
        const role = prompt('Program or track', person.role)
        if (role === null) return
        const jobType = prompt('Job type', person.jobType || 'Internship')
        if (jobType === null) return
        try {
          await adminRequest(`/api/admin/interns/${encodeURIComponent(person.id)}`, {
            method: 'PUT', body: JSON.stringify({ name, email, role, jobType }),
          })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not update intern details.') }
      } })
      actions.push({ label: 'Disable', danger: true, run: async () => {
        if (!confirm(`Disable intern access for ${person.email}?`)) return
        try {
          await adminRequest(`/api/admin/interns/${encodeURIComponent(person.id)}`, { method: 'DELETE' })
          await refreshPeopleAndActivity()
        } catch (error) { message('internNotice', error.message || 'Could not disable intern account.') }
      } })
    }
    else actions.push({ label: 'Restore access', run: async () => {
      try {
        await adminRequest(`/api/admin/interns/${encodeURIComponent(person.id)}/restore`, { method: 'POST' })
        await refreshPeopleAndActivity()
      } catch (error) { message('internNotice', error.message || 'Could not restore intern account.') }
    } })
    addRow(internList, person.name, `${person.email} · ${person.role} · ${person.jobType || '—'} · Added ${new Date(person.createdAt).toLocaleDateString()} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''} · ${person.active ? 'ACTIVE' : 'DISABLED'}`, actions)
  }
  if (!interns.length) internList.textContent = 'No interns onboarded yet.'

  const staffActivity = $('staffActivity')
  staffActivity.replaceChildren()
  for (const item of activity.staffActivity) {
    const description = item.eventType === 'login'
      ? `Signed in · ${new Date(item.occurredAt).toLocaleString()}`
      : `Attendance ${item.attendanceDate}: in ${item.clockInAt ? new Date(item.clockInAt).toLocaleTimeString() : '—'}, out ${item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '—'}`
    addRow(staffActivity, item.name, `${item.email} · ${description}`)
  }
  if (!activity.staffActivity.length) staffActivity.textContent = 'No staff login or attendance records yet.'

  const checkins = $('internCheckins')
  checkins.replaceChildren()
  for (const item of activity.internCheckins) {
    addRow(checkins, item.name, `${item.email} · ${item.date || 'No check-ins yet'} · Morning: ${item.morning || '—'} · Evening: ${item.evening || '—'}`)
  }
  if (!activity.internCheckins.length) checkins.textContent = 'No onboarded interns or check-ins yet.'

  const auditList = $('auditList')
  auditList.replaceChildren()
  for (const event of activity.audit) {
    const change = event.details?.before && event.details?.after
      ? ` · Change: ${JSON.stringify(event.details.before)} → ${JSON.stringify(event.details.after)}`
      : ''
    addRow(auditList, `${event.action.toUpperCase()} · ${event.personName} (${event.personType})`, `${event.personEmail} · ${event.role} · ${event.jobType || '—'} · ${new Date(event.createdAt).toLocaleString()} · By ${event.performedByName} (${event.performedByEmail || 'no email'})${change}`)
  }
  if (!activity.audit.length) auditList.textContent = 'No onboarding changes have been recorded yet.'
}

async function startSession(account) {
  if (!showAdmin(account)) {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    throw new Error('This login is not a master administrator account.')
  }
  message('loginNotice', '')
  await Promise.all([refreshAdmins(), refreshPeopleAndActivity()])
  clearInterval(refreshTimer)
  refreshTimer = setInterval(() => Promise.all([refreshAdmins(), refreshPeopleAndActivity()]).catch(() => {}), 30_000)
}

$('refreshButton').addEventListener('click', async () => {
  try {
    await Promise.all([refreshAdmins(), refreshPeopleAndActivity()])
    message('internNotice', 'Staff, intern, and audit records refreshed.', true)
  } catch (error) { message('internNotice', error.message || 'Could not refresh the dashboards.') }
})

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

$('adminForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const submit = form.querySelector('button[type="submit"]')
  submit.disabled = true
  message('adminNotice', '')
  try {
    await adminRequest('/api/admin/admins', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    })
    form.reset()
    message('adminNotice', 'Administrator account created.', true)
    await refreshAdmins()
  } catch (error) {
    message('adminNotice', error.message || 'Could not create administrator.')
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
    await adminRequest('/api/admin/interns', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })
    form.reset()
    form.elements.role.value = 'Intern'
    message('internNotice', 'Intern onboarded. Share the temporary password securely.', true)
    await refreshPeopleAndActivity()
  } catch (error) { message('internNotice', error.message || 'Could not onboard intern.') }
  finally { submit.disabled = false }
})

$('logoutButton').addEventListener('click', async () => {
  await authRequest('/logout', { method: 'POST' }).catch(() => {})
  clearStaffSession()
  location.reload()
})

try {
  const { account } = await authRequest('/session')
  await startSession(account)
} catch {
  clearStaffSession()
}
