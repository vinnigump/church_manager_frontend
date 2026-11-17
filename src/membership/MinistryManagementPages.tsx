import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess, consultAuthorization } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { createDepartment, enableMinistry, localMinistries, ministryCatalog, ministryDepartments, ministryManagePermission, renameDepartment, type Department } from './ministry-management-api'
function Access() {
  const load = useCallback(async (signal: AbortSignal) => {
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const permissions = await Promise.all(churches.map(v => consultAuthorization({ permissionCode: ministryManagePermission, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)))
    return churches.filter((_v, i) => permissions[i])
  }, [])
  const query = useRead('ministry-management-access', load)
  return <ReadResult query={query} label="acessos à gestão">{items => items.length ? <ul>{items.map(v => <li key={v.resourceId}><Link to={`/ministerios/estrutura/igrejas/${v.resourceId}`}>Organizar ministérios de {v.label}</Link></li>)}</ul> : <p>Nenhuma igreja disponível para organizar ministérios.</p>}</ReadResult>
}
function Workspace({ church }: { church: string }) {
  const [page, setPage] = useState(0), [catalogPage, setCatalogPage] = useState(0), [departmentPage, setDepartmentPage] = useState(0), [epoch, setEpoch] = useState(0)
  const [ministry, setMinistry] = useState(''), [name, setName] = useState(''), [editing, setEditing] = useState<Department | null>(null), [rename, setRename] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback(async (signal: AbortSignal) => {
    const [locals, catalog, departments] = await Promise.all([localMinistries(church, page, signal), ministryCatalog(church, catalogPage, signal), ministry ? ministryDepartments(church, ministry, departmentPage, signal) : Promise.resolve(null)])
    return { locals, catalog, departments }
  }, [church, page, catalogPage, ministry, departmentPage])
  const query = useRead(JSON.stringify([church, page, catalogPage, ministry, departmentPage, epoch]), load)
  async function command(operation: (signal: AbortSignal) => Promise<unknown>, success?: () => void) {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { await operation(controller.signal); if (!controller.signal.aborted) { success?.(); setMessage('Alteração confirmada.'); setEpoch(v => v + 1) } }
    catch { if (!controller.signal.aborted) { setBlocked(true); setMessage('Não foi possível confirmar a alteração. Consulte novamente antes de repetir; a operação pode ter sido registrada.') } }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function refresh() { if (pending.current) return; setBlocked(false); setEditing(null); setRename(''); setEpoch(v => v + 1) }
  return <><p>Habilite ministérios do catálogo da denominação e organize seus departamentos. A gestão de integrantes fica na consulta de ministérios.</p>
    {message && <p role="status">{message}</p>}<button disabled={busy} onClick={refresh}>Consultar novamente</button>
    {query.state.kind === 'loading' ? <p role="status">Carregando ministérios…</p> : query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : <fieldset disabled={busy}>
      <legend>Estrutura da igreja</legend><h2>Catálogo da denominação</h2>
      {query.state.data.catalog.items.length ? <ul>{query.state.data.catalog.items.map(v => <li key={v.id}>{v.name} · {v.areaName} {v.localId ? <span>Já habilitado</span> : <button disabled={blocked} onClick={() => void command(signal => enableMinistry(church, v.id, signal))}>Habilitar {v.name}</button>}</li>)}</ul> : <p>Nenhum ministério disponível no catálogo.</p>}
      <Pagination page={catalogPage} total={query.state.data.catalog.total} setPage={setCatalogPage} label="Páginas do catálogo de ministérios"/>
      <h2>Ministérios da igreja</h2>{query.state.data.locals.items.length ? <ul>{query.state.data.locals.items.map(v => <li key={v.id}>{v.name} · {v.status === 'ACTIVE' ? 'Ativo' : 'Inativo'} <button onClick={() => { setMinistry(v.id); setDepartmentPage(0); setEditing(null) }}>Departamentos de {v.name}</button></li>)}</ul> : <p>Nenhum ministério habilitado.</p>}
      <Pagination page={page} total={query.state.data.locals.total} setPage={setPage} label="Páginas dos ministérios da igreja"/>
      {ministry && query.state.data.departments && <section><h2>Departamentos</h2>
        <form onSubmit={e => { e.preventDefault(); void command(signal => createDepartment(church, ministry, requestId, name, signal), () => { setRequestId(crypto.randomUUID()); setName('') }) }}><fieldset disabled={blocked}><legend>Criar departamento</legend><label>Nome<input required maxLength={160} value={name} onChange={e => setName(e.target.value)}/></label><button>Criar departamento</button></fieldset></form>
        {query.state.data.departments.items.length ? <ul>{query.state.data.departments.items.map(v => <li key={v.id}>{v.name} · {v.status === 'ACTIVE' ? 'Ativo' : 'Inativo'} <button disabled={blocked} onClick={() => { setEditing(v); setRename(v.name) }}>Editar {v.name}</button></li>)}</ul> : <p>Nenhum departamento neste ministério.</p>}
        <Pagination page={departmentPage} total={query.state.data.departments.total} setPage={setDepartmentPage} label="Páginas dos departamentos"/>
        {editing && <form onSubmit={e => { e.preventDefault(); void command(signal => renameDepartment(church, editing, rename, signal), () => { setEditing(null); setRename('') }) }}><fieldset disabled={blocked}><legend>Editar departamento</legend><label>Nome<input required maxLength={160} value={rename} onChange={e => setRename(e.target.value)}/></label><button>Salvar nome</button></fieldset></form>}
      </section>}
    </fieldset>}
  </>
}
export default function MinistryManagementPages({ directory = false }: { directory?: boolean }) {
  const { churchId = '' } = useParams(), { account } = useAuth(), [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <section key={`${scope.epoch}:${churchId}`}><h1>Organizar ministérios</h1><Link to="/ministerios">Voltar a Ministérios</Link>
    {!directory ? <Access/> : !isUuid(churchId) ? <p role="alert">Igreja inválida.</p> : <ResourceAccess permissionCode={ministryManagePermission} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><Workspace church={churchId}/></ResourceAccess>}
  </section>
}
