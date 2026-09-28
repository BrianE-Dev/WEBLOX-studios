import { useEffect, useState } from 'react'

const loaderIntentKey = 'weblox-loader-target'
const loaderEvent = 'weblox-loader-change'

function updateLoaderIntent(active, targetPath = window.location.pathname) {
  if (active) sessionStorage.setItem(loaderIntentKey, new URL(targetPath, window.location.origin).pathname)
  else sessionStorage.removeItem(loaderIntentKey)
  window.dispatchEvent(new Event(loaderEvent))
}

function isLoaderRequestedFor(pathname) {
  return sessionStorage.getItem(loaderIntentKey) === pathname
}

export function showWebloxLoader(targetPath) {
  updateLoaderIntent(true, targetPath)
}

export function dismissWebloxLoader() {
  updateLoaderIntent(false)
}

export default function WebloxLoader({ fullscreen = true, label }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const className = `weblox-loader${fullscreen ? ' weblox-loader-fullscreen' : ' weblox-loader-inline'}`
  useEffect(() => {
    const syncTheme = () => setTheme(document.documentElement.dataset.theme || 'dark')
    window.addEventListener('weblox-theme-change', syncTheme)
    return () => window.removeEventListener('weblox-theme-change', syncTheme)
  }, [])
  return <div className={className} role="status" aria-label={label || 'Loading WEBLOX Studios'}>
    <div className="weblox-loader-brand" aria-hidden="true">
      <div className="weblox-loader-mark">
        <img src={theme === 'light' ? '/assets/mini-logo-light-small.png' : '/assets/mini-logo-dark-small.png'} alt="" width={theme === 'light' ? 84 : 80} height={theme === 'light' ? 68 : 84} />
        <svg className="weblox-loader-modules" viewBox="0 0 112 112" focusable="false">
          <path className="loader-module loader-module-top-left" d="M19 31V19h12" />
          <path className="loader-module loader-module-top-right" d="M81 19h12v12" />
          <path className="loader-module loader-module-bottom-right" d="M93 81v12H81" />
          <path className="loader-module loader-module-bottom-left" d="M31 93H19V81" />
        </svg>
      </div>
      <div className="weblox-loader-wordmark">WEBLOX <span>STUDIOS</span></div>
    </div>
    {label && <span className="weblox-loader-label">{label}</span>}
  </div>
}

export function WebloxLoaderHost() {
  const [visible, setVisible] = useState(() => {
    const path = window.location.pathname
    return isLoaderRequestedFor(path) || path === '/' || path === '/index.html'
  })

  useEffect(() => {
    const syncLoader = () => setVisible(isLoaderRequestedFor(window.location.pathname))
    window.addEventListener(loaderEvent, syncLoader)
    window.webloxShowBrandedLoader = showWebloxLoader
    window.webloxDismissBrandedLoader = dismissWebloxLoader
    if ((window.location.pathname === '/' || window.location.pathname === '/index.html') && !isLoaderRequestedFor(window.location.pathname)) {
      setVisible(false)
    }
    return () => {
      window.removeEventListener(loaderEvent, syncLoader)
      delete window.webloxShowBrandedLoader
      delete window.webloxDismissBrandedLoader
    }
  }, [])

  return visible ? <WebloxLoader fullscreen /> : null
}
