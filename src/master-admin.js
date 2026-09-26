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

function mountWorkspaceTools(container) {
  if (document.getElementById('workspaceMessageComposer')) return
  const panel = document.createElement('section')
  panel.id = 'workspaceMessageComposer'; panel.className = 'master-card'
  panel.innerHTML = '<span class="eyebrow">ANNOUNCEMENTS & REPORTS</span><h2>Compose a message</h2><p>Select the recipients. Unchecked people will not receive this message.</p><form id="workspaceMessageForm" class="master-form"><label>Message type<select name="type"><option value="announcement">Announcement</option><option value="weekly_report">Weekly report</option></select></label><label>Subject<input name="subject" maxlength="180" required></label><label class="wide">Message<textarea name="body" rows="6" maxlength="20000" required></textarea></label><div class="wide"><button id="loadReportPreview" type="button" class="button secondary">Load weekly summary</button> <button class="button" type="submit">Send to selected</button></div><fieldset class="wide" id="workspaceRecipientList"><legend>Recipients</legend><button type="button" data-select-all>Select all</button> <button type="button" data-select-none>Select none</button><div id="workspaceRecipients"></div></fieldset></form><p id="workspaceMessageNotice" class="master-notice" role="status"></p><h3>Sent messages</h3><div id="workspaceSentMessages" class="master-list"></div>'
  container.append(panel)
  const message = (text) => { document.getElementById('workspaceMessageNotice').textContent = text }
  const checkboxList = document.getElementById('workspaceRecipients')
  async function loadRecipients() {
    const data = await adminRequest('/api/admin/workspace/recipients')
    checkboxList.replaceChildren()
    for (const person of data.recipients) {
      const label = document.createElement('label'); label.style.display = 'block'
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = person.id; input.checked = true
      label.append(input, document.createTextNode(` ${person.name} · ${person.accountType} · ${person.email}`)); checkboxList.append(label)
    }
    const history = document.getElementById('workspaceSentMessages'); history.replaceChildren()
    for (const item of data.sentMessages) addRow(history, `${item.type === 'announcement' ? 'ANNOUNCEMENT' : 'WEEKLY REPORT'} · ${item.subject}`, `Sent by ${item.senderName}${item.senderEmail ? ` (${item.senderEmail})` : ''} · ${new Date(item.createdAt).toLocaleString()} · ${item.recipientCount} recipients`)
    if (!data.sentMessages.length) history.textContent = 'No messages have been sent.'
  }
  panel.querySelector('[data-select-all]').addEventListener('click', () => checkboxList.querySelectorAll('input').forEach((item) => { item.checked = true }))
  panel.querySelector('[data-select-none]').addEventListener('click', () => checkboxList.querySelectorAll('input').forEach((item) => { item.checked = false }))
  document.getElementById('loadReportPreview').addEventListener('click', async () => {
    try { const report = await adminRequest('/api/admin/workspace/report-preview'); panel.querySelector('[name="type"]').value = 'weekly_report'; panel.querySelector('[name="subject"]').value = report.subject; panel.querySelector('[name="body"]').value = report.body; message(report.alreadySent ? 'The scheduled report for this date was already sent; this manual send will create an additional copy.' : 'Weekly report loaded.') }
    catch (error) { message(error.message) }
  })
  document.getElementById('workspaceMessageForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const recipientIds = [...checkboxList.querySelectorAll('input:checked')].map((input) => input.value)
    try { const payload = Object.fromEntries(new FormData(form)); const result = await adminRequest('/api/admin/workspace/messages', { method: 'POST', body: JSON.stringify({ ...payload, recipientIds }) }); message(`Sent to ${result.recipientCount} recipients.`); await loadRecipients() }
    catch (error) { message(error.message || 'Could not send the message.') }
  })
  loadRecipients().catch((error) => message(error.message))
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
  $('masterProfileName').textContent = account.name || 'Administrator'
  $('masterProfileEmail').textContent = account.email || ''
  $('loginPanel').classList.add('hidden')
  $('adminConsole').classList.remove('hidden')
  $('masterActions').classList.remove('hidden')
  mountWorkspaceTools(document.querySelector('.master-main'))
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
    meta.textContent = `${account.email} · ${account.gender || 'Gender undisclosed'} · Added ${new Date(account.createdAt).toLocaleDateString()}`
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

let activePortfolioStaff = null
let activePortfolioRecord = null
const portfolioForm = $('adminPortfolioForm')
const portfolioLists = { project: 'adminProjectList', experience: 'adminExperienceList', education: 'adminEducationList' }

