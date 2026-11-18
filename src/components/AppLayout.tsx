import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useSignOut } from '../useSignOut'
import Brand from './Brand'
import SidebarNavigation from './SidebarNavigation'
import ManagementContextSelector from './ManagementContextSelector'
import './app-shell.css'

export default function AppLayout() {
  const { account, restoring } = useAuth()
  const { pathname } = useLocation()
  const signOut = useSignOut()
  const guest = !account
  const accessPage = guest && (pathname === '/' || /^\/entrar\/?$/.test(pathname))
  const area = pathname === '/' ? 'Início' : pathname.startsWith('/pessoas') ? 'Pessoas' : pathname.startsWith('/eventos') ? 'Eventos' : pathname.startsWith('/ministerios') ? 'Ministérios' : pathname.startsWith('/recepcao') ? 'Recepção' : /^\/(minhas-trilhas|trilhas)/.test(pathname) ? 'Trilhas' : /^\/(minhas-tarefas|tarefas)/.test(pathname) ? 'Tarefas' : pathname.startsWith('/questionarios') ? 'Questionários' : pathname.startsWith('/relatorios') ? 'Relatórios' : pathname.startsWith('/seguranca') ? 'Configurações' : pathname.startsWith('/grupos') ? 'Grupos' : pathname.startsWith('/minhas-escalas') ? 'Minhas escalas' : pathname.startsWith('/minhas-inscricoes') ? 'Minhas inscrições' : pathname.startsWith('/conta') ? 'Minha conta' : 'Minha comunidade'
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Início', '/entrar': 'Entrar', '/sair': 'Sair', '/conta': 'Minha conta', '/eventos': 'Eventos', '/admin': 'Administração' }
    const title = main.current?.querySelector('h1[data-page-title]')?.getAttribute('data-page-title')
    const pageTitle = title ?? titles[pathname]
    document.title = pageTitle ? `${pageTitle} | Church Manager` : 'Church Manager'
    main.current?.focus({ preventScroll: true })
  }, [pathname, guest, restoring])
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><div className={`app-shell${guest ? ' app-shell--guest' : ''}`}>
    <header className="app-header"><Link className="app-home-link" to="/"><Brand/></Link>
      {account && <><div className="app-header-context"><span>Church Manager</span><span aria-hidden="true"> / </span><strong>{area}</strong></div><div className="app-session-actions"><NavLink className="app-session-button app-account-button" to="/conta"><span className="app-avatar" aria-hidden="true">{account.login.slice(0,2).toUpperCase()}</span>Minha conta</NavLink><button className="app-session-button" onClick={signOut}>Sair</button></div></>}
    </header>
    {account && <SidebarNavigation/>}
    <main className={`app-content${accessPage ? ' app-content--access' : ''}`} ref={main} id="conteudo" tabIndex={-1}>{account&&<ManagementContextSelector/>}<Outlet/></main>
  </div></>
}
