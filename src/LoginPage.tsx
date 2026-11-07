import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { loginDestination, useAuth } from './auth'
import './access.css'

export default function LoginPage() {
  const { account, login, expired, passwordNotice: notice } = useAuth()
  const { state } = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const pending = useRef(false)
  const passwordNotice = notice === 'changed' ? 'Senha alterada. Entre novamente com a nova senha.'
    : notice === 'uncertain' ? 'Resultado da alteração não confirmado. Entre com a senha válida para continuar.' : null
  if (account) return <Navigate to={loginDestination(state)} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true); setError(''); setShowPassword(false)
    try { await login(String(data.get('login')), String(data.get('password'))) }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { form.reset(); pending.current = false; setBusy(false); setShowPassword(false) }
  }

  return <div className="access-layout">
    <div className="access-intro">
      <p className="access-eyebrow">PESSOAS, COMUNIDADE E PROPÓSITO</p>
      <p className="access-intro-title">Mais perto<br />da sua comunidade.</p>
      <p>Um espaço para conectar pessoas e acompanhar a vida da igreja.</p>
    </div>
    <section className="access-panel" aria-labelledby="access-title">
      <p className="access-eyebrow">BEM-VINDO DE VOLTA</p>
      <h1 id="access-title">Entrar</h1>
      <p className="access-description">Use sua conta cadastrada para acessar.</p>
      {passwordNotice && <p className="access-notice" role="status">{passwordNotice}</p>}
      {expired && <p className="access-notice" role="status">Sua sessão expirou. Entre novamente.</p>}
      <form className="access-form" onSubmit={submit} aria-busy={busy}>
        <div className="access-field"><label htmlFor="login">Login</label><input id="login" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} /></div>
        <div className="access-field"><label htmlFor="password">Senha</label><div className="access-password"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required disabled={busy} /><button type="button" className="access-reveal" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} aria-controls="password" disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></div>
        {error && <p className="access-error" role="alert">{error}</p>}
        <button className="access-submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </section>
  </div>
}
