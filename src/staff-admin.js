import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
const apiBase = import.meta.env.VITE_API_URL || ''
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'

async function adminRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
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
    row.append(copy, state)
    list.append(row)
  }
}

async function startSession(account) {
  if (!showAdmin(account)) {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    throw new Error('This login is not an administrator account.')
  }
  message('loginNotice', '')
  await refreshStaff()
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
  if (showAdmin(account)) await refreshStaff()
} catch {
  clearStaffSession()
}
