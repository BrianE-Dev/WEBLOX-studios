import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
const session = await authRequest('/session').catch(() => null)
if (!session?.account || session.account.accountType !== 'staff') {
  clearStaffSession()
  location.replace('/staff-sign-in.html')
  throw new Error('A valid staff session is required.')
}
const staff = session.account
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'
$('staffName').textContent = staff.name.split(' ')[0]
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
document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.tab === 'portfolio') return openPortfolioBuilder()
  document.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('active', item === button))
  $('overview').classList.remove('hidden')
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
