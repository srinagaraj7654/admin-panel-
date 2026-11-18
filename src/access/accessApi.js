/* ══════════════════════════════════════════════════════════════════════════
   Client for the admin access server (repo: server-for-admin-panel-, VITE_ACCESS_API_URL).
   Every request carries the session's access token (from src/auth/session.js — sign-in runs on
   the server). On 401 the token is refreshed once and the request retried; if that fails the
   admin is signed out.
   ══════════════════════════════════════════════════════════════════════════ */
import axios from 'axios'
import * as session from '../auth/session.js'

export const ACCESS_API_URL = (import.meta.env.VITE_ACCESS_API_URL || '').replace(/\/+$/, '')
export const ACCESS_API_ENABLED = !!ACCESS_API_URL

export const accessApi = axios.create({ baseURL: ACCESS_API_URL, timeout: 120_000 })

accessApi.interceptors.request.use(async (cfg) => {
  const token = await session.getToken()
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

accessApi.interceptors.response.use(undefined, async (error) => {
  const cfg = error?.config
  if (error?.response?.status === 401 && cfg && !cfg._retried && session.getState()?.session?.refresh_token) {
    cfg._retried = true
    try { await session.refresh(); return accessApi(cfg) } catch { await session.logout() }
  }
  throw error
})

/** { user, role, domains, modules, mustChangePassword, recovery } for the signed-in user, or null if the server is off/unreachable. */
export async function fetchMyAccess() {
  if (!ACCESS_API_ENABLED) return null
  try {
    const r = await accessApi.get('/api/me/access')
    return r.data
  } catch {
    return null
  }
}

/** Readable message from an access-server error. */
export const accessError = (e) => e?.response?.data?.error || e?.message || 'Something went wrong'
