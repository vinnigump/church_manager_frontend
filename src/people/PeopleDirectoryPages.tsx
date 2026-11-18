import ItemLink from '../components/ItemLink'
import { DefaultChurchAccess } from '../church-context'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { listPeople } from './people-directory-api'
import { personEditPermission } from './person-edit-api'
import PeoplePageHeader from './PeoplePageHeader'
import './people.css'
const read = 'identity:person:contextual:read', create = 'identity:person:contextual:create'
function Access() {
  const [params] = useSearchParams(), creating = params.get('acao') === 'cadastrar'
  const { account } = useAuth(), [epoch, setEpoch] = useState(0)
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const decisions = await Promise.all(churches.map(async v => {
      const query = (permissionCode: string) => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)
      const [canRead, canCreate] = await Promise.all([query(read), query(create)])
      return { ...v, canRead, canCreate }
    }))
    return decisions.filter(v => creating ? v.canCreate : v.canRead || v.canCreate)
  }, [account, creating])
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  return <>
    <ContextOperation key={epoch} contextId="people-access" operation={load}>{s => s.kind === 'loading' ? <p role="status">Carregando igrejas…</p>
      : s.kind === 'error' ? <><p role="alert">Não foi possível confirmar seus acessos.</p><button onClick={() => setEpoch(v => v + 1)}>Tentar novamente</button></>
        : s.data.length ? <DefaultChurchAccess  options={s.data.map(v => ({ churchId: v.resourceId, path: !creating && v.canRead ? `/pessoas/igrejas/${v.resourceId}` : `/pessoas/igrejas/${v.resourceId}/cadastrar` }))}><ul className="people-church-list">{s.data.map(v => <li key={v.resourceId}><span className="people-card-eyebrow">Igreja</span><h2>{v.label}</h2>
          {!creating && v.canRead && <p><Link to={`/pessoas/igrejas/${v.resourceId}`}>Consultar pessoas de {v.label}</Link></p>}
          {v.canCreate && <Link to={`/pessoas/igrejas/${v.resourceId}/cadastrar`}>Cadastrar pessoa em {v.label}</Link>}
        </li>)}</ul></DefaultChurchAccess> : <p>Nenhuma igreja disponível para consultar ou cadastrar pessoas.</p>}</ContextOperation>
  </>
}
function Directory({ church }: { church: string }) {
  const [canEdit, setCanEdit] = useState(false)
  useEffect(() => { const controller = new AbortController(); void consultAuthorization({ permissionCode: personEditPermission, resourceType: 'CHURCH', resourceId: church }, controller.signal).then(v => { if (!controller.signal.aborted) setCanEdit(v) }).catch(() => { if (!controller.signal.aborted) setCanEdit(false) }); return () => controller.abort() }, [church])
  const [field, setField] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listPeople(church, search, page, signal), [church, search, page])
  const query = useRead(JSON.stringify([church, search, page]), load)
  return <><ResourceAccess permissionCode={create} resourceType="CHURCH" resourceId={church} optional>
    <div className="people-directory-actions"><Link className="people-primary-link" to={`/pessoas/igrejas/${church}/cadastrar`}>+ Cadastrar pessoa</Link></div>
  </ResourceAccess><section className="people-search-card"><h2>Consulta de pessoas</h2><p>Pesquise pelo nome para consultar os registros desta igreja.</p><form className="people-search-form" onSubmit={e => { e.preventDefault(); setSearch(field); setPage(0) }}>
    <label>Pesquisar pelo nome<input type="search" placeholder="Digite o nome da pessoa" maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar</button>
  </form></section><ReadResult query={query} label="pessoas">{data => <><p role="status">{data.total} pessoas · Página {page + 1}</p>
    {data.items.length ? <ul className="people-record-list">{data.items.map(p => <li key={p.id} className="navigation-card"><div className="people-avatar" aria-hidden="true">{(p.preferredName?.trim() || p.fullName).slice(0, 1).toLocaleUpperCase()}</div><div className="people-record-content"><h2>{p.preferredName?.trim() || p.fullName}</h2>
      {p.preferredName?.trim() && <p>{p.fullName}</p>}
      <p className="people-status">{p.status === 'ACTIVE' ? 'Cadastro ativo' : p.status === 'INACTIVE' ? 'Cadastro inativo' : `Situação registrada: ${p.status}`}</p>
      <p>{p.membershipStatus === 'ACTIVE' ? 'Membresia ativa nesta igreja' : p.membershipStatus === 'SUSPENDED' ? 'Membresia suspensa nesta igreja' : 'Sem membresia ativa ou suspensa nesta igreja'}</p>
      {canEdit && p.status !== 'MERGED' && <ItemLink to={`/pessoas/igrejas/${church}/${p.id}/editar`}>Editar dados de {p.preferredName?.trim() || p.fullName}</ItemLink>}</div>
    </li>)}</ul> : <p>Nenhuma pessoa encontrada.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das pessoas"/>
  </>}</ReadResult></>
}
export default function PeopleDirectoryPages({ directory = false }: { directory?: boolean }) {
  const { churchId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <div className="people-page"><PeoplePageHeader title="Pesquisa e Cadastro de Pessoa" description="Cadastre ou consulte pessoas da congregação. O registro reúne a identificação e os dados de contato, sem criar automaticamente conta de acesso ou membresia."><Link className="people-secondary-link" to="/pessoas/primeiro-acesso">Gerar link de primeiro acesso</Link></PeoplePageHeader>
    {directory && <Link className="people-back-link legacy-context-switch" to="/pessoas?selecionar=1">Trocar igreja</Link>}
    {!directory ? <Access/> : !isUuid(churchId) ? <p role="alert">Igreja inválida. Escolha novamente seu acesso.</p> : <div key={`${scope.epoch}:${churchId}`}>
      <ResourceAccess permissionCode={read} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><Directory church={churchId}/></ResourceAccess>
    </div>}
  </div>
}
