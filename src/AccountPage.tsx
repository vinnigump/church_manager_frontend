import UiIcon from './components/UiIcon'
import './account-visual.css'
import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import { useSignOut } from './useSignOut'
import './access.css'

export default function AccountPage() {
  const { account } = useAuth()
  const signOut = useSignOut()
  return <section className="account-page" aria-labelledby="account-title">
    <p className="access-eyebrow">SEU ACESSO</p>
    <h1 id="account-title" data-page-title="Minha conta">Minha conta</h1>
    <p className="account-description">Conectado como {account?.login}.</p>
    <div className="account-card">
      <div className="account-identity"><span className="account-symbol" aria-hidden="true"><UiIcon kind="account"/></span><div><span className="account-label">Login</span><strong>{account?.login}</strong></div></div>
      <div className="account-actions"><Link to="/questionarios"><UiIcon kind="task"/><span>Meus questionários</span><UiIcon kind="arrow"/></Link><Link to="/relatorios"><UiIcon kind="church"/><span>Relatórios da igreja</span><UiIcon kind="arrow"/></Link><Link to="/conta/senha"><UiIcon kind="account"/><span>Alterar minha senha</span><UiIcon kind="arrow"/></Link><button className="account-signout" onClick={signOut}>Sair da conta</button></div>
    </div>
  </section>
}
