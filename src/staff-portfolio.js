import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
const form = document.querySelector('.builder-content')
const defaultPortfolio = (account) => ({
  name: account.name || '', title: '', photoUrl: '', location: '', biography: '', skills: [],
  experience: [], education: [], socialLinks: {}, contactEmail: '', projects: [],
  layout: 'editorial', accentColor: '#a259ff',
})
let account
let record = null
let savePromise = null
let saveAgain = false
let autosaveTimer

function notify(text, error = false) {
  $('saveStatus').textContent = text
  $('saveStatus').classList.toggle('error', error)
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}

function makeInput(labelText, key, value = '', type = 'text', wide = false) {
  const label = document.createElement('label')
  if (wide) label.className = 'wide'
  label.append(document.createTextNode(labelText))
  const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input')
  input.dataset.key = key
  if (type === 'textarea') input.rows = 3
  else input.type = type
  input.value = value || ''
  if (type !== 'textarea' && type !== 'checkbox') input.maxLength = key === 'description' ? 2000 : 2048
  if (type === 'checkbox') input.checked = value === true
  label.append(input)
  return label
}

function buildCard(kind, item = {}) {
  const card = document.createElement('article')
  card.className = 'builder-card'
  card.dataset.kind = kind
  const heading = kind === 'project' ? (item.title || 'New project') : kind === 'experience' ? (item.title || 'New experience') : (item.qualification || 'New education')
  const top = document.createElement('div')
  top.className = 'builder-card-head'
  const title = document.createElement('b')
  title.textContent = heading
  const tools = document.createElement('div')
  tools.className = 'builder-card-tools'
  for (const [action, text] of [['up', '↑'], ['down', '↓'], ['delete', 'Delete']]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.action = action
    button.setAttribute('aria-label', action === 'up' ? 'Move up' : action === 'down' ? 'Move down' : 'Delete item')
    button.textContent = text
    tools.append(button)
  }
  top.append(title, tools)
  const fields = document.createElement('div')
  fields.className = 'builder-fields'
  if (kind === 'project') {
    fields.append(
      makeInput('Project title', 'title', item.title),
      makeInput('Project dates', 'dates', [item.startDate, item.endDate].filter(Boolean).join(' – ')),
      makeInput('Cover image URL', 'imageUrl', item.imageUrl, 'url'),
      makeInput('Technologies and tools', 'technologies', (item.technologies || []).join(', ')),
      makeInput('Live demo URL', 'liveUrl', item.liveUrl, 'url'),
      makeInput('Source code URL', 'sourceUrl', item.sourceUrl, 'url'),
      makeInput('Description', 'description', item.description, 'textarea', true),
    )
    const featured = makeInput('Featured project', 'featured', item.featured, 'checkbox')
    featured.classList.add('wide')
    fields.append(featured)
  } else if (kind === 'experience') {
    fields.append(
      makeInput('Position or role', 'title', item.title),
      makeInput('Organization', 'organization', item.organization),
      makeInput('Location', 'location', item.location),
      makeInput('Dates', 'dates', [item.startDate, item.endDate].filter(Boolean).join(' – ')),
      makeInput('Description', 'description', item.description, 'textarea', true),
    )
  } else {
    fields.append(
      makeInput('Qualification', 'qualification', item.qualification),
      makeInput('Institution', 'institution', item.institution),
      makeInput('Location', 'location', item.location),
      makeInput('Dates', 'dates', [item.startDate, item.endDate].filter(Boolean).join(' – ')),
      makeInput('Details', 'description', item.description, 'textarea', true),
    )
  }
  card.append(top, fields)
  const titleInput = card.querySelector('[data-key="title"], [data-key="qualification"]')
  titleInput?.addEventListener('input', () => { title.textContent = titleInput.value || `New ${kind}` })
  return card
}

