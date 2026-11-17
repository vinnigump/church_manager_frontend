import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './people.css'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { redeemFirstAccess } from './first-access-api'
export default function FirstAccessRedeemPage() {
  const { account, logout } = useAuth()
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [login, setLogin] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [done, setDone] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); return () => pending.current?.abort() }, [])
  async function submit() {
    if (pending.current || blocked || done) return
    if (password !== confirmation || password.length < 12 || new TextEncoder().encode(password).length > 72) { setMessage('Use uma senha de pelo menos 12 caracteres, confirme a mesma senha e reduza-a se estiver muito longa.'); return }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { await redeemFirstAccess(token, login, password, controller.signal); if (!controller.signal.aborted) { setDone(true); setToken(''); setPassword(''); setConfirmation('') } }
    catch (error) { if (!controller.signal.aborted) {
      const rejected = error instanceof ApiError && [400,401,403,404,409,422].includes(error.status)
      setBlocked(!rejected); setMessage(rejected ? 'Não foi possível criar o acesso. Confira os dados e a validade do link. Se necessário, solicite outro link à equipe.' : 'Não foi possível confirmar o resultado. Tente entrar com o login e a senha escolhidos antes de repetir o cadastro.')
    } }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <section className="access-panel people-redeem"><h1 data-page-title="Primeiro acesso">Primeiro acesso</h1>
    {done ? <><p role="status">Seu acesso foi criado. Você já pode entrar com o login e a senha escolhidos.</p><Link to="/entrar">Entrar no sistema</Link></>
      : !/^[A-Za-z0-9_-]{43}$/.test(token) ? <p role="alert">Link inválido. Abra o link completo recebido da equipe.</p>
        : account ? <><p>Você está conectado como {account.login}. O primeiro acesso deve ser concluído pelo titular do link.</p><button onClick={() => logout()}>Sair desta conta e continuar</button></>
          : <><p>Escolha seu login e sua senha. Criar acesso não confirma presença nem torna você membro da igreja.</p>
            <form onSubmit={e => { e.preventDefault(); void submit() }}><fieldset disabled={busy || blocked}><legend>Criar meu acesso</legend>
              <label>Login<input required minLength={3} maxLength={254} autoComplete="username" pattern="[A-Za-z0-9][A-Za-z0-9@._+\-]{2,253}" value={login} onChange={e => setLogin(e.target.value)}/></label>
              <label>Senha<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
              <label>Confirmar senha<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>
              <button>Criar meu acesso</button>
            </fieldset></form>{busy && <p role="status">Criando seu acesso…</p>}{message && <p role="alert">{message}</p>}{blocked && <Link to="/entrar">Conferir se meu acesso foi criado</Link>}
          </>}
  </section>
}
