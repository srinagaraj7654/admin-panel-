/* ══════════════════════════════════════════════════════════════════════════
   MockTest ADMIN PANEL — separate project (folder admin-panel/, `npm run dev` → http://localhost:3001).
   Flow: sign in (email + password only) → temporary password? set a permanent one →
   role from the admin access server → AdminPage.
   Needs the admin access server (VITE_ACCESS_API_URL); it decides who is an admin.
   Styles: Tailwind + the `lm-*` classes in src/index.css.
   ══════════════════════════════════════════════════════════════════════════ */
import { Suspense, lazy, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { ACCESS_API_ENABLED, accessApi, accessError, fetchMyAccess } from './access/accessApi.js'
import { toast } from './toast.js'
import ToastHost from './components/ToastHost.jsx'
import SetPasswordScreen from './components/admin/SetPasswordScreen.jsx'

const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))

// "View site" in the admin menu → the student website.
const MAIN_SITE_URL = import.meta.env.VITE_MAIN_SITE_URL
  || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3000' : '/')

function Spinner({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#fed7c2', borderTopColor: '#F06535' }}/>
      {label && <div className="text-sm text-gray-500">{label}</div>}
    </div>
  )
}

/* Centered card used by the sign-in and message screens */
function Card({ children }) {
  return (
    <div className="lm min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
      <div className="lm-card w-full" style={{ maxWidth: 420, padding: '28px 24px' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: '#F06535' }}>A</div>
          <div><div className="font-bold text-gray-900 leading-tight">MockTest</div><div className="text-xs text-gray-500">Admin Panel</div></div>
        </div>
        {children}
      </div>
    </div>
  )
}

