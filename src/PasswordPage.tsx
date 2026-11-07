import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from './api'
import { useAuth, type PasswordNotice } from './auth'

export default function PasswordPage() {
  const { logout } = useAuth()
  const alive = useRef(false)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [uncertain, setUncertain] = useState(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function signInAgain(notice: PasswordNotice) {
    logout(notice)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || uncertain) return
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword'))
    const newPassword = String(data.get('newPassword'))
    const confirmation = String(data.get('confirmation'))
    setMessage('')
    if (!currentPassword.trim() || currentPassword.length > 72 || !newPassword.trim() || newPassword.length < 12 || newPassword.length > 72 || new TextEncoder().encode(newPassword).length > 72) {
      setMessage('Informe a senha atual e uma nova senha de 12 a 72 caracteres, com até 72 bytes em UTF-8.')
      form.reset()
      return
    }
    if (newPassword !== confirmation) {
      setMessage('A confirmação deve ser igual à nova senha.')
      form.reset()
      return
    }
    pending.current = true; setBusy(true)
    // Campos limpos antes da rede; as senhas não entram em estado React/storage.
    form.reset()
    try {
      const result = await api.request<unknown>('/accounts/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
      if (result !== undefined) throw new Error('Resposta inesperada.')
      if (alive.current) signInAgain('changed')
    } catch (error) {
      if (!alive.current) return
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        setMessage(error.status === 400 ? 'Não foi possível alterar a senha. Confira os dados informados.' : error.message)
      } else {
        setUncertain(true)
        setMessage('Não foi possível confirmar a alteração. Entre novamente para verificar qual senha está válida antes de tentar outra alteração.')
      }
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }
  return <section><h1 data-page-title="Alterar minha senha">Alterar minha senha</h1><Link to="/conta">Voltar à minha conta</Link>
    <p>Após alterar a senha, você precisará entrar novamente. A nova senha deve ter de 12 a 72 caracteres e até 72 bytes em UTF-8.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <label htmlFor="current-password">Senha atual</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" maxLength={72} required disabled={busy || uncertain}/>
      <label htmlFor="new-password">Nova senha</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={busy || uncertain}/>
      <label htmlFor="confirm-password">Confirmar nova senha</label><input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={busy || uncertain}/>
      {message && <p role="alert">{message}</p>}
      <button disabled={busy || uncertain}>{busy ? 'Alterando senha…' : 'Alterar senha'}</button>
    </form>
    {uncertain && <button onClick={() => signInAgain('uncertain')}>Encerrar sessão local e entrar novamente</button>}
  </section>
}
