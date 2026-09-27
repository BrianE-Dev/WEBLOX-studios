import { useEffect, useState } from 'react'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'

const defaults = {
  staffEnabled: true,
  internEnabled: true,
  title: 'Sign in to your workspace',
  copy: 'Choose your account type. Enter your registered email and the password issued for your account.',
  staffLabel: 'Staff',
  internLabel: 'Intern',
}

function readSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('weblox-signin-settings') || '{}') } }
  catch { return defaults }
}

export default function SignIn() {
  const [settings] = useState(readSettings)
  const [audience, setAudience] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark' }, [])

  const chooseAudience = (type) => {
    if (type === 'staff') {
      location.href = '/staff-sign-in.html'
      return
    }
    setAudience(type)
    setNotice('')
  }

  const submit = (event) => {
    event.preventDefault()
    setNotice('Authentication service is not connected yet. Your password was not sent or saved. Connect a secure identity provider to enable sign in.')
  }

  return (
    <main className="signin-shell">
      <a className="signin-brand" href="/">
        <ThemeAwareLogo alt="" />
        <span>WEBLOX <em>WORKSPACE</em></span>
      </a>
      <section className="signin-card">
        <span className="eyebrow">SECURE WORKSPACE</span>
        <h1>{settings.title}</h1>
        <p>{settings.copy}</p>
        <div className="audience-options">
          {settings.staffEnabled && <button type="button" onClick={() => chooseAudience('staff')}>
            <b>{settings.staffLabel}</b><small>WEBLOX team members</small>
          </button>}
          {settings.internEnabled && <button type="button" className={audience === 'intern' ? 'active' : ''} onClick={() => chooseAudience('intern')}>
            <b>{settings.internLabel}</b><small>Internship participants</small>
          </button>}
        </div>
        {audience === 'intern' && <form className="signin-form" onSubmit={submit}>
          <label>Registered email<input required type="email" name="email" autoComplete="username" placeholder="you@example.com" /></label>
          <label>Password<input required type="password" name="password" autoComplete="current-password" placeholder="Enter your password" /></label>
          <button className="signin-submit" type="submit">Continue to workspace →</button>
        </form>}
        {notice && <div className="signin-error" role="status">{notice}</div>}
        <div className="signin-note">Your password is private. The super admin can manage the sign-in page and registered staff details, but cannot view or change an individual password.</div>
        <a className="signin-back" href="/">← Back to WEBLOX Studios</a>
      </section>
    </main>
  )
}
