import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { discoverResources } from '../AuthorizedResources'
import { consultAuthorization } from '../authorization'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import GroupAccess from './GroupAccess'
import { groupRoute, type GroupKind } from './group-api'
import { listManagedUnits } from './managed-units-api'
import '../events/occurrences.css'

function ChurchAccess() {
  const { account } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    if (!account) return []
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const allowed = await Promise.all(churches.map(async v => {
      const query = (permissionCode: string) => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)
      return await query('GROUP_MEMBERSHIP_MANAGE') || await query('GROUP_MEMBERSHIP_MANAGE_LED')
    }))
    return churches.filter((_v, i) => allowed[i])
  }, [account])
  useEffect(() => { const refresh = () => setAttempt(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  if (!account) return null
  return <><button type="button" onClick={() => setAttempt(v => v + 1)}>Atualizar acessos aos ministérios</button>
    <ContextOperation key={attempt} contextId="ministry-access" operation={load}>{state => {
      if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando igrejas para gestão de ministérios…</p>
      if (state.kind === 'error') return <p role="alert">Não foi possível confirmar seus acessos. Tente atualizar.</p>
      return state.data.length ? <ul className="event-list">{state.data.map(v => <li key={v.resourceId}><h2>{v.label}</h2>
        <Link to={`/ministerios/igrejas/${v.resourceId}`}>Ministérios de {v.label}</Link>
      </li>)}</ul> : <p role="status">Você ainda não tem acesso à gestão de ministérios de uma igreja.</p>
    }}</ContextOperation>
  </>
}
function Directory({ church }: { church: string }) {
  const [search, setSearch] = useState(''), [kind, setKind] = useState<GroupKind | ''>(''), [page, setPage] = useState(0)
  const [applied, setApplied] = useState({ search: '', kind: '' as GroupKind | '' })
  const load = useCallback((signal: AbortSignal) => listManagedUnits(church, applied.search, applied.kind, page, signal), [church, applied, page])
  const query = useRead(JSON.stringify([church, applied, page]), load)
  return <><form aria-label="Pesquisar ministérios e departamentos" onSubmit={e => { e.preventDefault(); setPage(0); setApplied({ search, kind }) }}>
    <label>Pesquisar pelo nome<input type="search" maxLength={120} value={search} onChange={e => setSearch(e.target.value)}/></label>
    <label>Mostrar<select value={kind} onChange={e => setKind(e.target.value as GroupKind | '')}><option value="">Ministérios e departamentos</option><option value="MINISTRY">Ministérios</option><option value="DEPARTMENT">Departamentos</option></select></label>
    <button type="submit">Pesquisar</button>
  </form><ReadResult query={query} label="ministérios e departamentos">{data => <>
    <p role="status">{data.total} resultados · Página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}>
      <h2>{v.name}</h2><p>{v.kind === 'MINISTRY' ? 'Ministério' : `Departamento de ${v.ministryName}`} · {v.active ? 'Ativo' : 'Inativo'}</p>
      {!v.active && <p>Unidade inativa: consulte os vínculos e seu histórico.</p>}
      <Link to={groupRoute({ churchId: church, kind: v.kind, groupId: v.id })}>Consultar integrantes de {v.name}</Link>
    </li>)}</ul> : <p>Nenhum ministério ou departamento disponível para sua gestão com estes filtros.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos ministérios e departamentos"/>
  </>}</ReadResult></>
}
export default function MinistryPages({ directory = false }: { directory?: boolean }) {
  const { churchId = '' } = useParams(), { account } = useAuth()
  const [session, setSession] = useState({ account, epoch: 0 })
  if (session.account !== account) { setSession({ account, epoch: session.epoch + 1 }); return null }
  return <div className="occurrences"><h1 data-page-title="Ministérios">Ministérios</h1>
    <p><Link to="/grupos">Gerenciar grupos de trabalho</Link></p>
    <p><Link to="/ministerios/escalas">Gerenciar escalas de atuação</Link></p>
    <p>Consulte os ministérios, departamentos e vínculos que você pode gerenciar.</p>
    {directory ? <><Link to="/ministerios">Voltar às igrejas</Link>
      {!isUuid(churchId) ? <p role="alert">Igreja inválida. Escolha novamente uma igreja.</p> : <div key={`${session.epoch}:${churchId}`}>
        <GroupAccess churchId={churchId}><Directory church={churchId}/></GroupAccess>
      </div>}</> : <ChurchAccess/>}
  </div>
}
