import { useEffect, useRef } from 'react'
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Guard, useAuth } from './auth'
import LoginPage from './LoginPage'
import AccountPage from './AccountPage'
import EventsPage from './events/EventViews'
import ChurchCatalogPage from './events/ChurchCatalogPage'
import AnnualCalendarPage from './events/AnnualCalendarPage'
import SecurityPages from './security/SecurityPages'
import AuditPage from './security/AuditPage'
import Brand from './components/Brand'
import AssignmentsPage from './security/AssignmentsPage'
import DelegationsPage from './security/DelegationsPage'
import DelegationRevokePage from './security/DelegationRevokePage'
import DelegatedAssignmentsPage from './security/DelegatedAssignmentsPage'
import PasswordPage from './PasswordPage'
import AssignmentRevokePage from './security/AssignmentRevokePage'
import ProfileManagementPage from './security/ProfileManagementPage'
import { DenominationCatalogPage, TemplateHistoryPage } from './events/TemplatePages'

function Layout() {
  const { account, logout } = useAuth()
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Início', '/entrar': 'Entrar', '/conta': 'Minha conta', '/eventos': 'Eventos', '/admin': 'Administração' }
    const pageTitle = main.current?.querySelector('h1[data-page-title]')?.getAttribute('data-page-title')
    document.title = `${pageTitle ?? titles[pathname] ?? 'Página não encontrada'} | Church Manager`
    main.current?.focus()
  }, [pathname])
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><header className="app-header"><Link className="app-home-link" to="/"><Brand /></Link><nav className="app-navigation" aria-label="Principal">{account && <Link to="/eventos">Eventos</Link>}<Link to="/conta">Minha conta</Link>{account ? <button onClick={() => logout()}>Sair</button> : <Link to="/entrar">Entrar</Link>}</nav></header><main className={`app-content${pathname === '/entrar' ? ' app-content--access' : ''}`} ref={main} id="conteudo" tabIndex={-1}><Outlet /></main></>
}
export default function App() {
  return <Routes>
    <Route element={<Layout />}>
    <Route index element={<><h1>Bem-vindo</h1><p>Acesse sua conta para continuar.</p></>}/>
    <Route path="entrar" element={<LoginPage />}/>
    <Route element={<Guard />}>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes/:delegationId/revogar" element={<DelegationRevokePage />}/>
    <Route path="seguranca/denominacoes/:denominationId/auditoria" element={<AuditPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/auditoria/:resourceType/:resourceId" element={<AuditPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes" element={<DelegationsPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes/:delegationId" element={<DelegationsPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/atribuicoes/:assignmentId/revogar" element={<AssignmentRevokePage />}/>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes/:delegationId/atribuicoes" element={<DelegatedAssignmentsPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes/:delegationId/atribuicoes/:assignmentId" element={<DelegatedAssignmentsPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/atribuicoes" element={<AssignmentsPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/atribuicoes/:assignmentId" element={<AssignmentsPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/permissoes" element={<SecurityPages view="catalog" />}/>
    <Route path="seguranca/denominacoes/:denominationId/perfis/novo" element={<ProfileManagementPage create />}/>
    <Route path="seguranca/denominacoes/:denominationId/perfis/:profileId/gerenciar" element={<ProfileManagementPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/perfis" element={<SecurityPages view="profiles" />}/>
    <Route path="seguranca/denominacoes/:denominationId/perfis/:profileId" element={<SecurityPages view="profile" />}/>
    <Route path="seguranca/denominacoes/:denominationId/perfis/:profileId/versoes/:versionId" element={<SecurityPages view="version" />}/>
    <Route path="conta" element={<AccountPage />}/>
    <Route path="conta/senha" element={<PasswordPage />}/>
    <Route path="eventos" element={<EventsPage />}/>
    <Route path="eventos/igrejas/:churchId/calendarios" element={<AnnualCalendarPage />}/>
    <Route path="eventos/igrejas/:churchId/calendarios/:year" element={<AnnualCalendarPage />}/>
    <Route path="eventos/igrejas/:churchId/catalogo" element={<ChurchCatalogPage />}/>
    <Route path="eventos/denominacoes/:denominationId/catalogo" element={<DenominationCatalogPage />}/>
    <Route path="eventos/denominacoes/:denominationId/templates/:typeId" element={<TemplateHistoryPage />}/>
    <Route element={<Guard permission="organization:manage" scope="global" />}>
    <Route path="admin" element={<h1>Administração</h1>}/></Route></Route>
    <Route path="*" element={<><h1>Página não encontrada</h1><Link to="/">Voltar ao início</Link></>}/></Route></Routes>
}
