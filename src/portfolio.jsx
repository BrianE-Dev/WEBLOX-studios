import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function ExternalLink({ href, children }) {
  const safeHref = safeUrl(href)
  if (!safeHref) return null
  return <a href={safeHref} target="_blank" rel="noopener noreferrer">{children}</a>
}

function TimelineSection({ eyebrow, title, records, primary, secondary }) {
  if (!records?.length) return null
  return (
    <section className="portfolio-section">
      <span className="eyebrow">{eyebrow}</span><h2>{title}</h2>
      <div className="portfolio-timeline">{records.map((item, index) => {
        const dates = [item.startDate, item.endDate].filter(Boolean).join(' – ')
        const meta = [item[secondary], item.location, dates].filter(Boolean).join(' · ')
        return <article key={`${item[primary] || item[secondary] || title}-${index}`}><h3>{item[primary] || item[secondary] || ''}</h3>{meta && <small>{meta}</small>}{item.description && <p>{item.description}</p>}</article>
      })}</div>
    </section>
  )
}

function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'
    let active = true
    async function load() {
      const slug = new URLSearchParams(location.search).get('slug')
      if (!slug || !/^[a-z0-9-]{1,180}$/i.test(slug)) {
        setStatus('unavailable')
        return
      }
      try {
        const response = await fetch(`/api/portfolios/public/${encodeURIComponent(slug)}`, { credentials: 'omit' })
        if (!response.ok) throw new Error('Portfolio unavailable')
        const { portfolio: result } = await response.json()
        if (!result?.published || result.slug !== slug) throw new Error('Portfolio unavailable')
        if (!active) return
        setPortfolio(result.published)
        document.title = `${result.published.name || 'Staff'} | WEBLOX Studios Portfolio`
        setStatus('ready')
      } catch {
        if (active) setStatus('unavailable')
      }
    }
    load()
    return () => { active = false }
  }, [])

  const p = portfolio
  const accent = /^#[0-9a-f]{6}$/i.test(p?.accentColor || '') ? p.accentColor : '#a259ff'
  const initials = (p?.name || 'W').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const photo = safeUrl(p?.photoUrl)
  const contactEmail = p?.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contactEmail) ? p.contactEmail : ''
  const socialLinks = [
    ['linkedin', 'LinkedIn ↗'],
    ['github', 'GitHub ↗'],
    ['website', 'Website ↗'],
    ['instagram', 'Instagram ↗'],
  ].filter(([key]) => safeUrl(p?.socialLinks?.[key]))

  return (
    <main className={`portfolio-public${p?.layout === 'cards' ? ' cards' : ''}`} style={{ '--portfolio-accent': accent }}>
      <a className="portfolio-brand" href="/"><img src="/assets/weblox-logo.png" alt="WEBLOX Studios" /><span>WEBLOX <small>STAFF PORTFOLIO</small></span></a>
      {status === 'loading' && <p className="portfolio-loading" role="status">Loading portfolio…</p>}
      {status === 'unavailable' && <div className="portfolio-unavailable" role="status"><span className="eyebrow">PORTFOLIO UNAVAILABLE</span><h1>This portfolio isn’t available.</h1><p>It may be unpublished or the link may be incorrect.</p><a className="button secondary" href="/">Return to WEBLOX Studios</a></div>}
      {status === 'ready' && p && <>
        <header className="portfolio-hero">
          {photo ? <img className="portfolio-photo" src={photo} alt={`${p.name || 'Staff'} profile photo`} /> : <div className="portfolio-photo portfolio-initials">{initials}</div>}
          {p.location && <span className="eyebrow">{p.location}</span>}
          <h1>{p.name || 'Portfolio'}</h1>
          {p.title && <p className="portfolio-title">{p.title}</p>}
          {p.biography && <p className="public-about">{p.biography}</p>}
          {socialLinks.length > 0 && <div className="portfolio-social">{socialLinks.map(([key, label]) => <ExternalLink key={key} href={p.socialLinks[key]}>{label}</ExternalLink>)}</div>}
        </header>

        {!!p.skills?.length && <section className="portfolio-section"><span className="eyebrow">CAPABILITIES</span><h2>Skills and tools</h2><div className="skill-pills">{p.skills.map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}</div></section>}

        {!!p.projects?.length && <section className="portfolio-section"><span className="eyebrow">SELECTED WORK</span><h2>Projects</h2><div className={`public-projects${p.layout === 'cards' ? ' cards' : ''}`}>{p.projects.map((project, index) => <article className={project.featured ? 'featured' : ''} key={`${project.title || 'project'}-${index}`}>
          <h3>{project.title || 'Project'}</h3>
          {safeUrl(project.imageUrl) && <img src={safeUrl(project.imageUrl)} alt={`${project.title || 'Project'} cover`} loading="lazy" />}
          {(project.startDate || project.endDate || project.technologies?.length > 0) && <p className="project-meta">{[[project.startDate, project.endDate].filter(Boolean).join(' – '), (project.technologies || []).join(' · ')].filter(Boolean).join(' · ')}</p>}
          {project.description && <p>{project.description}</p>}
          {(safeUrl(project.liveUrl) || safeUrl(project.sourceUrl)) && <div className="project-links"><ExternalLink href={project.liveUrl}>Live demo ↗</ExternalLink><ExternalLink href={project.sourceUrl}>Source code ↗</ExternalLink></div>}
        </article>)}</div></section>}

        <TimelineSection eyebrow="CAREER" title="Experience" records={p.experience} primary="title" secondary="organization" />
        <TimelineSection eyebrow="LEARNING" title="Education" records={p.education} primary="qualification" secondary="institution" />
        {contactEmail && <section className="portfolio-contact"><div><span className="eyebrow">LET’S CONNECT</span><h2>Have a project in mind?</h2></div><a className="button" href={`mailto:${contactEmail}`}>Contact me →</a></section>}
        <footer className="public-foot">Portfolio by {p.name || ''} · Built with WEBLOX Studios</footer>
      </>}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<PortfolioPage />)
