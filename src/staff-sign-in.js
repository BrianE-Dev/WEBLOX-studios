import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
let invite = params.get('invite') || ''
let activating = Boolean(invite)
document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark'
$('staffAuthForm').elements.email.value = params.get('email') || ''

function setMode(isActivation) {
  activating = isActivation
  $('authTitle').textContent = activating ? 'Set up your account.' : 'Welcome back.'
  $('authDescription').textContent = activating
    ? 'Choose a password to activate your invited WEBLOX staff account.'
    : 'Sign in with your staff email and password.'
  $('confirmWrap').classList.toggle('hidden', !activating)
  $('staffAuthForm').elements.confirmPassword.required = activating
  $('password').autocomplete = activating ? 'new-password' : 'current-password'
  $('submitButton').textContent = activating ? 'Activate account →' : 'Sign in →'
  $('password').value = ''
}

setMode(activating)
if (params.has('activated')) {
  $('authNotice').textContent = 'Account activated. Sign in with your new password.'
  $('authNotice').classList.add('success')
}
if (params.has('invite') && !invite) $('authNotice').textContent = 'This invitation link is incomplete.'

$('staffAuthForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const email = form.elements.email.value.trim().toLowerCase()
  const password = form.elements.password.value
  const notice = $('authNotice')
  notice.textContent = ''
  notice.classList.remove('success')
  $('submitButton').disabled = true
  try {
    if (activating) {
      if (password !== form.elements.confirmPassword.value) throw new Error('The passwords do not match.')
      await authRequest('/activate', {
        method: 'POST',
        body: JSON.stringify({ email, password, invite }),
      })
      invite = ''
      history.replaceState({}, '', '/staff-sign-in.html')
      form.elements.email.value = email
      setMode(false)
      notice.textContent = 'Account activated. Sign in with your new password.'
      notice.classList.add('success')
      return
    }

    const { account } = await authRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (account.accountType !== 'staff') {
      await authRequest('/logout', { method: 'POST' })
      throw new Error('This account uses the staff administrator page.')
    }
    saveStaffSession(account)
    location.replace('/staff-dashboard.html')
  } catch (error) {
    clearStaffSession()
    notice.textContent = error.message || 'Could not sign in. Please try again.'
  } finally {
    $('submitButton').disabled = false
  }
})
