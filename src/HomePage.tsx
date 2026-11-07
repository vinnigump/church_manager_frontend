import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import LoginPage from './LoginPage'
import './home.css'

export default function HomePage() {
  const { account } = useAuth()
  if (!account) return <LoginPage />
  return <section className="home-page" aria-labelledby="home-title">
    <p className="access-eyebrow">SUA COMUNIDADE</p>
    <h1 id="home-title" data-page-title="Início">Bem-vindo</h1>
    <p className="home-description">Conectado como {account.login}.</p>
    <div className="home-shortcuts">
      <Link className="home-shortcut" to="/eventos"><strong>Ver eventos</strong><span>Acesse a área de eventos.</span></Link>
      <Link className="home-shortcut" to="/conta"><strong>Acessar minha conta</strong><span>Consulte seu acesso e altere sua senha.</span></Link>
    </div>
  </section>
}
