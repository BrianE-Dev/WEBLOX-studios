const sessionKey = 'weblox-staff-session'

export async function authRequest(path, options = {}) {
  const response = await fetch(`/api/auth${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Authentication request failed.')
  return data
}

export async function staffRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}

export function startStaffPresence() {
  let stopped = false
  let pending = false
  const heartbeat = async () => {
    if (stopped || pending) return
    pending = true
    try {
      await staffRequest('/api/staff/presence', { method: 'POST', body: '{}', keepalive: true })
    } catch (error) {
      console.warn('Could not update staff online status:', error.message)
    }
    finally { pending = false }
  }
  heartbeat()
  const timer = setInterval(heartbeat, 60_000)
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') heartbeat() }
  const onPageShow = () => heartbeat()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pageshow', onPageShow)
  return () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
  }
}

export function saveStaffSession(account) {
  sessionStorage.setItem(sessionKey, JSON.stringify(account))
}

export function getStaffSession() {
  try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null') } catch { return null }
}

export function clearStaffSession() {
  sessionStorage.removeItem(sessionKey)
}
