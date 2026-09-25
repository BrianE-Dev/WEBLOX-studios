const apiBase = import.meta.env.VITE_API_URL || ''
const sessionKey = 'weblox-staff-session'

export async function authRequest(path, options = {}) {
  const response = await fetch(`${apiBase}/api/auth${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Authentication request failed.')
  return data
}

export async function staffRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
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
