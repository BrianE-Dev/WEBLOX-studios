import { useEffect, useState } from 'react'
import HeroProductScene from './HeroProductScene.jsx'
import { setPageSeo } from '../../lib/seo.js'
import './HomePage.css'

const primaryLinks = [
  ['Ventures', '/ventures'],
  ['Services', '/services'],
  ['Studio', '/studio'],
  ['Insights', '/insights'],
  ['Careers', '/careers'],
  ['Internship', '/internship'],
]

const principles = [
  ['Innovation', 'Modern technology applied deliberately to real problems and meaningful opportunities.'],
  ['Quality', 'Thoughtful systems, product craftsmanship, and rigorous execution at every layer.'],
  ['Impact', 'Digital products designed to deliver practical value, support growth, and create lasting opportunities.'],
]

const services = [
  ['01', 'Website Design & Development', 'High-performance marketing websites engineered to communicate clearly, load quickly, and scale with your business.'],
  ['02', 'Web Application Development', 'Custom platforms, internal tools, customer portals, and SaaS products built around real workflows.'],
  ['03', 'E-commerce Websites', 'Conversion-minded storefronts with payments, inventory, and operations designed for growth.'],
  ['04', 'Website Maintenance & Support', 'Reliable iteration, security upkeep, performance monitoring, and technical support after launch.'],
  ['05', 'Website Redesign', 'A strategic rebuild for teams whose current site no longer reflects the quality of their work.'],
  ['06', 'Custom Web Applications', 'Purpose-built digital products for complex business problems and ambitious new ventures.'],
]

const lifecycle = [
  ['Discover', 'Problem & Opportunity', 'We define the problem, understand users, clarify the business objective, and identify where technology can create value.'],
  ['Validate', 'Strategy & Feasibility', 'We test the idea, challenge assumptions, assess technical and commercial feasibility, and determine what is worth building.'],
  ['Design', 'Product Experience', 'We translate validated ideas into clear product flows, interfaces, systems, and experiences around real users and goals.'],
  ['Build', 'Engineering & Iteration', 'We turn the product into reality through focused development cycles, testing, refinement, and measurable progress.'],
  ['Launch', 'Market Entry', 'We prepare the product for real users, deploy it reliably, establish growth foundations, and learn from early signals.'],
  ['Scale', 'Growth & Evolution', 'We improve what works, expand capabilities, optimize performance, and evolve as users, markets, and opportunities grow.'],
]

const organization = [
  ['Our Mission', 'To build products and ventures where technical craftsmanship is non-negotiable.'],
  ['Our Vision', 'To compete internationally through product quality, execution speed, and technology.'],
  ['Our Engineering Ethos', 'Thoughtful systems. Decisive delivery. Enduring attention to craft.'],
]

const insights = [
  ['AI & Engineering', 'Building evaluation systems that make technical interviews more signal-rich.'],
  ['Venture Strategy', 'How to design digital products for global markets from day one.'],
  ['Product Thinking', 'The care required to make complex developer tools feel clear and useful.'],
]

function Arrow() { return <span className="ui-arrow" aria-hidden="true" /> }

function useSiteTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('weblox-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))
  useEffect(() => {
    const syncTheme = () => setTheme(document.documentElement.dataset.theme || localStorage.getItem('weblox-theme') || 'dark')
    window.addEventListener('weblox-theme-change', syncTheme)
    return () => window.removeEventListener('weblox-theme-change', syncTheme)
  }, [])
  return theme
}

function SectionHeading({ eyebrow, title, copy }) {
  return <div className="heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('weblox-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('weblox-theme', theme)
    window.dispatchEvent(new Event('weblox-theme-change'))
  }, [theme])
  const next = theme === 'dark' ? 'light' : 'dark'
  return <button className="theme-toggle" type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>{theme === 'dark' ? '☀' : '◐'}</button>
}

export function SiteHeader({ ctaHref = '#enquiry', activeHref = '' } = {}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const theme = useSiteTheme()
  const closeMenu = () => setMenuOpen(false)
  return <header className="home-header">
    <div className="nav shell">
      <a className="brand" href="/" aria-label="WEBLOX Studios home"><span className="mark"><img src={theme === 'light' ? '/assets/logo-light-small.png' : '/assets/logo-dark-small.png'} width="34" height="34" alt="" /></span><span>WEBLOX <em>STUDIOS</em></span></a>
      <nav aria-label="Primary">{primaryLinks.map(([label, href]) => <a key={href} className={href === activeHref ? 'active' : undefined} href={href}>{label}</a>)}</nav>
      <div className="nav-actions"><ThemeToggle /><a className="button small" href={ctaHref}>Let’s Build <Arrow /></a><a className="button small portal-signin-link" href="/sign-in">Sign in</a><button className="menu" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? '×' : '☰'}</button></div>
    </div>
    {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{primaryLinks.map(([label, href]) => <a key={href} href={href} onClick={closeMenu}>{label}</a>)}<a href="/sign-in" onClick={closeMenu}>Sign in</a></nav>}
  </header>
}

