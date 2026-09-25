const $ = (id) => document.getElementById(id)
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}

function link(parent, label, value) {
  const href = safeUrl(value)
  if (!href) return
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.textContent = label
  parent.append(anchor)
}

function renderTimeline(id, records, primary, secondary) {
  const root = $(id)
  for (const item of records || []) {
    const article = document.createElement('article')
    const heading = document.createElement('h3')
    heading.textContent = item[primary] || item[secondary] || ''
    const meta = document.createElement('small')
    meta.textContent = [item[secondary], item.location, [item.startDate, item.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')
    article.append(heading, meta)
    if (item.description) {
      const description = document.createElement('p')
      description.textContent = item.description
      article.append(description)
    }
    root.append(article)
  }
  $(id === 'experience' ? 'experienceSection' : 'educationSection').classList.toggle('hidden', !root.childElementCount)
}

function showUnavailable() {
  $('portfolioContent').classList.add('hidden')
  $('portfolioUnavailable').classList.remove('hidden')
}

async function load() {
  const slug = new URLSearchParams(location.search).get('slug')
  if (!slug || !/^[a-z0-9-]{1,180}$/i.test(slug)) return showUnavailable()
  try {
    const response = await fetch(`/api/portfolios/public/${encodeURIComponent(slug)}`, { credentials: 'omit' })
    if (!response.ok) return showUnavailable()
    const { portfolio } = await response.json()
    const p = portfolio.published
    if (!p || portfolio.slug !== slug) return showUnavailable()
    const root = $('portfolio')
    root.style.setProperty('--portfolio-accent', /^#[0-9a-f]{6}$/i.test(p.accentColor) ? p.accentColor : '#a259ff')
    root.classList.toggle('cards', p.layout === 'cards')
    $('headline').textContent = p.name || 'Portfolio'
    document.title = `${p.name || 'Staff'} | WEBLOX Studios Portfolio`
    $('professionalTitle').textContent = p.title || ''
    $('location').textContent = p.location || ''
    $('about').textContent = p.biography || ''
    $('staffName').textContent = p.name || ''
    const initials = (p.name || 'W').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    $('profileInitials').textContent = initials
    const photo = safeUrl(p.photoUrl)
    if (photo) {
      $('profilePhoto').src = photo
      $('profilePhoto').alt = `${p.name || 'Staff'} profile photo`
      $('profilePhoto').classList.remove('hidden')
      $('profileInitials').classList.add('hidden')
    }

    if (p.skills?.length) {
      p.skills.forEach((skill) => {
        const tag = document.createElement('span')
        tag.textContent = skill
        $('skills').append(tag)
      })
      $('skillsSection').classList.remove('hidden')
    }

    const projectRoot = $('projects')
    projectRoot.classList.toggle('cards', p.layout === 'cards')
    for (const project of p.projects || []) {
      const card = document.createElement('article')
      card.classList.toggle('featured', project.featured)
      const heading = document.createElement('h3')
      heading.textContent = project.title || 'Project'
      card.append(heading)
      const image = safeUrl(project.imageUrl)
      if (image) {
        const img = document.createElement('img')
        img.src = image
        img.alt = `${project.title || 'Project'} cover`
        img.loading = 'lazy'
        card.append(img)
      }
      if (project.startDate || project.endDate || project.technologies?.length) {
        const meta = document.createElement('p')
        meta.className = 'project-meta'
        meta.textContent = [[project.startDate, project.endDate].filter(Boolean).join(' – '), (project.technologies || []).join(' · ')].filter(Boolean).join(' · ')
        card.append(meta)
      }
      if (project.description) {
        const description = document.createElement('p')
        description.textContent = project.description
        card.append(description)
      }
      const links = document.createElement('div')
      links.className = 'project-links'
      link(links, 'Live demo ↗', project.liveUrl)
      link(links, 'Source code ↗', project.sourceUrl)
      if (links.childElementCount) card.append(links)
      projectRoot.append(card)
    }
    $('projectsSection').classList.toggle('hidden', !projectRoot.childElementCount)

    renderTimeline('experience', p.experience, 'title', 'organization')
    renderTimeline('education', p.education, 'qualification', 'institution')
    const social = $('socialLinks')
    for (const [key, label] of [['linkedin', 'LinkedIn ↗'], ['github', 'GitHub ↗'], ['website', 'Website ↗'], ['instagram', 'Instagram ↗']]) link(social, label, p.socialLinks?.[key])
    if (social.childElementCount) social.classList.remove('hidden')
    if (p.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contactEmail)) {
      $('contactLink').href = `mailto:${p.contactEmail}`
      $('contactLink').classList.remove('hidden')
      $('contactSection').classList.remove('hidden')
    }
    $('portfolioContent').classList.remove('hidden')
  } catch {
    showUnavailable()
  }
}

load()
