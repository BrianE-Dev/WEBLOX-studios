import { useEffect, useRef } from 'react'

// The public site's existing route tree is bundled in recovered-app.js. Mount it
// inside this React shell so the homepage has a normal JSX application entry.
export default function App() {
  const mountPoint = useRef(null)

  useEffect(() => {
    let active = true
    let appRoot
    import('./lib/recovered-app.js').then(({ mountRecoveredApp }) => {
      if (active && mountPoint.current) appRoot = mountRecoveredApp(mountPoint.current)
    }).catch((error) => {
      if (mountPoint.current) mountPoint.current.textContent = 'The WEBLOX website could not be loaded.'
      console.error('Could not load the public site.', error)
    })
    return () => {
      active = false
      appRoot?.unmount()
    }
  }, [])

  return <div ref={mountPoint} className="public-app-root" />
}
