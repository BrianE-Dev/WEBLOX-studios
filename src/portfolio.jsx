import { useEffect, useState } from 'react'
import PortfolioPresentation from './components/PortfolioPresentation.jsx'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'

export default function PortfolioPage() {
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

  return <main className="portfolio-public">
    <a className="portfolio-brand" href="/"><ThemeAwareLogo /><span>WEBLOX <small>STAFF PORTFOLIO</small></span></a>
    {status === 'loading' && <p className="portfolio-loading" role="status">Loading portfolio…</p>}
    {status === 'unavailable' && <div className="portfolio-unavailable" role="status"><span className="eyebrow">PORTFOLIO UNAVAILABLE</span><h1>This portfolio isn't available.</h1><p>It may be unpublished or the link may be incorrect.</p><a className="button secondary" href="/">Return to WEBLOX Studios</a></div>}
    {status === 'ready' && portfolio && <PortfolioPresentation portfolio={portfolio} />}
  </main>
}