function rows(kind) {
  return [...document.querySelectorAll(`[data-kind="${kind}"]`)].map((card) => {
    const value = (key) => card.querySelector(`[data-key="${key}"]`)?.value.trim() || ''
    const dates = value('dates').split(/\s+[–-]\s+/)
    if (kind === 'project') return {
      id: card.dataset.id || crypto.randomUUID(), title: value('title'), dates: value('dates'),
      startDate: dates[0] || '', endDate: dates[1] || '', description: value('description'),
      imageUrl: value('imageUrl'), technologies: value('technologies').split(',').map((x) => x.trim()).filter(Boolean),
      liveUrl: value('liveUrl'), sourceUrl: value('sourceUrl'), featured: card.querySelector('[data-key="featured"]').checked,
    }
    if (kind === 'experience') return {
      id: card.dataset.id || crypto.randomUUID(), title: value('title'), organization: value('organization'),
      location: value('location'), dates: value('dates'), startDate: dates[0] || '', endDate: dates[1] || '', description: value('description'),
    }
    return {
      id: card.dataset.id || crypto.randomUUID(), qualification: value('qualification'), institution: value('institution'),
      location: value('location'), dates: value('dates'), startDate: dates[0] || '', endDate: dates[1] || '', description: value('description'),
    }
  })
}

function collectDraft() {
  const draft = defaultPortfolio(account)
  document.querySelectorAll('[data-field]').forEach((el) => {
    const key = el.dataset.field
    draft[key] = key === 'skills' ? el.value.split(',').map((x) => x.trim()).filter(Boolean) : el.value.trim()
  })
  draft.socialLinks = Object.fromEntries([...document.querySelectorAll('[data-social]')].map((el) => [el.dataset.social, el.value.trim()]))
  draft.projects = rows('project')
  draft.experience = rows('experience')
  draft.education = rows('education')
  return draft
}

function fillForm(draft) {
  document.querySelectorAll('[data-field]').forEach((el) => {
    const value = draft[el.dataset.field]
    el.value = Array.isArray(value) ? value.join(', ') : value || ''
  })
  document.querySelectorAll('[data-social]').forEach((el) => { el.value = draft.socialLinks?.[el.dataset.social] || '' })
  for (const [kind, listId, data] of [
    ['project', 'projectList', draft.projects],
    ['experience', 'experienceList', draft.experience],
    ['education', 'educationList', draft.education],
  ]) {
    const list = $(listId)
    list.replaceChildren()
    for (const item of data || []) {
      const card = buildCard(kind, item)
      card.dataset.id = item.id || crypto.randomUUID()
      list.append(card)
    }
  }
}

function addPreviewSection(container, title) {
  const section = document.createElement('section')
  section.className = 'live-section'
  const heading = document.createElement('h3')
  heading.textContent = title
  section.append(heading)
  container.append(section)
  return section
}

function addExternalLink(parent, label, href) {
  const url = safeUrl(href)
  if (!url) return
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = label
  parent.append(link)
}

