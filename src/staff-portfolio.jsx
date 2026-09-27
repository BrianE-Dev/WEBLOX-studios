import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { authRequest, clearStaffSession, staffRequest } from './lib/staffAuth.js'

const defaultPortfolio = (account) => ({
  name: account?.name || '', title: '', photoUrl: '', location: '', biography: '', skills: [],
  experience: [], education: [], socialLinks: {}, contactEmail: '', projects: [],
  layout: 'editorial', accentColor: '#a259ff',
})

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function normalizeItems(items = []) {
  return items.map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    dates: item.dates || [item.startDate, item.endDate].filter(Boolean).join(' – '),
    technologies: Array.isArray(item.technologies) ? item.technologies : [],
  }))
}

function makeDraft(account, saved = {}) {
  const base = defaultPortfolio(account)
  return {
    ...base,
    ...saved,
    skills: Array.isArray(saved.skills) ? saved.skills : [],
    socialLinks: { ...base.socialLinks, ...(saved.socialLinks || {}) },
    projects: normalizeItems(saved.projects),
    experience: normalizeItems(saved.experience),
    education: normalizeItems(saved.education),
  }
}

function ExternalLink({ href, children }) {
  const url = safeUrl(href)
  return url ? <a href={url} target="_blank" rel="noopener noreferrer">{children}</a> : null
}

function EntryCard({ kind, item, onChange, onMove, onDelete, first, last }) {
  const isProject = kind === 'project'
  const isExperience = kind === 'experience'
  const fields = isProject
    ? [['title', 'Project title'], ['dates', 'Project dates'], ['imageUrl', 'Cover image URL', 'url'], ['technologies', 'Technologies and tools'], ['liveUrl', 'Live demo URL', 'url'], ['sourceUrl', 'Source code URL', 'url'], ['description', 'Description', 'textarea', 'wide']]
    : isExperience
      ? [['title', 'Position or role'], ['organization', 'Organization'], ['location', 'Location'], ['dates', 'Dates'], ['description', 'Description', 'textarea', 'wide']]
      : [['qualification', 'Qualification'], ['institution', 'Institution'], ['location', 'Location'], ['dates', 'Dates'], ['description', 'Details', 'textarea', 'wide']]
  const heading = isProject ? item.title || 'New project' : isExperience ? item.title || 'New experience' : item.qualification || 'New education'

  return (
    <article className="builder-card">
      <div className="builder-card-head"><b>{heading}</b><div className="builder-card-tools">
        <button type="button" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}>↑</button>
        <button type="button" aria-label="Move down" disabled={last} onClick={() => onMove(1)}>↓</button>
        <button type="button" aria-label="Delete item" onClick={onDelete}>Delete</button>
      </div></div>
      <div className="builder-fields">
        {fields.map(([key, label, type = 'text', width]) => <label className={width || ''} key={key}>{label}{type === 'textarea'
          ? <textarea rows="3" maxLength="2000" value={item[key] || ''} onChange={(event) => onChange(key, event.target.value)} />
          : <input type={type} maxLength={key === 'dates' ? 80 : 2048} value={item[key] || ''} onChange={(event) => onChange(key, event.target.value)} />}</label>)}
        {isProject && <label className="wide builder-featured"><input type="checkbox" checked={Boolean(item.featured)} onChange={(event) => onChange('featured', event.target.checked)} /> Featured project</label>}
      </div>
    </article>
  )
}

