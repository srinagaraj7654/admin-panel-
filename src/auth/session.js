/* ══════════════════════════════════════════════════════════════════════════
   Admin panel session — sign-in / refresh / sign-out all go through the Node server
   (server-for-admin-panel-, /api/auth/*). The admin panel never talks to Supabase directly.
   Stored in localStorage: { session: {access_token, refresh_token, expires_at}, user }.
   ══════════════════════════════════════════════════════════════════════════ */
import axios from 'axios'

const KEY = 'mt-admin-session'
const BASE = (import.meta.env.VITE_ACCESS_API_URL || '').replace(/\/+$/, '')
const http = axios.create({ baseURL: BASE, timeout: 30_000 })      // no auth interceptor here (avoids loops)

let state = load()
const listeners = new Set()
let refreshing = null

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s?.session?.access_token ? s : null } catch { return null }
}
function save(next) {
  state = next
  try { next ? localStorage.setItem(KEY, JSON.stringify(next)) : localStorage.removeItem(KEY) } catch {}
  listeners.forEach((fn) => { try { fn(state) } catch {} })
}
export const errorText = (e) => e?.response?.data?.error || e?.message || 'Something went wrong'

export const getState = () => state
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }

/** Email + password → server checks the password AND that the account is an admin. Throws with the server's message. */
export async function login(email, password) {
  const { data } = await http.post('/api/auth/login', { email, password, app: 'admin' })
  save({ session: data.session, user: data.user })
  return data
}

/** New tokens from the refresh token (one request at a time). Signs out if the refresh token is no longer valid. */
export function refresh() {
  if (!state?.session?.refresh_token) return Promise.resolve(null)
  if (!refreshing) {
    refreshing = http.post('/api/auth/refresh', { refresh_token: state.session.refresh_token })
      .then(({ data }) => { save({ session: data.session, user: data.user?.id ? data.user : state?.user }); return state })
      .catch((e) => { if (e?.response?.status === 401) save(null); throw e })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

/** Access token for API calls — refreshed automatically when it expires within 60 seconds. */
export async function getToken() {
  if (!state?.session) return null
  const exp = Number(state.session.expires_at || 0) * 1000
  if (exp && exp - Date.now() < 60_000) { try { await refresh() } catch { /* handled by caller's 401 */ } }
  return state?.session?.access_token || null
}

/** Sign out on the server (revokes the refresh token) and locally. */
export async function logout() {
  const token = state?.session?.access_token
  save(null)
  if (token) { try { await http.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }) } catch {} }
}

/**
 * "Forgot password?" e-mail link lands here with #access_token=…&refresh_token=…&type=recovery.
 * Store that session once and clean the address bar. Returns 'recovery' | 'error:<message>' | null.
 */
export function consumeAuthHash() {
  const h = window.location.hash || ''
  if (!/access_token=|error_description=|error=/.test(h)) return null
  const p = new URLSearchParams(h.replace(/^#/, ''))
  try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search) } catch {}
  if (p.get('error') || p.get('error_description')) return 'error:' + (p.get('error_description') || p.get('error')).replace(/\+/g, ' ')
  const access_token = p.get('access_token')
  if (!access_token) return null
  const expires_at = Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600)
  save({ session: { access_token, refresh_token: p.get('refresh_token') || '', expires_at }, user: null })
  return p.get('type') === 'recovery' ? 'recovery' : 'session'
}
