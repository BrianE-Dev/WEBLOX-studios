import { useState } from 'react'
import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'

const params = new URLSearchParams(location.search)

export default function StaffSignIn() {
  const [invite, setInvite] = useState(params.get('invite') || '')
  const [activating, setActivating] = useState(Boolean(params.get('invite')))
  const [email, setEmail] = useState(params.get('email') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState(params.has('activated') ? 'Account activated. Sign in with your new password.' : params.has('invite') && !params.get('invite') ? 'This invitation link is incomplete.' : '')
  const [success, setSuccess] = useState(params.has('activated'))
  const [busy, setBusy] = useState(false)

  document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'

  const switchToSignIn = () => {
    setInvite('')
    setActivating(false)
    setPassword('')
    setConfirmPassword('')
    setNotice('')
    setSuccess(false)
    history.replaceState({}, '', '/staff-sign-in.html')
  }

  const submit = async (event) => {
    event.preventDefault()
    setNotice('')
    setSuccess(false)
    setBusy(true)
    const normalizedEmail = email.trim().toLowerCase()
    try {
      if (activating) {
        if (password !== confirmPassword) throw new Error('The passwords do not match.')
        await authRequest('/activate', { method: 'POST', body: JSON.stringify({ email: normalizedEmail, password, invite }) })
        setInvite('')
        history.replaceState({}, '', '/staff-sign-in.html')
        setEmail(normalizedEmail)
        setPassword('')
        setConfirmPassword('')
        setActivating(false)
        setNotice('Account activated. Sign in with your new password.')
        setSuccess(true)
        return
      }

      const { account } = await authRequest('/login', { method: 'POST', body: JSON.stringify({ email: normalizedEmail, password }) })
      if (account.accountType !== 'staff') {
        await authRequest('/logout', { method: 'POST' })
        throw new Error('This account uses the staff administrator page.')
      }
      saveStaffSession(account)
      window.webloxShowBrandedLoader?.()
      location.replace('/staff-dashboard.html')
    } catch (error) {
      clearStaffSession()
      setNotice(error.message || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="staff-auth">
      <a href="/" className="staff-auth-brand"><ThemeAwareLogo alt="" /> WEBLOX <span className="eyebrow">STAFF WORKSPACE</span></a>
      <section className="staff-auth-card" aria-labelledby="authTitle">
        <span className="eyebrow">SECURE STAFF ACCESS</span>
        <h1 id="authTitle">{activating ? 'Set up your account.' : 'Welcome back.'}</h1>
        <p>{activating ? 'Choose a password to activate your invited WEBLOX staff account.' : 'Sign in with your staff email and password.'}</p>
        <form className="staff-auth-form" onSubmit={submit}>
          <label>Email address<input name="email" type="email" autoComplete="username" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input name="password" type="password" autoComplete={activating ? 'new-password' : 'current-password'} required minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {activating && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength="8" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
          <button className="button" type="submit" disabled={busy}>{busy ? 'Please wait…' : activating ? 'Activate account →' : 'Sign in →'}</button>
        </form>
        {activating && <button className="auth-back staff-auth-existing" type="button" onClick={switchToSignIn}>Already created a password? Sign in</button>}
        {notice && <div className={`staff-auth-notice${success ? ' success' : ''}`} role="status" aria-live="polite">{notice}</div>}
        <div className="staff-auth-links"><a href="/">← WEBLOX Studios</a><a href="/staff-admin.html">Staff administrator</a></div>
      </section>
    </main>
  )
}
