import { authRequest, clearStaffSession } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'

async function checkinRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}

function showPortal(account) {
  if (account?.accountType !== 'intern') return false
  $('loginPanel').classList.add('hidden')
  $('portal').classList.remove('hidden')
  $('welcome').textContent = `${account.name} · ${account.role}`
  mountInbox()
  return true
}

function mountInbox() {
  if ($('workspaceInbox')) return
  const panel = document.createElement('section'); panel.className = 'intern-card'
  panel.innerHTML = '<span class="eyebrow">WORKSPACE INBOX</span><h2>Reports and announcements</h2><p id="inboxNotice">Loading messages…</p><div id="workspaceInbox"></div>'
  $('portal').prepend(panel)
  loadInbox().catch((error) => { $('inboxNotice').textContent = error.message })
}

async function loadInbox() {
  const data = await checkinRequest('/api/workspace/inbox')
  const list = $('workspaceInbox'); list.replaceChildren()
  const unread = data.messages.filter((item) => !item.readAt).length
  $('inboxNotice').textContent = unread ? `${unread} unread message(s)` : 'You’re up to date.'
  for (const item of data.messages) {
    const row = document.createElement('article'); row.className = 'intern-row'
    const title = document.createElement('b'); title.textContent = item.subject
    const meta = document.createElement('small'); meta.textContent = `${item.type === 'announcement' ? 'Announcement' : 'Weekly report'} · ${item.senderName} · ${new Date(item.createdAt).toLocaleString()}`
    const body = document.createElement('p'); body.style.whiteSpace = 'pre-wrap'; body.textContent = item.body
    row.append(title, meta, body)
    if (!item.readAt) { const button = document.createElement('button'); button.className = 'button secondary'; button.textContent = 'Mark as read'; button.addEventListener('click', async () => { await checkinRequest(`/api/workspace/inbox/${encodeURIComponent(item.id)}/read`, { method: 'POST' }); await loadInbox() }); row.append(button) }
    list.append(row)
  }
  if (!data.messages.length) list.textContent = 'Reports and announcements will appear here.'
}

async function loadCheckins() {
  const { checkins } = await checkinRequest('/api/intern/me/checkins')
  const today = new Date().toISOString().slice(0, 10)
  const current = checkins.find((entry) => String(entry.date).slice(0, 10) === today)
  for (const form of document.querySelectorAll('[data-slot]')) {
    const slot = form.dataset.slot
    form.elements.text.value = current?.[slot] || ''
    form.querySelector('button').textContent = current?.[slot] ? `Update ${slot} check-in` : `Submit ${slot} check-in`
  }
  const history = $('history')
  history.replaceChildren()
  for (const entry of checkins) {
    const row = document.createElement('article')
    row.className = 'intern-row'
    const date = document.createElement('small')
    date.textContent = String(entry.date).slice(0, 10)
    const morning = document.createElement('div')
    morning.textContent = `Morning: ${entry.morning || 'Not submitted'}`
    const evening = document.createElement('div')
    evening.textContent = `Evening: ${entry.evening || 'Not submitted'}`
    row.append(date, morning, evening)
    history.append(row)
  }
  if (!checkins.length) history.textContent = 'Your submitted check-ins will appear here.'
}

for (const form of document.querySelectorAll('[data-slot]')) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submit = form.querySelector('button')
    submit.disabled = true
    try {
      await checkinRequest('/api/intern/me/checkins', {
        method: 'POST',
        body: JSON.stringify({ slot: form.dataset.slot, text: form.elements.text.value }),
      })
      $('portalNotice').textContent = `${form.dataset.slot} check-in saved.`
      await loadCheckins()
    } catch (error) { $('portalNotice').textContent = error.message }
    finally { submit.disabled = false }
  })
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  try {
    const { account } = await authRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.elements.email.value.trim().toLowerCase(), password: form.elements.password.value }),
    })
    if (!showPortal(account)) {
      await authRequest('/logout', { method: 'POST' }).catch(() => {})
      throw new Error('This account is not an intern account.')
    }
    await loadCheckins()
  } catch (error) { $('loginNotice').textContent = error.message }
})

$('logoutButton').addEventListener('click', async () => {
  await authRequest('/logout', { method: 'POST' }).catch(() => {})
  clearStaffSession()
  location.reload()
})

try {
  const { account } = await authRequest('/session')
  if (showPortal(account)) await loadCheckins()
} catch { clearStaffSession() }
