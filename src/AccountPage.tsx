import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import './access.css'

export default function AccountPage() {
  const { account, logout } = useAuth()
  return <section className="account-page" aria-labelledby="account-title">
    <p className="access-eyebrow">SEU ACESSO</p>
    <h1 id="account-title">Minha conta</h1>
    <p className="account-description">Conectado como {account?.login}.</p>
    <div className="account-card">
      <div className="account-identity"><span className="account-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span><div><span className="account-label">Login</span><strong>{account?.login}</strong></div></div>
      <div className="account-actions"><Link to="/conta/senha">Alterar minha senha</Link><button className="account-signout" onClick={() => logout()}>Sair da conta</button></div>
    </div>
  </section>
}