function portfolioInput(labelText, key, value = '', type = 'text', wide = false) {
  const label = document.createElement('label')
  if (wide) label.className = 'wide'
  label.append(document.createTextNode(labelText))
  const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input')
  input.dataset.key = key
  if (type === 'textarea') input.rows = 3
  else input.type = type
  if (type === 'checkbox') input.checked = value === true
  else input.value = value || ''
  label.append(input)
  return label
}

function makePortfolioCard(kind, item = {}) {
  const card = document.createElement('article')
  card.className = 'builder-card'
  card.dataset.kind = kind
  card.dataset.id = item.id || crypto.randomUUID()
  const head = document.createElement('div'); head.className = 'builder-card-head'
  const title = document.createElement('b'); title.textContent = item.title || item.qualification || `New ${kind}`
  const tools = document.createElement('div'); tools.className = 'builder-card-tools'
  for (const [action, text] of [['up', '↑'], ['down', '↓'], ['delete', 'Delete']]) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action; button.textContent = text
    tools.append(button)
  }
  head.append(title, tools)
  const fields = document.createElement('div'); fields.className = 'builder-fields'
  if (kind === 'project') fields.append(
    portfolioInput('Project title', 'title', item.title), portfolioInput('Project dates', 'dates', item.dates || [item.startDate, item.endDate].filter(Boolean).join(' – ')),
    portfolioInput('Cover image URL', 'imageUrl', item.imageUrl, 'url'), portfolioInput('Technologies and tools', 'technologies', (item.technologies || []).join(', ')),
    portfolioInput('Live demo URL', 'liveUrl', item.liveUrl, 'url'), portfolioInput('Source code URL', 'sourceUrl', item.sourceUrl, 'url'),
    portfolioInput('Description', 'description', item.description, 'textarea', true), portfolioInput('Featured project', 'featured', item.featured, 'checkbox', true),
  )
  else if (kind === 'experience') fields.append(
    portfolioInput('Position or role', 'title', item.title), portfolioInput('Organization', 'organization', item.organization),
    portfolioInput('Location', 'location', item.location), portfolioInput('Dates', 'dates', item.dates || [item.startDate, item.endDate].filter(Boolean).join(' – ')),
    portfolioInput('Description', 'description', item.description, 'textarea', true),
  )
  else fields.append(
    portfolioInput('Qualification', 'qualification', item.qualification), portfolioInput('Institution', 'institution', item.institution),
    portfolioInput('Location', 'location', item.location), portfolioInput('Dates', 'dates', item.dates || [item.startDate, item.endDate].filter(Boolean).join(' – ')),
    portfolioInput('Details', 'description', item.description, 'textarea', true),
  )
  card.append(head, fields)
  const mainInput = card.querySelector('[data-key="title"], [data-key="qualification"]')
  mainInput.addEventListener('input', () => { title.textContent = mainInput.value || `New ${kind}` })
  return card
}

function portfolioRows(kind) {
  return [...document.querySelectorAll(`#${portfolioLists[kind]} [data-kind]`)].map((card) => {
    const value = (key) => card.querySelector(`[data-key="${key}"]`)?.value.trim() || ''
    const dates = value('dates').split(/\s+[–-]\s+/)
    if (kind === 'project') return { id: card.dataset.id, title: value('title'), dates: value('dates'), startDate: dates[0] || '', endDate: dates[1] || '', imageUrl: value('imageUrl'), technologies: value('technologies').split(',').map((x) => x.trim()).filter(Boolean), liveUrl: value('liveUrl'), sourceUrl: value('sourceUrl'), description: value('description'), featured: card.querySelector('[data-key="featured"]').checked }
    if (kind === 'experience') return { id: card.dataset.id, title: value('title'), organization: value('organization'), location: value('location'), dates: value('dates'), startDate: dates[0] || '', endDate: dates[1] || '', description: value('description') }
    return { id: card.dataset.id, qualification: value('qualification'), institution: value('institution'), location: value('location'), dates: value('dates'), startDate: dates[0] || '', endDate: dates[1] || '', description: value('description') }
  })
}

function collectPortfolioDraft() {
  const draft = { name: activePortfolioStaff?.name || '', title: '', photoUrl: '', location: '', biography: '', skills: [], experience: [], education: [], socialLinks: {}, contactEmail: '', projects: [], layout: 'editorial', accentColor: '#a259ff' }
  portfolioForm.querySelectorAll('[data-field]').forEach((el) => { draft[el.dataset.field] = el.dataset.field === 'skills' ? el.value.split(',').map((x) => x.trim()).filter(Boolean) : el.value.trim() })
  draft.socialLinks = Object.fromEntries([...portfolioForm.querySelectorAll('[data-social]')].map((el) => [el.dataset.social, el.value.trim()]))
  draft.projects = portfolioRows('project'); draft.experience = portfolioRows('experience'); draft.education = portfolioRows('education')
  return draft
}

