import { useEffect, useState } from 'react'

const loaderIntentKey = 'weblox-loader-active'
const loaderEvent = 'weblox-loader-change'

function updateLoaderIntent(active) {
  if (active) sessionStorage.setItem(loaderIntentKey, '1')
  else sessionStorage.removeItem(loaderIntentKey)
  window.dispatchEvent(new Event(loaderEvent))
}

export function showWebloxLoader() {
  updateLoaderIntent(true)
}

export function dismissWebloxLoader() {
  updateLoaderIntent(false)
}

export default function WebloxLoader({ fullscreen = true, label }) {
  const className = `weblox-loader${fullscreen ? ' weblox-loader-fullscreen' : ' weblox-loader-inline'}`
  return <div className={className} role="status" aria-label={label || 'Loading WEBLOX Studios'}>
    <div className="weblox-loader-brand" aria-hidden="true">
      <div className="weblox-loader-mark">
        <img src="/assets/mini-logo-dark.png" className="loader-mark-dark" alt="" />
        <img src="/assets/mini-logo-light.png" className="loader-mark-light" alt="" />
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
    return sessionStorage.getItem(loaderIntentKey) === '1' || path === '/' || path === '/index.html'
  })

  useEffect(() => {
    const syncLoader = () => setVisible(sessionStorage.getItem(loaderIntentKey) === '1')
    window.addEventListener(loaderEvent, syncLoader)
    window.webloxShowBrandedLoader = showWebloxLoader
    window.webloxDismissBrandedLoader = dismissWebloxLoader
    if ((window.location.pathname === '/' || window.location.pathname === '/index.html') && sessionStorage.getItem(loaderIntentKey) !== '1') {
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
