import { useEffect } from 'react'
import { ProjectEnquiry, SiteFooter, SiteHeader, services } from '../home/HomePage.jsx'
import ServiceIllustration from './ServiceIllustration.jsx'
import { setPageSeo } from '../../lib/seo.js'
import './MarketingPage.css'

const pageInfo = {
  '/ventures': ['Ventures', 'We build focused technology businesses around real opportunities.'],
  '/services': ['Services', 'Digital products, websites, and platforms built with venture-studio discipline.'],
  '/studio': ['Studio', 'A technology venture studio building, launching, and scaling digital products.'],
  '/insights': ['Insights', 'A publishing space being prepared for thoughtful product and engineering work.'],
  '/careers': ['Careers', 'We are building a small, high-craft team.'],
}

const metadata = {
  '/ventures': ['Ventures | WEBLOX Studios', pageInfo['/ventures'][1]],
  '/services': ['Services | WEBLOX Studios', pageInfo['/services'][1]],
  '/studio': ['Studio | WEBLOX Studios', pageInfo['/studio'][1]],
  '/insights': ['Insights | WEBLOX Studios', pageInfo['/insights'][1]],
  '/careers': ['Careers | WEBLOX Studios', pageInfo['/careers'][1]],
  '/ventures/signarol': ['Signarol | WEBLOX Studios', "Signarol is WEBLOX's AI-powered coding interview intelligence platform."],
  '/contact': ['Let’s Build | WEBLOX Studios', 'Start a project conversation with WEBLOX Studios.'],
}

function PageHeading({ title, copy, eyebrow = 'WEBLOX STUDIOS' }) {
  return <div className="heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>
}

function VentureSpotlight() {
  return <section className="section shell">
    <PageHeading eyebrow="Venture Spotlight" title="Featured Venture: Signarol" copy="An AI-powered coding interview intelligence platform." />
    <article className="venture">
      <div><span className="chip">AI MVP</span><h3>SIGNAROL</h3><p>Technical interview intelligence and live coding evaluation built to help teams make better hiring decisions.</p><a className="button secondary" href="/ventures/signarol">View Signarol <span aria-hidden="true">↗</span></a></div>
      <div className="code"><small>signarol_eval_worker.py</small><pre><b>import</b> signarol_kernel<br /><br /><b>def</b> evaluate(candidate):<br />  telemetry = engine.run(candidate)<br />  <b>return</b> telemetry.score()</pre><span>● Analysis ready <em>Passed checks</em></span></div>
    </article>
  </section>
}

function ComingSoon({ copy }) {
  return <div className="empty card"><span className="eyebrow">COMING SOON</span><h2>More to share soon.</h2><p>{copy} Until then, get in touch to discuss your project or venture.</p><a className="button secondary" href="/contact">Start a conversation</a></div>
}

function StandardMarketingPage({ path }) {
  const [title, copy] = pageInfo[path]
  return <><SiteHeader activeHref={path} ctaHref="/contact" /><main><section className="page shell">
    <PageHeading title={title} copy={copy} />
      {path === '/services' ? <div className="services-list">{services.map(([number, serviceTitle, serviceCopy, illustration]) => <article className="service-row" key={number}><div className="service-copy card"><span className="num">{number}</span><h3>{serviceTitle}</h3><p>{serviceCopy}</p></div><ServiceIllustration kind={illustration} title={serviceTitle} /></article>)}</div> : path === '/ventures' ? <VentureSpotlight /> : <ComingSoon copy={copy} />}
  </section></main><SiteFooter /></>
}

export default function MarketingPage({ path }) {
  useEffect(() => {
    const [title, description] = metadata[path] || metadata['/ventures']
    setPageSeo({ title, description, path })
  }, [path])

  if (path === '/contact') return <><SiteHeader activeHref={path} ctaHref="#enquiry" /><main><ProjectEnquiry /></main><SiteFooter /></>
  if (path === '/ventures/signarol') return <>
    <SiteHeader activeHref="/ventures" ctaHref="/contact" />
    <main><section className="page shell">
      <span className="chip">WEBLOX VENTURE</span>
      <h1>Signarol makes technical interviews more intelligent.</h1>
      <p className="lede">An AI-powered coding interview intelligence platform for better signals, clearer evaluation, and more thoughtful hiring decisions.</p>
      <VentureSpotlight />
      <section className="section shell"><div className="cta"><span className="eyebrow">Co-building &amp; Ventures</span><h2>Have an idea worth building?</h2><p>Tell us what you’re working on. We’ll help identify a sensible next step.</p><a className="button" href="/contact">Let’s Build <span aria-hidden="true">↗</span></a></div></section>
    </section></main><SiteFooter />
  </>
  return <StandardMarketingPage path={path} />
}
