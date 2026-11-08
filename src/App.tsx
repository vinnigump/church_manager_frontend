import { Link, Route, Routes } from 'react-router-dom'
import { Guard } from './auth'
import LoginPage from './LoginPage'
import AccountPage from './AccountPage'
import HomePage from './HomePage'
import SignOutPage from './SignOutPage'
import EventsPage from './events/EventViews'
import GroupMembershipPages from './membership/GroupMembershipPages'
import AudiencePage from './events/AudiencePage'
import OccurrencePages from './events/OccurrencePages'
import PlanningPage from './events/PlanningPage'
import SpaceEditorPage from './events/SpaceEditorPage'
import AnnualCopyPage from './events/AnnualCopyPage'
import OccurrenceTransitionPage from './events/OccurrenceTransitionPage'
import OccurrenceTeamPage from './events/OccurrenceTeamPage'
import ChurchCatalogPage from './events/ChurchCatalogPage'
import AnnualCalendarPage from './events/AnnualCalendarPage'
import AnnualGenerationPage from './events/AnnualGenerationPage'
import SeriesPage from './events/SeriesPage'
import SecurityPages from './security/SecurityPages'
import AuditPage from './security/AuditPage'
import AppLayout from './components/AppLayout'
import AssignmentsPage from './security/AssignmentsPage'
import DelegationsPage from './security/DelegationsPage'
import DelegationRevokePage from './security/DelegationRevokePage'
import DelegatedAssignmentsPage from './security/DelegatedAssignmentsPage'
import PasswordPage from './PasswordPage'
import AssignmentRevokePage from './security/AssignmentRevokePage'
import ProfileManagementPage from './security/ProfileManagementPage'
import { DenominationCatalogPage, TemplateHistoryPage } from './events/TemplatePages'

export default function App() {
  return <Routes>
    <Route element={<AppLayout />}>
    <Route index element={<HomePage />}/>
    <Route path="entrar" element={<LoginPage />}/>
    <Route path="sair" element={<SignOutPage />}/>
    <Route element={<Guard />}>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes/:delegationId/revogar" element={<DelegationRevokePage />}/>
    <Route path="seguranca/denominacoes/:denominationId/auditoria" element={<AuditPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/auditoria/:resourceType/:resourceId" element={<AuditPage />}/>
    <Route path="seguranca/denominacoes/:denominationId/delegacoes/:delegationId/atribuicoes/:assignmentId/revogar" element={<AssignmentRevokePage delegated />}/>
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
    <Route path="igrejas/:churchId/grupos/:kind/:groupId/vinculos" element={<GroupMembershipPages />}/>
    <Route path="igrejas/:churchId/grupos/:kind/:groupId/vinculos/:membershipId" element={<GroupMembershipPages />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias" element={<OccurrencePages view="list" />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/nova" element={<OccurrencePages view="create" />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId" element={<OccurrencePages view="detail" />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId/editar" element={<OccurrencePages view="edit" />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId/transicoes/:action" element={<OccurrenceTransitionPage />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId/equipe" element={<OccurrenceTeamPage />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId/audiencia" element={<AudiencePage />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId/planejamento" element={<PlanningPage />}/>
    <Route path="eventos/igrejas/:churchId/ocorrencias/:occurrenceId/planejamento/espaco" element={<SpaceEditorPage />}/>
    <Route path="eventos/igrejas/:churchId/planejamento/copiar" element={<AnnualCopyPage />}/>
    <Route path="eventos/igrejas/:churchId/calendarios" element={<AnnualCalendarPage />}/>
    <Route path="eventos/igrejas/:churchId/planejamento/gerar" element={<AnnualGenerationPage />}/>
    <Route path="eventos/igrejas/:churchId/planejamento/series/:seriesId" element={<SeriesPage />}/>
    <Route path="eventos/igrejas/:churchId/calendarios/:year" element={<AnnualCalendarPage />}/>
    <Route path="eventos/igrejas/:churchId/catalogo" element={<ChurchCatalogPage />}/>
    <Route path="eventos/denominacoes/:denominationId/catalogo" element={<DenominationCatalogPage />}/>
    <Route path="eventos/denominacoes/:denominationId/templates/:typeId" element={<TemplateHistoryPage />}/>
    <Route element={<Guard permission="organization:manage" scope="global" />}>
    <Route path="admin" element={<h1>Administração</h1>}/></Route></Route>
    <Route path="*" element={<><h1>Página não encontrada</h1><Link to="/">Voltar ao início</Link></>}/></Route></Routes>
}
