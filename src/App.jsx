import { useEffect, useRef } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './components/home/HomePage.jsx'
import InternPortal from './intern-portal.jsx'
import InternshipPage from './internship-page.jsx'
import InternshipApply from './internship-apply.jsx'
import { WebloxLoaderHost } from './components/WebloxLoader.jsx'
import MasterAdmin from './master-admin.jsx'
import PortfolioPage from './portfolio.jsx'
import SignIn from './sign-in.jsx'
import StaffAdmin from './staff-admin.jsx'
import StaffDashboard from './staff-dashboard.jsx'
import StaffPortfolioBuilder from './staff-portfolio.jsx'
import StaffSignIn from './staff-sign-in.jsx'
import './intern-portal.css'
import './internship-page.css'
import './master-admin.css'
import './portfolio.css'
import './portfolio-theme.css'
import './portfolio-presentation.css'
import './sign-in.css'
import './staff-admin.css'
import './staff-dashboard.css'
import './staff-portfolio.css'
import './staff-sign-in.css'
import './theme-settings.css'
import './components/image-library.css'
import './components/theme-aware-logo.css'

const migratedPaths = new Set([
  '/internship', '/internship/apply', '/sign-in', '/sign-in.html', '/staff-sign-in', '/staff-sign-in.html',
  '/staff-admin', '/staff-admin.html', '/master-admin', '/master-admin.html',
  '/staff-dashboard', '/staff-dashboard.html', '/staff-portfolio', '/staff-portfolio.html',
  '/intern-portal', '/intern-portal.html', '/portfolio', '/portfolio.html',
])

function LegacyPublicRoutes() {
  const mountPoint = useRef(null)

  useEffect(() => {
    let active = true
    let appRoot
    import('./lib/recovered-app.js').then(({ mountRecoveredApp }) => {
      if (active && mountPoint.current) appRoot = mountRecoveredApp(mountPoint.current)
    }).catch((error) => {
      if (mountPoint.current) mountPoint.current.textContent = 'The WEBLOX website could not be loaded.'
      console.error('Could not load the public routes.', error)
    })
    return () => {
      active = false
      appRoot?.unmount()
    }
  }, [])

  useEffect(() => {
    const enterMigratedRoute = (event) => {
      const link = event.target.closest?.('a[href]')
      if (!link) return
      const url = new URL(link.href, window.location.href)
      if (url.origin === window.location.origin && migratedPaths.has(url.pathname)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.location.assign(url.pathname + url.search + url.hash)
      }
    }
    document.addEventListener('click', enterMigratedRoute, true)
    return () => document.removeEventListener('click', enterMigratedRoute, true)
  }, [])

  return <div ref={mountPoint} className="public-app-root" />
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const labels = {
      '/internship': 'WEBLOX Internship Program | WEBLOX Studios',
      '/': 'WEBLOX Studios — Technology venture studio',
      '/index.html': 'WEBLOX Studios — Technology venture studio',
      '/sign-in': 'Sign in | WEBLOX Studios',
      '/sign-in.html': 'Sign in | WEBLOX Studios',
      '/staff-sign-in': 'Staff and intern sign in | WEBLOX Studios',
      '/staff-sign-in.html': 'Staff and intern sign in | WEBLOX Studios',
      '/staff-admin': 'Staff admin | WEBLOX Studios',
      '/staff-admin.html': 'Staff admin | WEBLOX Studios',
      '/master-admin': 'Master admin | WEBLOX Studios',
      '/master-admin.html': 'Master admin | WEBLOX Studios',
      '/staff-dashboard': 'Staff dashboard | WEBLOX Studios',
      '/staff-dashboard.html': 'Staff dashboard | WEBLOX Studios',
      '/staff-portfolio': 'Portfolio builder | WEBLOX Studios',
      '/staff-portfolio.html': 'Portfolio builder | WEBLOX Studios',
      '/intern-portal': 'Intern portal | WEBLOX Studios',
      '/intern-portal.html': 'Intern portal | WEBLOX Studios',
      '/portfolio': 'Portfolio | WEBLOX Studios',
      '/portfolio.html': 'Portfolio | WEBLOX Studios',
    }
    if (labels[pathname]) document.title = labels[pathname]

    let referrer = document.querySelector('meta[name="referrer"]')
    if (!referrer) {
      referrer = document.createElement('meta')
      referrer.name = 'referrer'
      document.head.append(referrer)
    }
    referrer.content = ['/portfolio', '/portfolio.html', '/staff-sign-in', '/staff-sign-in.html'].includes(pathname)
      ? 'no-referrer'
      : 'strict-origin-when-cross-origin'
  }, [pathname])

  return null
}

function AppRoutes() {
  return <>
    <WebloxLoaderHost />
    <RouteMetadata />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/index.html" element={<HomePage />} />
      <Route path="/internship" element={<InternshipPage />} />
      <Route path="/internship/" element={<InternshipPage />} />
      <Route path="/internship/apply" element={<InternshipApply />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-in.html" element={<SignIn />} />
      <Route path="/staff-sign-in" element={<StaffSignIn />} />
      <Route path="/staff-sign-in.html" element={<StaffSignIn />} />
      <Route path="/staff-admin" element={<StaffAdmin />} />
      <Route path="/staff-admin.html" element={<StaffAdmin />} />
      <Route path="/master-admin" element={<MasterAdmin />} />
      <Route path="/master-admin.html" element={<MasterAdmin />} />
      <Route path="/staff-dashboard" element={<StaffDashboard />} />
      <Route path="/staff-dashboard.html" element={<StaffDashboard />} />
      <Route path="/staff-portfolio" element={<StaffPortfolioBuilder />} />
      <Route path="/staff-portfolio.html" element={<StaffPortfolioBuilder />} />
      <Route path="/intern-portal" element={<InternPortal />} />
      <Route path="/intern-portal.html" element={<InternPortal />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/portfolio.html" element={<PortfolioPage />} />
    </Routes>
  </>
}

export default function App() {
  const path = window.location.pathname
  const publicLegacyPaths = new Set([
    '/ventures', '/ventures/signarol', '/services', '/studio', '/careers',
    '/internship/apply', '/internship/portal', '/insights', '/contact',
  ])
  if (publicLegacyPaths.has(path) || ['/ventures/', '/services/', '/studio/', '/careers/', '/insights/', '/contact/'].some((prefix) => path.startsWith(prefix))) return <LegacyPublicRoutes />
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}
