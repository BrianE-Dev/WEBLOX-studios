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
    try { await staffRequest('/api/staff/presence', { method: 'POST', body: '{}' }) } catch {}
    finally { pending = false }
  }
  heartbeat()
  const timer = setInterval(heartbeat, 180_000)
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') heartbeat() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
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