function renderPreview(draft) {
  const root = $('livePreview')
  root.classList.toggle('cards', draft.layout === 'cards')
  root.style.setProperty('--accent', /^#[0-9a-f]{6}$/i.test(draft.accentColor) ? draft.accentColor : '#a259ff')
  root.replaceChildren()
  const hero = document.createElement('header')
  hero.className = 'live-hero'
  const avatar = draft.photoUrl && safeUrl(draft.photoUrl) ? document.createElement('img') : document.createElement('div')
  avatar.className = 'live-avatar'
  if (avatar.tagName === 'IMG') { avatar.src = safeUrl(draft.photoUrl); avatar.alt = `${draft.name} profile` }
  else avatar.textContent = draft.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase() || 'W'
  const name = document.createElement('h2')
  name.textContent = draft.name || 'Your name'
  const title = document.createElement('p')
  title.className = 'live-accent'
  title.textContent = draft.title || 'Professional title'
  const location = document.createElement('p')
  location.textContent = draft.location || ''
  hero.append(avatar, name, title, location)
  root.append(hero)

  if (draft.biography) {
    const about = addPreviewSection(root, 'About')
    const paragraph = document.createElement('p')
    paragraph.textContent = draft.biography
    about.append(paragraph)
  }
  if (draft.skills.length) {
    const section = addPreviewSection(root, 'Skills')
    const tags = document.createElement('div')
    tags.className = 'live-pills'
    draft.skills.forEach((skill) => { const tag = document.createElement('span'); tag.textContent = skill; tags.append(tag) })
    section.append(tags)
  }
  for (const [key, label, main, secondary] of [
    ['experience', 'Experience', 'title', 'organization'],
    ['education', 'Education', 'qualification', 'institution'],
  ]) {
    if (!draft[key].length) continue
    const section = addPreviewSection(root, label)
    draft[key].forEach((item) => {
      const entry = document.createElement('div'); entry.className = 'live-project'
      const heading = document.createElement('b'); heading.textContent = item[main] || item[secondary]
      const meta = document.createElement('p'); meta.textContent = [item[secondary], item.dates].filter(Boolean).join(' · ')
      entry.append(heading, meta)
      if (item.description) { const detail = document.createElement('p'); detail.textContent = item.description; entry.append(detail) }
      section.append(entry)
    })
  }
  if (draft.projects.length) {
    const section = addPreviewSection(root, 'Selected projects')
    draft.projects.forEach((project) => {
      const entry = document.createElement('article'); entry.className = 'live-project'
      const heading = document.createElement('b'); heading.textContent = project.title || 'Project title'
      entry.append(heading)
      const image = safeUrl(project.imageUrl)
      if (image) { const img = document.createElement('img'); img.src = image; img.alt = `${project.title} project cover`; img.loading = 'lazy'; entry.append(img) }
      if (project.description) { const detail = document.createElement('p'); detail.textContent = project.description; entry.append(detail) }
      const tech = document.createElement('p'); tech.textContent = project.technologies.join(' · '); entry.append(tech)
      addExternalLink(entry, 'Live demo ↗', project.liveUrl)
      addExternalLink(entry, 'Source ↗', project.sourceUrl)
      section.append(entry)
    })
  }
  const links = document.createElement('div'); links.className = 'live-section live-links'
  for (const [key, label] of [['linkedin', 'LinkedIn ↗'], ['github', 'GitHub ↗'], ['website', 'Website ↗'], ['instagram', 'Instagram ↗']]) addExternalLink(links, label, draft.socialLinks[key])
  if (draft.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail)) {
    const contact = document.createElement('a'); contact.href = `mailto:${draft.contactEmail}`; contact.textContent = 'Contact ↗'; links.append(contact)
  }
  if (links.childNodes.length) root.append(links)
}

function updateCompletion(draft) {
  const checks = [
    Boolean(draft.name && draft.title && draft.location), Boolean(draft.biography), draft.skills.length > 0,
    draft.projects.length > 0, draft.experience.length > 0, draft.education.length > 0,
    Object.values(draft.socialLinks).some(Boolean) || Boolean(draft.contactEmail), Boolean(draft.photoUrl),
  ]
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  $('completionBar').style.width = `${percent}%`
  $('completionText').textContent = `${percent}% complete · ${checks.filter(Boolean).length} of ${checks.length} sections filled`
}

function renderStatus() {
  const status = record?.status || 'draft'
  $('portfolioStatus').textContent = status === 'published' ? 'Published' : status === 'unpublished' ? 'Unpublished' : 'Draft'
  $('portfolioMeta').textContent = record?.updatedAt
    ? `Last saved ${new Date(record.updatedAt).toLocaleString()}. ${status === 'published' ? 'Draft edits do not change the live version until you publish again.' : status === 'unpublished' ? 'The public page is unavailable until you publish again.' : 'Private until you publish.'}`
    : 'Private until you publish.'
  const published = status === 'published' && record?.slug
  $('unpublishButton').classList.toggle('hidden', !published)
  $('publicLinkRow').classList.toggle('hidden', !published)
  if (published) $('publicLink').value = `${location.origin}/portfolio.html?slug=${encodeURIComponent(record.slug)}`
}

function refreshLive() {
  const draft = collectDraft()
  renderPreview(draft)
  updateCompletion(draft)
  return draft
}