function renderPortfolioPreview(draft) {
  const root = $('adminLivePreview'); root.replaceChildren(); root.classList.toggle('cards', draft.layout === 'cards')
  root.style.setProperty('--accent', /^#[0-9a-f]{6}$/i.test(draft.accentColor) ? draft.accentColor : '#a259ff')
  const hero = document.createElement('header'); hero.className = 'live-hero'
  const avatar = draft.photoUrl ? document.createElement('img') : document.createElement('div'); avatar.className = 'live-avatar'
  if (avatar.tagName === 'IMG') { avatar.src = draft.photoUrl; avatar.alt = `${draft.name} profile` } else avatar.textContent = draft.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase() || 'W'
  const name = document.createElement('h2'); name.textContent = draft.name || 'Staff name'
  const title = document.createElement('p'); title.className = 'live-accent'; title.textContent = draft.title || 'Professional title'
  const location = document.createElement('p'); location.textContent = draft.location || ''
  hero.append(avatar, name, title, location); root.append(hero)
  const section = (label) => { const el = document.createElement('section'); el.className = 'live-section'; const h = document.createElement('h3'); h.textContent = label; el.append(h); root.append(el); return el }
  if (draft.biography) { const el = section('About'); const p = document.createElement('p'); p.textContent = draft.biography; el.append(p) }
  if (draft.skills.length) { const el = section('Skills'); const pills = document.createElement('div'); pills.className = 'live-pills'; draft.skills.forEach((skill) => { const span = document.createElement('span'); span.textContent = skill; pills.append(span) }); el.append(pills) }
  for (const [key, label, main, sub] of [['experience', 'Experience', 'title', 'organization'], ['education', 'Education', 'qualification', 'institution']]) if (draft[key].length) { const el = section(label); draft[key].forEach((item) => { const row = document.createElement('article'); row.className = 'live-project'; const h = document.createElement('b'); h.textContent = item[main] || item[sub]; const meta = document.createElement('p'); meta.textContent = [item[sub], item.dates].filter(Boolean).join(' · '); row.append(h, meta); if (item.description) { const p = document.createElement('p'); p.textContent = item.description; row.append(p) } el.append(row) }) }
  if (draft.projects.length) { const el = section('Selected projects'); draft.projects.forEach((project) => { const row = document.createElement('article'); row.className = 'live-project'; const h = document.createElement('b'); h.textContent = project.title || 'Project title'; row.append(h); if (project.imageUrl) { const img = document.createElement('img'); img.src = project.imageUrl; img.alt = `${project.title} project cover`; row.append(img) } if (project.description) { const p = document.createElement('p'); p.textContent = project.description; row.append(p) } const tech = document.createElement('p'); tech.textContent = project.technologies.join(' · '); row.append(tech); for (const [label, href] of [['Live demo ↗', project.liveUrl], ['Source ↗', project.sourceUrl]]) if (href) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label; row.append(a) } el.append(row) }) }
  const links = document.createElement('div'); links.className = 'live-section live-links'; for (const [key, label] of [['linkedin', 'LinkedIn ↗'], ['github', 'GitHub ↗'], ['website', 'Website ↗'], ['instagram', 'Instagram ↗']]) if (draft.socialLinks[key]) { const a = document.createElement('a'); a.href = draft.socialLinks[key]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label; links.append(a) } if (draft.contactEmail) { const a = document.createElement('a'); a.href = `mailto:${draft.contactEmail}`; a.textContent = 'Contact ↗'; links.append(a) } if (links.childNodes.length) root.append(links)
  const checks = [!!(draft.name && draft.title && draft.location), !!draft.biography, draft.skills.length > 0, draft.projects.length > 0, draft.experience.length > 0, draft.education.length > 0, Object.values(draft.socialLinks).some(Boolean) || !!draft.contactEmail, !!draft.photoUrl]
  const complete = Math.round(checks.filter(Boolean).length / checks.length * 100); $('adminCompletionBar').style.width = `${complete}%`; $('adminCompletionText').textContent = `${complete}% complete · ${checks.filter(Boolean).length} of ${checks.length} sections filled`
  return draft
}