function LivePreview({ draft }) {
  const accent = /^#[0-9a-f]{6}$/i.test(draft.accentColor || '') ? draft.accentColor : '#a259ff'
  const photo = safeUrl(draft.photoUrl)
  const initials = (draft.name || '').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'W'
  const socials = [['linkedin', 'LinkedIn ↗'], ['github', 'GitHub ↗'], ['website', 'Website ↗'], ['instagram', 'Instagram ↗']]

  return (
    <div className={`portfolio-live${draft.layout === 'cards' ? ' cards' : ''}`} style={{ '--accent': accent }}>
      <header className="live-hero">{photo ? <img className="live-avatar" src={photo} alt={`${draft.name || 'Staff'} profile`} /> : <div className="live-avatar">{initials}</div>}<h2>{draft.name || 'Your name'}</h2><p className="live-accent">{draft.title || 'Professional title'}</p>{draft.location && <p>{draft.location}</p>}</header>
      {draft.biography && <section className="live-section"><h3>About</h3><p>{draft.biography}</p></section>}
      {!!draft.skills.length && <section className="live-section"><h3>Skills</h3><div className="live-pills">{draft.skills.map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}</div></section>}
      {[[draft.experience, 'Experience', 'title', 'organization'], [draft.education, 'Education', 'qualification', 'institution']].map(([entries, title, main, secondary]) => entries.length > 0 && <section className="live-section" key={title}><h3>{title}</h3>{entries.map((entry) => <article className="live-project" key={entry.id}><b>{entry[main] || entry[secondary]}</b><p>{[entry[secondary], entry.dates].filter(Boolean).join(' · ')}</p>{entry.description && <p>{entry.description}</p>}</article>)}</section>)}
      {!!draft.projects.length && <section className="live-section"><h3>Selected projects</h3>{draft.projects.map((project) => <article className="live-project" key={project.id}><b>{project.title || 'Project title'}</b>{safeUrl(project.imageUrl) && <img src={safeUrl(project.imageUrl)} alt={`${project.title || 'Project'} cover`} loading="lazy" />}{project.description && <p>{project.description}</p>}{project.technologies.length > 0 && <p>{project.technologies.join(' · ')}</p>}<div className="live-links"><ExternalLink href={project.liveUrl}>Live demo ↗</ExternalLink><ExternalLink href={project.sourceUrl}>Source ↗</ExternalLink></div></article>)}</section>}
      <div className="live-section live-links">{socials.map(([key, label]) => <ExternalLink href={draft.socialLinks[key]} key={key}>{label}</ExternalLink>)}{draft.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail) && <a href={`mailto:${draft.contactEmail}`}>Contact ↗</a>}</div>
    </div>
  )
}