async function saveDraft() {
  if (savePromise) { saveAgain = true; return savePromise }
  savePromise = (async () => {
    do {
      saveAgain = false
      notify('Saving…')
      const draft = collectDraft()
      try {
        const result = await staffRequest('/api/portfolios/me', { method: 'PUT', body: JSON.stringify(draft) })
        record = result.portfolio
      } catch (error) {
        notify(error.message || 'Could not save your draft.', true)
        throw error
      }
    } while (saveAgain)
    renderStatus()
    notify(`Saved ${new Date(record.updatedAt).toLocaleTimeString()}`)
    return record
  })()
  try { return await savePromise } finally { savePromise = null }
}

function scheduleSave() {
  refreshLive()
  notify('Unsaved changes')
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => saveDraft().catch(() => {}), 1000)
}

document.querySelectorAll('[data-section]').forEach((link) => link.addEventListener('click', () => {
  document.querySelectorAll('[data-section]').forEach((item) => item.classList.toggle('active', item === link))
}))

for (const [buttonId, listId, kind] of [
  ['addProject', 'projectList', 'project'],
  ['addExperience', 'experienceList', 'experience'],
  ['addEducation', 'educationList', 'education'],
]) $(buttonId).addEventListener('click', () => {
  const card = buildCard(kind)
  card.dataset.id = crypto.randomUUID()
  $(listId).append(card)
  card.querySelector('input,textarea')?.focus()
  scheduleSave()
})

form.addEventListener('input', scheduleSave)
form.addEventListener('change', scheduleSave)
for (const listId of ['projectList', 'experienceList', 'educationList']) $(listId).addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const card = button.closest('.builder-card')
  if (button.dataset.action === 'delete') {
    if (!confirm('Delete this item from your draft?')) return
    card.remove()
  } else if (button.dataset.action === 'up' && card.previousElementSibling) {
    card.parentElement.insertBefore(card, card.previousElementSibling)
  } else if (button.dataset.action === 'down' && card.nextElementSibling) {
    card.parentElement.insertBefore(card.nextElementSibling, card)
  }
  scheduleSave()
})

$('saveDraft').addEventListener('click', () => saveDraft().catch(() => {}))
$('previewButton').addEventListener('click', () => {
  if (record?.status === 'published' && record.slug) window.open(`/portfolio.html?slug=${encodeURIComponent(record.slug)}`, '_blank', 'noopener,noreferrer')
  else $('livePreview').scrollIntoView({ behavior: 'smooth', block: 'start' })
})
$('publishButton').addEventListener('click', async () => {
  try {
    await saveDraft()
    notify('Publishing…')
    const result = await staffRequest('/api/portfolios/me/publish', { method: 'POST', body: '{}' })
    record = result.portfolio
    renderStatus()
    notify('Portfolio published. Your public page is live.')
  } catch (error) { notify(error.message || 'Could not publish your portfolio.', true) }
})
$('unpublishButton').addEventListener('click', async () => {
  if (!confirm('Unpublish your portfolio? Its public page will become unavailable. Your saved draft will remain private.')) return
  try {
    const result = await staffRequest('/api/portfolios/me/unpublish', { method: 'POST', body: '{}' })
    record = result.portfolio
    renderStatus()
    notify('Portfolio unpublished. Your draft is still saved.')
  } catch (error) { notify(error.message || 'Could not unpublish your portfolio.', true) }
})
$('copyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('publicLink').value); notify('Public link copied.') }
  catch { $('publicLink').select(); document.execCommand('copy'); notify('Public link copied.') }
})

try {
  const session = await authRequest('/session')
  if (session.account.accountType !== 'staff') throw new Error('A staff session is required.')
  account = session.account
  const response = await staffRequest('/api/portfolios/me')
  record = response.portfolio
  fillForm({ ...defaultPortfolio(account), ...(record?.draft || {}) })
  refreshLive()
  renderStatus()
  if (record) notify(`Loaded ${new Date(record.updatedAt).toLocaleTimeString()}`)
  else notify('Your draft is private. Changes save automatically.')
} catch (error) {
  clearStaffSession()
  if (/sign in|session|401/i.test(error.message || '')) {
    location.replace('/staff-sign-in.html')
  } else {
    notify(error.message || 'Could not load your portfolio.', true)
  }
}
