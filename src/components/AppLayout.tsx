import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useSignOut } from '../useSignOut'
import Brand from './Brand'
import './app-shell.css'

function NavigationIcon({ kind }: { kind: 'home' | 'events' | 'ministries' | 'reception' | 'account' | 'login' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'home' ? <><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></> : kind === 'events' ? <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></> : kind === 'ministries' ? <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-3-5"/></> : kind === 'reception' ? <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V2h6v3M8 10h3v3H8Zm5 6h3v2h-3M8 17h2m5-7h1v3"/></> : kind === 'account' ? <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> : <><path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4"/></>}
  </svg>
}

export default function AppLayout() {
  const { account } = useAuth()
  const { pathname } = useLocation()
  const signOut = useSignOut()
  const guest = !account
  const accessPage = guest && (pathname === '/' || /^\/entrar\/?$/.test(pathname))
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Início', '/entrar': 'Entrar', '/sair': 'Sair', '/conta': 'Minha conta', '/eventos': 'Eventos', '/admin': 'Administração' }
    const title = main.current?.querySelector('h1[data-page-title]')?.getAttribute('data-page-title')
    const pageTitle = title ?? titles[pathname]
    document.title = pageTitle ? `${pageTitle} | Church Manager` : 'Church Manager'
    main.current?.focus()
  }, [pathname, guest])
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><div className={`app-shell${guest ? ' app-shell--guest' : ''}`}>
    <header className="app-header"><Link className="app-home-link" to="/"><Brand/></Link>
      {account && <div className="app-session-actions"><NavLink className="app-session-button" to="/conta">Minha conta</NavLink><button className="app-session-button" onClick={signOut}>Sair</button></div>}
    </header>
    {account && <nav className="app-navigation" aria-label="Principal">
      <NavLink to="/" end><NavigationIcon kind="home"/><span>Início</span></NavLink>
      <NavLink to="/pessoas"><NavigationIcon kind="account"/><span>Pessoas</span></NavLink>
      {account && <NavLink to="/eventos"><NavigationIcon kind="events"/><span>Eventos</span></NavLink>}
      <NavLink to="/ministerios"><NavigationIcon kind="ministries"/><span>Ministérios</span></NavLink>
      <NavLink to="/recepcao"><NavigationIcon kind="reception"/><span>Recepção</span></NavLink>
    </nav>}
    <main className={`app-content${accessPage ? ' app-content--access' : ''}`} ref={main} id="conteudo" tabIndex={-1}><Outlet/></main>
  </div></>
}
