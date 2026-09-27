import { useMemo, useState } from 'react'

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function ExternalLink({ href, children, className = '' }) {
  const target = safeUrl(href)
  return target ? <a className={className} href={target} target="_blank" rel="noopener noreferrer">{children}</a> : null
}

function ExperienceTimeline({ entries = [], title = 'Work Experience', eyebrow = 'CAREER TIMELINE', education = false }) {
  if (!entries.length) return null
  return <section className="presentation-section">
    <span className="eyebrow">{eyebrow}</span><h2>{title}</h2>
    <div className="presentation-timeline">{entries.map((item, index) => <article className="presentation-timeline-item" key={item.id || `${item.title}-${index}`}>
      <div className="presentation-dates"><span>{[item.startDate, item.endDate || (item.startDate ? 'Present' : '')].filter(Boolean).join(' — ')}</span>{item.location && <small>{item.location}</small>}</div>
      <div className="presentation-role"><header><h3>{education ? item.qualification || item.institution : item.title || item.organization}</h3>{(education ? item.institution : item.organization) && <span>{education ? item.institution : item.organization}</span>}</header>
        {item.description && <p>{item.description}</p>}
        {!!item.technologies?.length && <div className="presentation-tags compact">{item.technologies.map((tag, tagIndex) => <span key={`${tag}-${tagIndex}`}>{tag}</span>)}</div>}
      </div>
    </article>)}</div>
  </section>
}

export default function PortfolioPresentation({ portfolio = {}, preview = false }) {
  const [category, setCategory] = useState('All Projects')
  const accent = /^#[0-9a-f]{6}$/i.test(portfolio.accentColor || '') ? portfolio.accentColor : '#7b3ff2'
  const projects = portfolio.projects || []
  const categories = useMemo(() => ['All Projects', ...new Set(projects.map((item) => item.category).filter(Boolean))], [projects])
  const visibleProjects = category === 'All Projects' ? projects : projects.filter((item) => item.category === category)
  const photo = safeUrl(portfolio.photoUrl)
  const cvUrl = safeUrl(portfolio.cvUrl)
  const recommendations = portfolio.testimonials || portfolio.recommendations || []
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(portfolio.contactEmail || '') ? portfolio.contactEmail : ''
  const socials = [
    ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['website', 'Website'], ['instagram', 'Instagram'],
  ].filter(([key]) => safeUrl(portfolio.socialLinks?.[key]))
  const initials = (portfolio.name || 'W').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return <div className={`portfolio-presentation${preview ? ' is-preview' : ''}`} style={{ '--portfolio-accent': accent }}>
    <header className="presentation-profile">
      <div className="presentation-profile-main">
        {photo ? <img className="presentation-avatar" src={photo} alt={`${portfolio.name || 'Portfolio'} profile`} /> : <div className="presentation-avatar presentation-initials">{initials}</div>}
        <div className="presentation-identity">
          <div className="presentation-badges">{portfolio.location && <span className="presentation-location">{portfolio.location}</span>}{portfolio.availability && <span className="presentation-availability"><i />{portfolio.availability}</span>}</div>
          <h1>{portfolio.name || 'Your name'}</h1><p className="presentation-title">{portfolio.title || 'Professional title'}</p>
        </div>
        {cvUrl && <ExternalLink className="button presentation-cv" href={cvUrl}>Download CV <span aria-hidden="true">↓</span></ExternalLink>}
      </div>
      {portfolio.biography && <p className="presentation-bio">{portfolio.biography}</p>}
      <div className="presentation-profile-footer">
        <div className="presentation-socials">{socials.map(([key, label]) => <ExternalLink key={key} href={portfolio.socialLinks[key]}>{label} ↗</ExternalLink>)}</div>
        {email && <a className="presentation-email" href={`mailto:${email}`}>{email}</a>}
      </div>
    </header>

    {!!portfolio.metrics?.length && <section className="presentation-metrics" aria-label="Career highlights">{portfolio.metrics.map((item, index) => <article key={item.id || `${item.label}-${index}`}><strong>{item.value}</strong>{item.detail && <span className="metric-detail">{item.detail}</span>}<small>{item.label}</small></article>)}</section>}

    {!!portfolio.skills?.length && <section className="presentation-section"><span className="eyebrow">CAPABILITIES</span><h2>Skills and tools</h2><div className="presentation-tags">{portfolio.skills.map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}</div></section>}

    {!!projects.length && <section className="presentation-section"><div className="presentation-section-heading"><div><span className="eyebrow">SELECTED WORK</span><h2>Projects</h2></div>{categories.length > 1 && <div className="project-filters" role="group" aria-label="Filter projects">{categories.map((item) => <button className={category === item ? 'active' : ''} type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'All Projects' ? `${item} (${projects.length})` : item}</button>)}</div>}</div>
      <div className="presentation-projects">{visibleProjects.map((project, index) => <article className="presentation-project" key={project.id || `${project.title}-${index}`}>
        {safeUrl(project.imageUrl) && <img className="presentation-project-image" src={safeUrl(project.imageUrl)} alt={`${project.title || 'Project'} preview`} loading="lazy" />}
        <div className="presentation-project-heading"><h3>{project.title || 'Project'}</h3>{project.category && <span>{project.category}</span>}</div>
        {project.description && <p>{project.description}</p>}
        {!!project.technologies?.length && <div className="presentation-project-stack">{project.technologies.map((tag, tagIndex) => <span key={`${tag}-${tagIndex}`}>{tag}</span>)}</div>}
        <div className="presentation-project-links"><ExternalLink href={project.liveUrl}>Live demo ↗</ExternalLink><ExternalLink href={project.sourceUrl}>GitHub ↗</ExternalLink></div>
      </article>)}</div>
    </section>}

    <ExperienceTimeline entries={portfolio.experience} />
    {!!portfolio.repositories?.length && <section className="presentation-section"><span className="eyebrow">COMMUNITY & CODE</span><h2>Open Source &amp; Technical Tools</h2><div className="presentation-repositories">{portfolio.repositories.map((repo, index) => <article key={repo.id || `${repo.name}-${index}`}><div className="repository-meta"><code>{repo.name || 'Repository'}</code>{repo.stars && <span>★ {repo.stars}</span>}</div><p>{repo.description}</p>{repo.language && <small>{repo.language}</small>}{safeUrl(repo.url) && <ExternalLink href={repo.url}>View repository ↗</ExternalLink>}</article>)}</div></section>}
    <ExperienceTimeline entries={portfolio.education} title="Education" eyebrow="LEARNING" education />
    {!!recommendations.length && <section className="presentation-section"><span className="eyebrow">ENDORSEMENTS</span><h2>What Colleagues Say</h2><div className="presentation-testimonials">{recommendations.map((item, index) => { const quote = typeof item === 'string' ? item : item.quote || item.recommendation || item.text; const name = item.name || item.author; return quote ? <article key={item.id || `${name || 'recommendation'}-${index}`}><blockquote>“{quote}”</blockquote>{(name || item.title || item.organization) && <div>{name && <b>{name}</b>}<small>{[item.title, item.organization].filter(Boolean).join(' @ ')}</small></div>}</article> : null })}</div></section>}
    {(email || cvUrl) && <section className="presentation-contact"><div><span className="eyebrow">LET'S CONNECT</span><h2>Have a project in mind?</h2></div>{email && <a className="button" href={`mailto:${email}`}>Contact me <span aria-hidden="true">→</span></a>}</section>}
    {!preview && <footer className="presentation-footer">Portfolio by {portfolio.name || ''} · Built with WEBLOX Studios</footer>}
  </div>
}