function AdminLogin({ notice = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(notice)   // e.g. "not an admin account" after an automatic sign-out
  const [info, setInfo] = useState('')

  const signIn = async (e) => {
    e.preventDefault()
    setErr(''); setInfo('')
    if (!email.trim() || !password) return setErr('Enter your email and password.')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(error.message)          // success → onAuthStateChange in AdminApp takes over
  }
  // "Forgot password?" goes through the admin server: it sends the reset email ONLY to admin accounts and
  // answers every email the same way (so it can't be used to find out who the admins are).
  const forgot = async () => {
    setErr(''); setInfo('')
    if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email.trim())) return setErr('Enter your admin email address first.')
    try {
      const { data } = await accessApi.post('/api/auth/forgot-password', { email: email.trim() })
      setInfo(data?.message || 'If this email belongs to an admin account, a password reset link has been sent.')
    } catch (e) { setErr(accessError(e)) }
  }
  return (
    <Card>
      <h1 className="lm-title" style={{ fontSize: 22 }}>Admin sign in</h1>
      <p className="lm-sub" style={{ margin: '4px 0 18px' }}>Only accounts given admin access by the super admin can sign in here.</p>
      <form onSubmit={signIn} className="flex flex-col gap-3">
        <input className="lm-input" type="email" placeholder="Email address" autoComplete="email" aria-label="Email address"
          value={email} onChange={(e) => setEmail(e.target.value)} autoFocus/>
        <input className="lm-input" type="password" placeholder="Password" autoComplete="current-password" aria-label="Password"
          value={password} onChange={(e) => setPassword(e.target.value)}/>
        <button type="button" className="lm-link self-end" onClick={forgot} style={{ fontSize: 12.5 }}>Forgot password?</button>
        {info && !err && <p className="text-xs rounded-lg px-3 py-2" style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', margin: 0 }}>✓ {info}</p>}
        {err && <p className="lm-error" role="alert">{err}</p>}
        <button type="submit" className="lm-btn is-primary" disabled={busy} style={{ height: 44, justifyContent: 'center' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Card>
  )
}

function Message({ title, body, onLogout, onRetry }) {
  return (
    <Card>
      <h1 className="lm-title" style={{ fontSize: 20 }}>{title}</h1>
      <p className="lm-sub" style={{ margin: '6px 0 18px' }}>{body}</p>
      <div className="flex gap-2">
        {onRetry && <button type="button" className="lm-btn is-primary" onClick={onRetry}>Try again</button>}
        <button type="button" className="lm-btn" onClick={onLogout}>Sign out</button>
      </div>
    </Card>
  )
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined)            // undefined = still checking the session
  const [access, setAccess] = useState(null)             // { role, domains } from the admin access server
  const [accessState, setAccessState] = useState('idle') // idle | loading | ok | error
  const [loginNotice, setLoginNotice] = useState('')     // shown on the sign-in page after a rejected account

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null))
    return () => sub?.subscription?.unsubscribe()
  }, [])

  const loadAccess = async () => {
    setAccessState('loading')
    const a = await fetchMyAccess()
    if (!a) { setAccess(null); setAccessState('error'); return }
    // Only admins created / granted by the super admin (and super admins) may use this panel. Any other
    // Supabase account (e.g. a student) is signed out straight away and sent back to the sign-in page.
    // (The admin server also refuses every admin request from such accounts.)
    if (!['admin', 'super_admin'].includes(a.role)) {
      const email = a.user?.email || 'This account'
      setLoginNotice(`${email} is not an admin account. Only accounts created by the super admin can sign in here.`)
      setAccess(null); setAccessState('idle')
      await supabase.auth.signOut()
      setUser(null)
      return
    }
    setLoginNotice('')
    setAccess(a); setAccessState('ok')
  }
  useEffect(() => {
    if (!user) { setAccess(null); setAccessState('idle'); return }
    loadAccess()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => { await supabase.auth.signOut(); setUser(null) }

  let screen
  if (!ACCESS_API_ENABLED) {
    screen = <Message title="Admin server not configured"
      body="Set VITE_ACCESS_API_URL in .env.development (e.g. http://localhost:4000) and restart npm run dev." onLogout={logout}/>
  } else if (user === undefined) {
    screen = <Spinner/>
  } else if (!user) {
    screen = <AdminLogin key={loginNotice} notice={loginNotice}/>
  } else if (accessState === 'loading' || accessState === 'idle') {
    screen = <Spinner label="Checking your access…"/>
  } else if (accessState === 'error') {
    screen = <Message title="Can't reach the admin server"
      body="Make sure the admin server is running (npm run dev in server-for-admin-panel-) and allows this address in ALLOWED_ORIGINS."
      onRetry={loadAccess} onLogout={logout}/>
  } else if (access?.recovery && ['admin', 'super_admin'].includes(access?.role)) {
    // Opened a "Forgot password?" link → choose a new password, then sign in again with it.
    screen = <SetPasswordScreen mode="recovery" user={user} onLogout={logout}
      onDone={async () => {
        setLoginNotice('')
        toast('Password changed — sign in with your new password', 'success')
        await supabase.auth.signOut(); setUser(null)
      }}/>
  } else if (access?.mustChangePassword) {
    // Temporary password from the super admin → set a permanent one. Decided by the admin server (always
    // current), not the session stored in the browser (can still carry the old flag after the change).
    screen = <SetPasswordScreen user={user} onLogout={logout}
      onDone={() => { toast('Password saved — welcome!', 'success'); loadAccess() }}/>
  } else if (!['admin', 'super_admin'].includes(access?.role)) {
    screen = <Message title="No admin access"
      body={`${user.email} is not an admin. Ask the super admin to give you access, or sign in with a different account.`} onLogout={logout}/>
  } else {
    screen = (
      <Suspense fallback={<Spinner/>}>
        <AdminPage onBack={() => { window.location.href = MAIN_SITE_URL }} onLogout={logout}
          access={{ role: access.role, domains: access.domains || [], email: user.email }}/>
      </Suspense>
    )
  }

  return <>{screen}<ToastHost/></>
}