function loadPortfolioDraft(draft = {}) {
  const values = { name: activePortfolioStaff.name || '', title: '', photoUrl: '', location: '', biography: '', skills: [], layout: 'editorial', accentColor: '#a259ff', contactEmail: activePortfolioStaff.email, ...draft }
  portfolioForm.querySelectorAll('[data-field]').forEach((el) => { const value = values[el.dataset.field]; el.value = Array.isArray(value) ? value.join(', ') : value || '' })
  portfolioForm.querySelectorAll('[data-social]').forEach((el) => { el.value = draft.socialLinks?.[el.dataset.social] || '' })
  for (const kind of Object.keys(portfolioLists)) { const list = $(portfolioLists[kind]); list.replaceChildren(); for (const item of draft[kind === 'project' ? 'projects' : kind] || []) list.append(makePortfolioCard(kind, item)) }
  renderPortfolioPreview(collectPortfolioDraft())
}

function showPortfolioStatus(portfolio) {
  activePortfolioRecord = portfolio
  const published = portfolio?.status === 'published' && portfolio.slug
  $('adminPortfolioStatus').textContent = portfolio?.status === 'published' ? 'Published' : portfolio?.status === 'unpublished' ? 'Unpublished' : 'Draft'
  $('adminPortfolioMeta').textContent = portfolio?.updatedAt ? `Last saved ${new Date(portfolio.updatedAt).toLocaleString()}.` : 'Private until published.'
  $('adminUnpublish').classList.toggle('hidden', !published); $('adminPublicLinkRow').classList.toggle('hidden', !published)
  if (published) $('adminPublicLink').value = `${location.origin}/portfolio.html?slug=${encodeURIComponent(portfolio.slug)}`
}

async function saveAdminPortfolio() {
  if (!activePortfolioStaff) return
  $('portfolioBuilderNotice').textContent = 'Saving…'
  try {
    const result = await adminRequest(`/api/admin/staff/${encodeURIComponent(activePortfolioStaff.id)}/portfolio`, { method: 'PUT', body: JSON.stringify(collectPortfolioDraft()) })
    showPortfolioStatus(result.portfolio); $('portfolioBuilderNotice').textContent = 'Draft saved.'; $('portfolioBuilderNotice').classList.add('success')
  } catch (error) { $('portfolioBuilderNotice').textContent = error.message || 'Could not save the portfolio.'; $('portfolioBuilderNotice').classList.remove('success'); throw error }
}

