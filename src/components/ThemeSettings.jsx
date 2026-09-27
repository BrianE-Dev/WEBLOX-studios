import { useEffect, useState } from 'react'

export function useThemePreference() {
  const [theme, setTheme] = useState(() => localStorage.getItem('weblox-theme') || 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('weblox-theme', theme)
  }, [theme])

  return [theme, setTheme]
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.6 8.6 0 1 0 20.5 15.2Z"/></svg>
}

export default function ThemeSettings({ theme, onChange }) {
  return <div className="theme-settings" role="group" aria-label="Color theme">
    <button className={`theme-choice${theme === 'light' ? ' active' : ''}`} type="button" aria-pressed={theme === 'light'} onClick={() => onChange('light')}>
      <SunIcon /> <span>Light mode</span>
    </button>
    <button className={`theme-choice${theme === 'dark' ? ' active' : ''}`} type="button" aria-pressed={theme === 'dark'} onClick={() => onChange('dark')}>
      <MoonIcon /> <span>Dark mode</span>
    </button>
  </div>
}
