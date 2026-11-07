import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import Brand from './Brand'
import './app-shell.css'

function NavigationIcon({ kind }: { kind: 'home' | 'events' | 'account' | 'login' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'home' ? <><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></> : kind === 'events' ? <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></> : kind === 'account' ? <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> : <><path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4"/></>}
  </svg>
}

export default function AppLayout() {
  const { account, logout } = useAuth()
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Início', '/entrar': 'Entrar', '/conta': 'Minha conta', '/eventos': 'Eventos', '/admin': 'Administração' }
    const title = main.current?.querySelector('h1[data-page-title]')?.getAttribute('data-page-title')
    document.title = `${title ?? titles[pathname] ?? 'Página não encontrada'} | Church Manager`
    main.current?.focus()
  }, [pathname])
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><div className="app-shell">
    <header className="app-header"><Link className="app-home-link" to="/"><Brand/></Link>
      {account && <button className="app-session-button" onClick={() => logout()}>Sair</button>}
    </header>
    <nav className="app-navigation" aria-label="Principal">
      <NavLink to="/" end><NavigationIcon kind="home"/><span>Início</span></NavLink>
      {account && <NavLink to="/eventos"><NavigationIcon kind="events"/><span>Eventos</span></NavLink>}
      <NavLink to="/conta"><NavigationIcon kind="account"/><span>Minha conta</span></NavLink>
      {!account && <NavLink to="/entrar"><NavigationIcon kind="login"/><span>Entrar</span></NavLink>}
    </nav>
    <main className={`app-content${pathname === '/entrar' ? ' app-content--access' : ''}`} ref={main} id="conteudo" tabIndex={-1}><Outlet/></main>
  </div></>
}
