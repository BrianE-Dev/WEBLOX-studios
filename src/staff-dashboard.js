import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
const session = await authRequest('/session').catch(() => null)
if (!session?.account || session.account.accountType !== 'staff') {
  clearStaffSession()
  location.replace('/staff-sign-in.html')
  throw new Error('A valid staff session is required.')
}
const staff = session.account

const attendancePanel = $('attendanceStatus').closest('article')
if (attendancePanel) {
  attendancePanel.id = 'staffSidebar'
  attendancePanel.style.gridColumn = ''
  document.querySelector('.dash-head').after(attendancePanel)
  const layout = document.createElement('style')
  layout.textContent = '.staff-dash{display:grid;grid-template-columns:245px minmax(0,1fr);gap:20px;width:min(1280px,calc(100% - 36px))}.dash-head{grid-column:1/-1}#staffSidebar{grid-column:1;grid-row:2/6;position:sticky;top:20px;align-self:start}.dash-hero,.dash-nav,#overview,#portfolio{grid-column:2}@media(max-width:700px){.staff-dash{grid-template-columns:1fr}#staffSidebar,.dash-hero,.dash-nav,#overview,#portfolio{grid-column:1;grid-row:auto}#staffSidebar{position:static}}'
  document.head.append(layout)
}

const inboxPanel = document.createElement('article')
inboxPanel.className = 'dash-panel'
inboxPanel.innerHTML = '<span class="eyebrow">WORKSPACE INBOX</span><h2>Reports and announcements</h2><p id="inboxNotice">Loading messages…</p><div id="workspaceInbox"></div>'
document.getElementById('overview').prepend(inboxPanel)

async function loadWorkspaceInbox() {
  const response = await fetch('/api/workspace/inbox', { credentials: 'include' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not load inbox.')
  const list = document.getElementById('workspaceInbox'); list.replaceChildren()
  document.getElementById('inboxNotice').textContent = data.messages.filter((item) => !item.readAt).length ? `${data.messages.filter((item) => !item.readAt).length} unread message(s)` : 'You’re up to date.'
  for (const item of data.messages) {
    const article = document.createElement('article'); article.className = 'dash-muted'; article.style.marginTop = '10px'
    const title = document.createElement('b'); title.textContent = item.subject
    const meta = document.createElement('p'); meta.textContent = `${item.type === 'announcement' ? 'Announcement' : 'Weekly report'} · ${item.senderName} · ${new Date(item.createdAt).toLocaleString()}`
    const body = document.createElement('p'); body.style.whiteSpace = 'pre-wrap'; body.textContent = item.body
    article.append(title, meta, body)
    if (!item.readAt) { const button = document.createElement('button'); button.className = 'button secondary'; button.textContent = 'Mark as read'; button.addEventListener('click', async () => { await fetch(`/api/workspace/inbox/${encodeURIComponent(item.id)}/read`, { method: 'POST', credentials: 'include' }); await loadWorkspaceInbox() }); article.append(button) }
    list.append(article)
  }
  if (!data.messages.length) list.textContent = 'Reports and announcements will appear here.'
}
loadWorkspaceInbox().catch((error) => { document.getElementById('inboxNotice').textContent = error.message })

function renderAttendance(attendance) {
  $('attendanceStatus').textContent = attendance
    ? `Clock in: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : 'not recorded'} · Clock out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : 'not recorded'}`
    : 'No attendance recorded today.'
}

const attendanceRequest = async (action) => {
  const result = await staffRequest('/api/staff/attendance', action
    ? { method: 'POST', body: JSON.stringify({ action }) }
    : {})
  renderAttendance(result.attendance)
  $('attendanceNotice').textContent = action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : ''
}

$('clockInButton').addEventListener('click', () => attendanceRequest('clock_in').catch((error) => { $('attendanceNotice').textContent = error.message }))
$('clockOutButton').addEventListener('click', () => attendanceRequest('clock_out').catch((error) => { $('attendanceNotice').textContent = error.message }))
attendanceRequest().catch((error) => { $('attendanceStatus').textContent = error.message })
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'
$('staffName').textContent = staff.name.split(' ')[0]
$('sideProfileName').textContent = staff.name || 'Staff member'
$('sideProfileMeta').textContent = `${staff.role} · ${staff.email}`
$('profileName').textContent = staff.name
$('staffRole').textContent = staff.role.toUpperCase()
$('profileMeta').textContent = `${staff.role} · ${staff.email}`

function updateThemeButton() {
  const light = document.documentElement.dataset.theme === 'light'
  const next = light ? 'dark' : 'light'
  $('themeToggle').setAttribute('aria-label', `Switch to ${next} mode`)
  $('themeToggle').setAttribute('title', `Switch to ${next} mode`)
  $('themeToggle').querySelector('span').textContent = light ? '☀' : '◐'
}

$('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
  document.documentElement.dataset.theme = next
  localStorage.setItem('weblox-theme', next)
  updateThemeButton()
})
$('logout').addEventListener('click', async () => {
  await authRequest('/logout', { method: 'POST' }).catch(() => {})
  clearStaffSession()
  location.replace('/staff-sign-in.html')
})
updateThemeButton()

function openPortfolioBuilder() {
  location.assign('/staff-portfolio.html')
}

document.querySelector('[data-open-portfolio]').addEventListener('click', openPortfolioBuilder)
document.querySelectorAll('[data-tab], [data-side-tab]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.tab === 'portfolio') return openPortfolioBuilder()
  document.querySelectorAll('[data-tab], [data-side-tab]').forEach((item) => item.classList.toggle('active', item.dataset.tab === 'overview' || item.dataset.sideTab === 'overview'))
  $('overview').classList.remove('hidden')
  $('portfolio').classList.add('hidden')
}))

async function renderPortfolioSummary() {
  const box = $('portfolioSummary')
  try {
    const { portfolio } = await staffRequest('/api/portfolios/me')
    box.replaceChildren()
    if (!portfolio) {
      box.className = 'dash-muted'
      box.textContent = 'Your portfolio is empty. Add your profile and work to get started.'
      return
    }
    const draft = portfolio.draft || {}
    const complete = [draft.name && draft.title, draft.biography, draft.skills?.length, draft.projects?.length, draft.experience?.length, draft.education?.length]
    const progress = Math.round((complete.filter(Boolean).length / complete.length) * 100)
    box.className = 'dash-muted'
    const status = document.createElement('strong')
    status.textContent = portfolio.status === 'published' ? 'Published' : portfolio.status === 'unpublished' ? 'Unpublished' : 'Draft'
    const progressText = document.createElement('p')
    progressText.textContent = `Portfolio completion: ${progress}%`
    const updated = document.createElement('p')
    updated.textContent = `Last saved: ${new Date(portfolio.updatedAt).toLocaleString()}`
    box.append(status, progressText, updated)
    if (portfolio.status === 'published' && portfolio.slug) {
      const publicLink = document.createElement('a')
      publicLink.href = `/portfolio.html?slug=${encodeURIComponent(portfolio.slug)}`
      publicLink.target = '_blank'
      publicLink.rel = 'noopener noreferrer'
      publicLink.textContent = 'Open public portfolio →'
      publicLink.style.color = '#d1bcff'
      box.append(publicLink)
    }
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'button secondary dash-secondary'
    edit.textContent = 'Edit portfolio'
    edit.style.marginTop = '12px'
    edit.addEventListener('click', openPortfolioBuilder)
    box.append(edit)
  } catch (error) {
    box.className = 'dash-muted'
    box.textContent = error.message || 'Portfolio details are temporarily unavailable.'
  }
}

renderPortfolioSummary()
