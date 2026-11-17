import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { listPeople } from './people-directory-api'
import { personEditPermission } from './person-edit-api'
import '../events/occurrences.css'
const read = 'identity:person:contextual:read', create = 'identity:person:contextual:create'
function Access() {
  const { account } = useAuth(), [epoch, setEpoch] = useState(0)
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const decisions = await Promise.all(churches.map(async v => {
      const query = (permissionCode: string) => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)
      const [canRead, canCreate] = await Promise.all([query(read), query(create)])
      return { ...v, canRead, canCreate }
    }))
    return decisions.filter(v => v.canRead || v.canCreate)
  }, [account])
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  return <><button onClick={() => setEpoch(v => v + 1)}>Atualizar acessos a Pessoas</button>
    <ContextOperation key={epoch} contextId="people-access" operation={load}>{s => s.kind === 'loading' ? <p role="status">Carregando igrejas…</p>
      : s.kind === 'error' ? <p role="alert">Não foi possível confirmar seus acessos.</p>
        : s.data.length ? <ul className="event-list">{s.data.map(v => <li key={v.resourceId}><h2>{v.label}</h2>
          {v.canRead && <p><Link to={`/pessoas/igrejas/${v.resourceId}`}>Consultar pessoas de {v.label}</Link></p>}
          {v.canCreate && <Link to={`/pessoas/igrejas/${v.resourceId}/cadastrar`}>Cadastrar pessoa em {v.label}</Link>}
        </li>)}</ul> : <p>Nenhuma igreja disponível para consultar ou cadastrar pessoas.</p>}</ContextOperation>
  </>
}
function Directory({ church }: { church: string }) {
  const [canEdit, setCanEdit] = useState(false)
  useEffect(() => { const controller = new AbortController(); void consultAuthorization({ permissionCode: personEditPermission, resourceType: 'CHURCH', resourceId: church }, controller.signal).then(v => { if (!controller.signal.aborted) setCanEdit(v) }).catch(() => { if (!controller.signal.aborted) setCanEdit(false) }); return () => controller.abort() }, [church])
  const [field, setField] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listPeople(church, search, page, signal), [church, search, page])
  const query = useRead(JSON.stringify([church, search, page]), load)
  return <><ResourceAccess permissionCode={create} resourceType="CHURCH" resourceId={church} optional>
    <p><Link to={`/pessoas/igrejas/${church}/cadastrar`}>Cadastrar pessoa</Link></p>
  </ResourceAccess><form onSubmit={e => { e.preventDefault(); setSearch(field); setPage(0) }}>
    <label>Pesquisar pelo nome<input type="search" maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar</button>
  </form><ReadResult query={query} label="pessoas">{data => <><p role="status">{data.total} pessoas · Página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(p => <li key={p.id}><h2>{p.preferredName?.trim() || p.fullName}</h2>
      {p.preferredName?.trim() && <p>{p.fullName}</p>}
      <p>{p.status === 'ACTIVE' ? 'Cadastro ativo' : p.status === 'INACTIVE' ? 'Cadastro inativo' : `Situação registrada: ${p.status}`}</p>
      <p>{p.membershipStatus === 'ACTIVE' ? 'Membresia ativa nesta igreja' : p.membershipStatus === 'SUSPENDED' ? 'Membresia suspensa nesta igreja' : 'Sem membresia ativa ou suspensa nesta igreja'}</p>
      {canEdit && p.status !== 'MERGED' && <Link to={`/pessoas/igrejas/${church}/${p.id}/editar`}>Editar dados de {p.preferredName?.trim() || p.fullName}</Link>}
    </li>)}</ul> : <p>Nenhuma pessoa encontrada.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das pessoas"/>
  </>}</ReadResult></>
}
export default function PeopleDirectoryPages({ directory = false }: { directory?: boolean }) {
  const { churchId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <div className="occurrences"><h1 data-page-title="Pessoas">Pessoas</h1>
    <p><Link to="/pessoas/primeiro-acesso">Gerar link de primeiro acesso</Link></p>
    {directory && <Link to="/pessoas">Voltar às igrejas</Link>}
    {!directory ? <Access/> : !isUuid(churchId) ? <p role="alert">Igreja inválida. Escolha novamente seu acesso.</p> : <div key={`${scope.epoch}:${churchId}`}>
      <ResourceAccess permissionCode={read} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><Directory church={churchId}/></ResourceAccess>
    </div>}
  </div>
}