function TerminalPreview() {
  return <aside className="terminal" aria-label="WEBLOX technology platform preview">
    <div className="terminal-top"><span><i className="red" /><i className="yellow" /><i className="green" /> weblox-core-telemetry // live</span><b>CONNECTED</b></div>
    <div className="terminal-body">
      <div className="panel"><span>AI Core Pipeline</span><b>System online</b><small>Dynamic throughput · edge-ready</small></div>
      <div className="panel"><small>VENTURE ENGINE STACK</small><p><i className="terminal-status-dot" /> Signarol AI <em>ACTIVE</em></p><p><i className="terminal-status-ring" /> Venture pipeline <em>VALIDATING</em></p></div>
      <pre><b>&gt;</b> weblox.deploy({'{'}<br />  engine: 'signarol',<br />  target: 'global'<br />{'}'})<br /><em><i className="terminal-check" /> Production checks passed</em></pre>
    </div>
  </aside>
}

function ProjectEnquiry() {
  const [status, setStatus] = useState({ kind: '', message: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setStatus({ kind: '', message: '' })
    const form = event.currentTarget
    try {
      const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Unable to submit your inquiry. Please try again.')
      form.reset()
      setStatus({ kind: 'success', message: 'Thanks for reaching out. Your project inquiry has been received.' })
    } catch (error) { setStatus({ kind: 'error', message: error.message || 'Unable to submit your inquiry. Please try again.' }) }
    finally { setBusy(false) }
  }

  return <section className="page shell contact" id="enquiry">
    <SectionHeading eyebrow="Project Inquiry" title="Let’s build something useful." copy="Tell us enough to understand the problem. We’ll help identify a sensible next step." />
    {status.kind === 'success' ? <div className="success card" role="status"><h2>Message received.</h2><p>{status.message}</p></div> : <form onSubmit={submit}>
      <label>Name<input required name="name" autoComplete="name" /></label>
      <label>Company<input name="company" autoComplete="organization" /></label>
      <label>Email<input required name="email" type="email" autoComplete="email" /></label>
      <label>Phone <small>(optional)</small><input name="phone" type="tel" autoComplete="tel" /></label>
      <label>Project type<select required name="projectType" defaultValue=""><option value="" disabled>Select one</option><option>Website</option><option>Web application</option><option>E-commerce</option><option>Maintenance / redesign</option><option>Venture collaboration</option></select></label>
      <label>Budget range<select required name="budgetRange" defaultValue=""><option value="" disabled>Select a range</option><option>To be discussed</option><option>₦1m – ₦5m</option><option>₦5m – ₦15m</option><option>₦15m+</option></select></label>
      <label className="wide">Project description<textarea required rows="6" name="description" placeholder="What are you looking to build, improve, or validate?" /></label>
      <label>Timeline<select required name="timeline" defaultValue=""><option value="" disabled>Select one</option><option>Immediately</option><option>1–3 months</option><option>3+ months</option></select></label>
      <div className="wide"><button className="button" type="submit" disabled={busy}>{busy ? 'Sending…' : <>Send inquiry <Arrow /></>}</button></div>
    </form>}
    {status.kind === 'error' && <p className="form-error" role="alert">{status.message}</p>}
    <a className="contact-email" href="mailto:studio@weblox.io">Direct channel: studio@weblox.io</a>
  </section>
}

export function SiteFooter() {
  const theme = useSiteTheme()
  return <footer><div className="shell"><div className="footer-grid">
    <div><a className="brand" href="/"><span className="mark"><img src={theme === 'light' ? '/assets/logo-light-small.png' : '/assets/logo-dark-small.png'} width="34" height="34" alt="" /></span><span>WEBLOX <em>STUDIOS</em></span></a><p>A technology venture studio building, launching, and scaling digital products for global markets.</p><small>ENGINEERED FOR LEVERAGE</small></div>
    <div><strong>Explore</strong><a href="/ventures">Ventures</a><a href="/services">Services</a><a href="/studio">Studio</a><a href="/insights">Insights</a></div>
    <div><strong>Company</strong><a href="/careers">Careers</a><a href="/internship">Internship</a><a href="/#enquiry">Start a project</a><a href="mailto:studio@weblox.io">studio@weblox.io</a></div>
    <div className="status"><span><i /> All systems operational</span><small>Building products with purpose.<br />Engineering for lasting value.</small></div>
  </div><div className="copyright">© 2026 WEBLOX Studios. Ideas into products. Products into ventures.</div></div></footer>
}

export default function HomePage() {
  useEffect(() => {
    setPageSeo({
      title: 'WEBLOX Studios | Technology Venture Studio',
      description: 'WEBLOX Studios builds, launches, and scales digital products for global markets. Thoughtful systems, decisive execution, and engineering for lasting value.',
      path: '/',
    })
  }, [])

  return <>
    <SiteHeader />
    <main>
      <section className="hero shell">
        <div><span className="chip"><i /> TECHNOLOGY VENTURE STUDIO</span><h1><strong>We build, launch, and scale digital products for global markets.</strong></h1><p>WEBLOX Studios turns ideas into useful products through thoughtful engineering, decisive execution, and systems built to grow.</p><div className="actions"><a className="button" href="#enquiry">Start a Project <Arrow /></a><a className="button secondary" href="/ventures">Explore Our Work</a></div><div className="metrics"><span><b>100%</b>Custom-built</span><span><b>6 weeks</b>Idea to MVP</span><span><b>Day 1</b>Scalable architecture</span></div></div>
        <div className="hero-visual"><HeroProductScene /><TerminalPreview /></div>
      </section>

      <section className="band"><div className="shell"><SectionHeading eyebrow="Architectural Principles" title="Built for real problems. Engineered for lasting value." copy="We build digital products with the technology, precision, and discipline required to create meaningful value and scale beyond the initial idea." /><div className="cards three">{principles.map(([title, copy], index) => <article className="card" key={title}><span className="num">0{index + 1}</span><h3>{title}</h3><p>{copy}</p><small>● ENGINEERED FOR LEVERAGE</small></article>)}</div></div></section>

      <section className="section shell"><SectionHeading eyebrow="Venture Spotlight" title="Featured Venture: Signarol" copy="An AI-powered coding interview intelligence platform." /><article className="venture"><div><span className="chip">AI MVP</span><h3>SIGNAROL</h3><p>Technical interview intelligence and live coding evaluation built to help teams make better hiring decisions.</p><a className="button secondary" href="/ventures/signarol">View Signarol <Arrow /></a></div><div className="code"><small>signarol_eval_worker.py</small><pre><b>import</b> signarol_kernel<br /><br /><b>def</b> evaluate(candidate):<br />  telemetry = engine.run(candidate)<br />  <b>return</b> telemetry.score()</pre><span>● Analysis ready <em>Passed checks</em></span></div></article></section>

      <section className="section shell"><SectionHeading eyebrow="Engineering Depth" title="What we build." copy="Venture-grade product thinking applied to commercial digital work." /><div className="cards three">{services.map(([number, title, copy]) => <article className="card service" key={number}><span className="num">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div><a className="button secondary" href="/services">View Services <Arrow /></a></section>

      <section className="band"><div className="shell"><SectionHeading eyebrow="Systematic Delivery" title="The WEBLOX Lifecycle" copy="Precision execution from raw technical hypothesis to production software." /><div className="process">{lifecycle.map(([name, stage, copy], index) => <article key={name}><b>{String(index + 1).padStart(2, '0')}</b><h3>{name}</h3><small>[ {stage} ]</small><p>{copy}</p></article>)}</div></div></section>

      <section className="section shell"><SectionHeading eyebrow="Our Organization" title="Ideas. Technology. Products. Ventures." /><div className="cards three">{organization.map(([title, copy], index) => <article className="card" key={title}><span className="num">0{index + 1} / STUDIO</span><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="inline-cta"><div><span className="eyebrow">Join the Studio</span><h3>Learn by contributing to real work.</h3><p>Emerging professionals can explore practical experience inside the WEBLOX Internship Program.</p></div><a className="button secondary" href="/internship">Explore the Internship <Arrow /></a></div><a className="button secondary" href="/studio">Meet the Studio <Arrow /></a></section>

      <section className="band"><div className="shell"><SectionHeading eyebrow="Knowledge Base" title="Studio Insights" copy="Ideas, lessons, and perspectives from building products, ventures, and technology." /><div className="cards three">{insights.map(([category, title]) => <article className="card insight" key={category}><small>{category} · Coming Soon</small><h3>{title}</h3><p>Editorial infrastructure is ready for future publishing.</p></article>)}</div><a className="button secondary" href="/insights">Explore Studio Insights <Arrow /></a></div></section>

      <section className="section shell"><div className="cta"><span className="eyebrow">Co-building & Ventures</span><h2>Have an idea worth building?</h2><p>Tell us what you’re working on. We’ll help identify a sensible next step.</p><a className="button" href="#enquiry">Let’s Build <Arrow /></a></div></section>
      <ProjectEnquiry />
    </main>
    <SiteFooter />
  </>
}