function StaffPortfolioBuilder() {
  const [account, setAccount] = useState(null)
  const [draft, setDraft] = useState(() => defaultPortfolio(null))
  const [record, setRecord] = useState(null)
  const [ready, setReady] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')
  const draftRef = useRef(draft)
  const recordRef = useRef(record)
  const saveInFlight = useRef(null)
  const pendingSave = useRef(false)
  const autosaveTimer = useRef(null)

  const notify = (text, error = false) => {
    setNotice(text)
    setNoticeError(error)
  }

  const replaceDraft = (next) => {
    draftRef.current = next
    setDraft(next)
    setDirty(true)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'
    let active = true
    async function load() {
      try {
        const session = await authRequest('/session')
        if (session.account.accountType !== 'staff') throw new Error('A staff session is required.')
        const response = await staffRequest('/api/portfolios/me')
        if (!active) return
        const nextDraft = makeDraft(session.account, response.portfolio?.draft || {})
        setAccount(session.account)
        setRecord(response.portfolio)
        recordRef.current = response.portfolio
        draftRef.current = nextDraft
        setDraft(nextDraft)
        setReady(true)
        notify(response.portfolio ? `Loaded ${new Date(response.portfolio.updatedAt).toLocaleTimeString()}` : 'Your draft is private. Changes save automatically.')
      } catch (error) {
        clearStaffSession()
        if (/sign in|session|401/i.test(error.message || '')) location.replace('/staff-sign-in.html')
        else notify(error.message || 'Could not load your portfolio.', true)
      }
    }
    load()
    return () => { active = false; clearTimeout(autosaveTimer.current) }
  }, [])

  const saveDraft = useCallback(async () => {
    if (!ready || !account) return null
    if (saveInFlight.current) {
      pendingSave.current = true
      return saveInFlight.current
    }
    const running = (async () => {
      try {
        do {
          pendingSave.current = false
          const snapshot = draftRef.current
          const serialized = JSON.stringify(snapshot)
          notify('Saving…')
          const result = await staffRequest('/api/portfolios/me', { method: 'PUT', body: serialized })
          setRecord(result.portfolio)
          recordRef.current = result.portfolio
          if (draftRef.current !== snapshot) pendingSave.current = true
        } while (pendingSave.current)
        setDirty(false)
        const saved = recordRef.current
        notify(`Saved ${new Date(saved.updatedAt).toLocaleTimeString()}`)
        return saved
      } catch (error) {
        notify(error.message || 'Could not save your draft.', true)
        throw error
      }
    })()
    saveInFlight.current = running
    try {
      return await running
    } finally {
      saveInFlight.current = null
    }
  }, [account, ready])

  useEffect(() => {
    if (!ready || !dirty) return undefined
    clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => saveDraft().catch(() => {}), 1000)
    return () => clearTimeout(autosaveTimer.current)
  }, [draft, dirty, ready, saveDraft])

  const updateField = (key, value) => {
    const nextValue = key === 'skills' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value
    replaceDraft({ ...draftRef.current, [key]: nextValue })
  }

  const updateSocial = (key, value) => replaceDraft({ ...draftRef.current, socialLinks: { ...draftRef.current.socialLinks, [key]: value } })

  const updateItem = (kind, id, key, value) => {
    const next = { ...draftRef.current, [kind]: draftRef.current[kind].map((item) => {
      if (item.id !== id) return item
      if (key === 'dates') {
        const parts = value.split(/\s+[–-]\s+/)
        return { ...item, dates: value, startDate: parts[0] || '', endDate: parts[1] || '' }
      }
      if (key === 'technologies') return { ...item, technologies: value.split(',').map((part) => part.trim()).filter(Boolean) }
      return { ...item, [key]: value }
    }) }
    replaceDraft(next)
  }

  const addItem = (kind) => {
    const item = { id: crypto.randomUUID(), dates: '', startDate: '', endDate: '', description: '', technologies: [] }
    if (kind === 'projects') Object.assign(item, { title: '', imageUrl: '', liveUrl: '', sourceUrl: '', featured: false })
    if (kind === 'experience') Object.assign(item, { title: '', organization: '', location: '' })
    if (kind === 'education') Object.assign(item, { qualification: '', institution: '', location: '' })
    replaceDraft({ ...draftRef.current, [kind]: [...draftRef.current[kind], item] })
  }

  const moveItem = (kind, id, offset) => {
    const items = [...draftRef.current[kind]]
    const index = items.findIndex((item) => item.id === id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    replaceDraft({ ...draftRef.current, [kind]: items })
  }

  const removeItem = (kind, id) => {
    if (!confirm('Delete this item from your draft?')) return
    replaceDraft({ ...draftRef.current, [kind]: draftRef.current[kind].filter((item) => item.id !== id) })
  }

  const publish = async () => {
    try {
      await saveDraft()
      notify('Publishing…')
      const result = await staffRequest('/api/portfolios/me/publish', { method: 'POST', body: '{}' })
      setRecord(result.portfolio)
      recordRef.current = result.portfolio
      notify('Portfolio published. Your public page is live.')
    } catch (error) {
      notify(error.message || 'Could not publish your portfolio.', true)
    }
  }

  const unpublish = async () => {
    if (!confirm('Unpublish your portfolio? Its public page will become unavailable. Your saved draft will remain private.')) return
    try {
      const result = await staffRequest('/api/portfolios/me/unpublish', { method: 'POST', body: '{}' })
      setRecord(result.portfolio)
      recordRef.current = result.portfolio
      notify('Portfolio unpublished. Your draft is still saved.')
    } catch (error) {
      notify(error.message || 'Could not unpublish your portfolio.', true)
    }
  }

  const copyLink = async () => {
    const url = `${location.origin}/portfolio.html?slug=${encodeURIComponent(record.slug)}`
    try { await navigator.clipboard.writeText(url) }
    catch { const input = document.getElementById('publicLink'); input?.select(); document.execCommand('copy') }
    notify('Public link copied.')
  }

  const openPreview = () => {
    if (record?.status === 'published' && record.slug) window.open(`/portfolio.html?slug=${encodeURIComponent(record.slug)}`, '_blank', 'noopener,noreferrer')
    else document.querySelector('.preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const checks = [Boolean(draft.name && draft.title && draft.location), Boolean(draft.biography), draft.skills.length > 0, draft.projects.length > 0, draft.experience.length > 0, draft.education.length > 0, Object.values(draft.socialLinks).some(Boolean) || Boolean(draft.contactEmail), Boolean(draft.photoUrl)]
  const progress = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  const status = record?.status || 'draft'
  const published = status === 'published' && record?.slug
  const sections = [['profile', 'Profile'], ['about', 'About'], ['skills', 'Skills'], ['projects', 'Projects'], ['experience', 'Experience'], ['education', 'Education'], ['links', 'Links'], ['design', 'Design']]

  if (!ready) return <main className="builder"><header className="builder-head"><div><a className="eyebrow" href="/staff-dashboard.html">← STAFF DASHBOARD</a><h1>Portfolio builder</h1></div></header><section className="builder-panel builder-loading" role={noticeError ? 'alert' : 'status'}>{notice || 'Loading your private portfolio…'}</section></main>

  return (
    <main className="builder">
      <header className="builder-head"><div><a className="eyebrow" href="/staff-dashboard.html">← STAFF DASHBOARD</a><h1>Portfolio builder</h1><p>Make a clear, polished portfolio that shows the work you do{account?.name ? `, ${account.name.split(' ')[0]}` : ''}.</p></div><div className="builder-actions"><button className="button secondary" type="button" onClick={() => saveDraft().catch(() => {})}>Save draft</button><button className="button secondary" type="button" onClick={openPreview}>Open preview</button><button className="button" type="button" onClick={publish}>Publish portfolio →</button></div></header>
      <div className="builder-layout">
        <nav className="builder-nav" aria-label="Portfolio sections">{sections.map(([id, title]) => <a key={id} className={activeSection === id ? 'active' : ''} href={`#${id}`} onClick={() => setActiveSection(id)}>{title}</a>)}</nav>
        <div className="builder-content">
          <section id="profile" className="builder-panel"><h2>Personal profile</h2><div className="builder-fields"><label>Full name<input maxLength="120" autoComplete="name" required value={draft.name} onChange={(event) => updateField('name', event.target.value)} /></label><label>Professional title<input maxLength="120" placeholder="Product designer" required value={draft.title} onChange={(event) => updateField('title', event.target.value)} /></label><label>Location<input maxLength="100" placeholder="Lagos, Nigeria" value={draft.location} onChange={(event) => updateField('location', event.target.value)} /></label><label>Profile photo URL<input type="url" placeholder="https://…" value={draft.photoUrl} onChange={(event) => updateField('photoUrl', event.target.value)} /></label></div></section>
          <section id="about" className="builder-panel"><h2>About you</h2><div className="builder-fields"><label className="wide">Professional biography<textarea rows="5" maxLength="3000" placeholder="Introduce yourself and the work you care about…" required value={draft.biography} onChange={(event) => updateField('biography', event.target.value)} /></label><label>Contact email<input type="email" maxLength="254" placeholder="hello@example.com" value={draft.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} /></label></div></section>
          <section id="skills" className="builder-panel"><h2>Skills and tools</h2><p className="builder-hint">Separate skills with commas. They appear as compact tags on your portfolio.</p><div className="builder-fields"><label className="wide">Skills<input maxLength="2000" placeholder="JavaScript, Product design, Figma" value={draft.skills.join(', ')} onChange={(event) => updateField('skills', event.target.value)} /></label></div></section>
          <section id="projects" className="builder-panel"><h2>Selected projects</h2><p className="builder-hint">Add, edit, reorder, or remove projects. Only saved draft content appears here; visitors see the last version you published.</p>{draft.projects.map((item, index) => <EntryCard key={item.id} kind="project" item={item} first={index === 0} last={index === draft.projects.length - 1} onChange={(key, value) => updateItem('projects', item.id, key, value)} onMove={(offset) => moveItem('projects', item.id, offset)} onDelete={() => removeItem('projects', item.id)} />)}<button className="builder-add" type="button" onClick={() => addItem('projects')}>＋ Add project</button></section>
          <section id="experience" className="builder-panel"><h2>Work experience</h2>{draft.experience.map((item, index) => <EntryCard key={item.id} kind="experience" item={item} first={index === 0} last={index === draft.experience.length - 1} onChange={(key, value) => updateItem('experience', item.id, key, value)} onMove={(offset) => moveItem('experience', item.id, offset)} onDelete={() => removeItem('experience', item.id)} />)}<button className="builder-add" type="button" onClick={() => addItem('experience')}>＋ Add experience</button></section>
          <section id="education" className="builder-panel"><h2>Education</h2>{draft.education.map((item, index) => <EntryCard key={item.id} kind="education" item={item} first={index === 0} last={index === draft.education.length - 1} onChange={(key, value) => updateItem('education', item.id, key, value)} onMove={(offset) => moveItem('education', item.id, offset)} onDelete={() => removeItem('education', item.id)} />)}<button className="builder-add" type="button" onClick={() => addItem('education')}>＋ Add education</button></section>
          <section id="links" className="builder-panel"><h2>Professional links</h2><div className="builder-fields">{[['linkedin', 'LinkedIn URL', 'https://linkedin.com/in/…'], ['github', 'GitHub URL', 'https://github.com/…'], ['website', 'Website URL', 'https://…'], ['instagram', 'Instagram URL', 'https://instagram.com/…']].map(([key, label, placeholder]) => <label key={key}>{label}<input type="url" placeholder={placeholder} value={draft.socialLinks[key] || ''} onChange={(event) => updateSocial(key, event.target.value)} /></label>)}</div></section>
          <section id="design" className="builder-panel"><h2>Portfolio design</h2><div className="builder-fields"><label>Layout<select value={draft.layout} onChange={(event) => updateField('layout', event.target.value)}><option value="editorial">Editorial</option><option value="cards">Card showcase</option></select></label><label>Accent color<input type="color" value={draft.accentColor || '#a259ff'} onChange={(event) => updateField('accentColor', event.target.value)} /></label></div></section>
          <section className="builder-panel"><span className="eyebrow">PUBLISHING</span><h2>{status === 'published' ? 'Published' : status === 'unpublished' ? 'Unpublished' : 'Draft'}</h2><p className="builder-hint">{record?.updatedAt ? `Last saved ${new Date(record.updatedAt).toLocaleString()}. ${status === 'published' ? 'Draft edits do not change the live version until you publish again.' : status === 'unpublished' ? 'The public page is unavailable until you publish again.' : 'Private until you publish.'}` : 'Private until you publish.'}</p><div className="builder-progress"><span style={{ width: `${progress}%` }} /></div><div className="builder-hint">{progress}% complete · {checks.filter(Boolean).length} of {checks.length} sections filled</div>{published && <div className="builder-invite-result"><input id="publicLink" readOnly aria-label="Public portfolio link" value={`${location.origin}/portfolio.html?slug=${encodeURIComponent(record.slug)}`} /><button className="builder-add" type="button" onClick={copyLink}>Copy link</button></div>}<div className="builder-footer">{published && <button className="button secondary" type="button" onClick={unpublish}>Unpublish</button>}<span className={`builder-status${noticeError ? ' error' : ''}`} role="status" aria-live="polite">{notice}</span>{dirty && <span className="builder-dirty">Unsaved changes</span>}</div></section>
        </div>
        <aside className="preview-panel"><div className="preview-top"><h2>Live preview</h2><span>UPDATES AS YOU EDIT</span></div><LivePreview draft={draft} /></aside>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<StaffPortfolioBuilder />)
