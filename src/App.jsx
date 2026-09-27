import { useEffect, useRef } from 'react'
import HomePage from './components/home/HomePage.jsx'

const isHomepage = ['/', '/index.html'].includes(window.location.pathname)

function ExistingRoutes() {
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

  return <div ref={mountPoint} className="public-app-root" />
}

export default function App() {
  useEffect(() => {
    const returnHome = (event) => {
      const link = event.target.closest?.('a[href="/"]')
      if (link && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.location.assign('/')
      }
    }
    document.addEventListener('click', returnHome, true)
    return () => document.removeEventListener('click', returnHome, true)
  }, [])
  return isHomepage ? <HomePage /> : <ExistingRoutes />
}
