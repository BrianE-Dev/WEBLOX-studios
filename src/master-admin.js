import { authRequest, clearStaffSession } from './lib/staffAuth.js'

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

async function startSession(account) {
  if (!showAdmin(account)) {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession()
    throw new Error('This login is not a master administrator account.')
  }
  message('loginNotice', '')
  await refreshAdmins()
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

$('logoutButton').addEventListener('click', async () => {
  await authRequest('/logout', { method: 'POST' }).catch(() => {})
  clearStaffSession()
  location.reload()
})

try {
  const { account } = await authRequest('/session')
  if (showAdmin(account)) await refreshAdmins()
} catch {
  clearStaffSession()
}