async function refreshPeopleAndActivity() {
  const [{ staff }, { interns }, activity] = await Promise.all([
    adminRequest('/api/admin/staff'), adminRequest('/api/admin/interns'), adminRequest('/api/admin/activity'),
  ])
  const staffList = $('staffList')
  const portfolioStaffSelect = $('portfolioStaffSelect')
  const selectedPortfolioStaff = portfolioStaffSelect.value
  portfolioStaffSelect.replaceChildren(new Option('Choose an active staff member', ''))
  staffList.replaceChildren()
  for (const person of staff) {
    if (person.activated && person.active) portfolioStaffSelect.add(new Option(`${person.name || person.email} · ${person.role}`, person.id))
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
        const gender = prompt('Gender (Female, Male, Non-binary, self-describe, or blank)', person.gender || '')
        if (gender === null) return
        try {
          await adminRequest(`/api/admin/staff/${encodeURIComponent(person.id)}`, {
            method: 'PUT', body: JSON.stringify({ oldEmail: person.email, name, email, role, jobType, gender }),
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
    addRow(staffList, person.name || person.email, `${person.email} · ${person.role} · ${person.jobType || '—'} · ${person.gender || 'Gender undisclosed'} · Added ${person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '—'} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''} · ${status}`, actions)
  }
  if ([...portfolioStaffSelect.options].some((option) => option.value === selectedPortfolioStaff)) portfolioStaffSelect.value = selectedPortfolioStaff
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
        const gender = prompt('Gender (Female, Male, Non-binary, self-describe, or blank)', person.gender || '')
        if (gender === null) return
        try {
          await adminRequest(`/api/admin/interns/${encodeURIComponent(person.id)}`, {
            method: 'PUT', body: JSON.stringify({ name, email, role, jobType, gender }),
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
    addRow(internList, person.name, `${person.email} · ${person.role} · ${person.jobType || '—'} · ${person.gender || 'Gender undisclosed'} · Added ${new Date(person.createdAt).toLocaleDateString()} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''} · ${person.active ? 'ACTIVE' : 'DISABLED'}`, actions)
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
  $('masterProfileName').textContent = account.name || 'Administrator'
  $('masterProfileEmail').textContent = account.email || ''
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

async function masterAttendance(action) {
  const response = await fetch('/api/staff/attendance', { method: action ? 'POST' : 'GET', credentials: 'include', headers: { 'content-type': 'application/json' }, ...(action ? { body: JSON.stringify({ action }) } : {}) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not update attendance.')
  const attendance = data.attendance
  $('masterAttendanceStatus').textContent = attendance
    ? `In: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : '—'} · Out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : '—'}`
    : 'No attendance recorded today.'
  $('masterAttendanceNotice').textContent = action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : ''
}
for (const [id, action] of [['masterClockIn', 'clock_in'], ['masterClockOut', 'clock_out']]) $(id).addEventListener('click', () => masterAttendance(action).catch((error) => { $('masterAttendanceNotice').textContent = error.message }))
masterAttendance().catch((error) => { $('masterAttendanceStatus').textContent = error.message })

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

$('portfolioSelectForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const staffId = $('portfolioStaffSelect').value
  if (!staffId) return
  const option = $('portfolioStaffSelect').selectedOptions[0]
  activePortfolioStaff = { id: staffId, name: option.textContent.split(' · ')[0], email: '' }
  $('portfolioBuilderTitle').textContent = `Portfolio · ${activePortfolioStaff.name}`
  $('portfolioBuilder').classList.remove('hidden')
  $('portfolioBuilderNotice').textContent = 'Loading portfolio…'
  try {
    const result = await adminRequest(`/api/admin/staff/${encodeURIComponent(staffId)}/portfolio`)
    showPortfolioStatus(result.portfolio)
    loadPortfolioDraft(result.portfolio?.draft || {})
    $('portfolioBuilderNotice').textContent = ''
  } catch (error) { $('portfolioBuilderNotice').textContent = error.message || 'Could not load the portfolio.' }
})

$('portfolioClose').addEventListener('click', () => $('portfolioBuilder').classList.add('hidden'))
$('adminPortfolioForm').addEventListener('input', () => renderPortfolioPreview(collectPortfolioDraft()))
$('adminPortfolioForm').addEventListener('change', () => renderPortfolioPreview(collectPortfolioDraft()))
for (const [kind, buttonId] of [['project', 'adminAddProject'], ['experience', 'adminAddExperience'], ['education', 'adminAddEducation']]) {
  $(buttonId).addEventListener('click', () => {
    $(portfolioLists[kind]).append(makePortfolioCard(kind))
    renderPortfolioPreview(collectPortfolioDraft())
  })
  $(portfolioLists[kind]).addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return
    const card = button.closest('.builder-card')
    if (button.dataset.action === 'delete') card.remove()
    else if (button.dataset.action === 'up' && card.previousElementSibling) card.parentElement.insertBefore(card, card.previousElementSibling)
    else if (button.dataset.action === 'down' && card.nextElementSibling) card.parentElement.insertBefore(card.nextElementSibling, card)
    renderPortfolioPreview(collectPortfolioDraft())
  })
}
$('portfolioSave').addEventListener('click', () => saveAdminPortfolio().catch(() => {}))
$('portfolioPreview').addEventListener('click', () => {
  if (activePortfolioRecord?.status === 'published' && activePortfolioRecord.slug) window.open(`/portfolio.html?slug=${encodeURIComponent(activePortfolioRecord.slug)}`, '_blank', 'noopener,noreferrer')
  else $('adminLivePreview').scrollIntoView({ behavior: 'smooth', block: 'start' })
})
$('portfolioPublish').addEventListener('click', async () => {
  try {
    await saveAdminPortfolio()
    const result = await adminRequest(`/api/admin/staff/${encodeURIComponent(activePortfolioStaff.id)}/portfolio/publish`, { method: 'POST', body: '{}' })
    showPortfolioStatus(result.portfolio)
    $('portfolioBuilderNotice').textContent = 'Portfolio published.'
  } catch (error) { $('portfolioBuilderNotice').textContent = error.message || 'Could not publish the portfolio.' }
})
$('adminUnpublish').addEventListener('click', async () => {
  try {
    const result = await adminRequest(`/api/admin/staff/${encodeURIComponent(activePortfolioStaff.id)}/portfolio/unpublish`, { method: 'POST', body: '{}' })
    showPortfolioStatus(result.portfolio)
    $('portfolioBuilderNotice').textContent = 'Portfolio unpublished.'
  } catch (error) { $('portfolioBuilderNotice').textContent = error.message || 'Could not unpublish the portfolio.' }
})
$('adminCopyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('adminPublicLink').value); $('portfolioBuilderNotice').textContent = 'Public link copied.' }
  catch { $('portfolioBuilderNotice').textContent = 'Could not copy the link.' }
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
