import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { discoverResources } from '../AuthorizedResources'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { addChurchGroupUser, groupManagementRoute, listChurchGroups, listChurchGroupUsers, readChurchGroup, saveChurchGroup, searchGroupAccounts, type AccountOption, type ChurchGroup } from './church-groups-api'
import '../events/occurrences.css'

const permission = 'CHURCH_GROUP_MANAGE'
function ScopedRead<T>({ context, load, label, children }: { context: string; load: (signal: AbortSignal) => Promise<T>; label: string; children: (value: T) => ReactNode }) {
  const query = useRead(context, load)
  return <ReadResult query={query} label={label}>{children}</ReadResult>
}
function Access() {
  const { account } = useAuth(), [epoch, setEpoch] = useState(0)
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const allowed = await Promise.all(churches.map(v => consultAuthorization({ permissionCode: permission, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)))
    return churches.filter((_v, i) => allowed[i])
  }, [account])
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  return <><button onClick={() => setEpoch(v => v + 1)}>Atualizar acessos aos grupos</button>
    <ContextOperation key={epoch} contextId="church-groups-access" operation={load}>{s => s.kind === 'loading' ? <p role="status">Carregando igrejas…</p>
      : s.kind === 'error' ? <p role="alert">Não foi possível confirmar seus acessos aos grupos.</p>
        : s.data.length ? <ul className="event-list">{s.data.map(v => <li key={v.resourceId}><h2>{v.label}</h2><Link to={groupManagementRoute(v.resourceId)}>Grupos de {v.label}</Link></li>)}</ul>
          : <p>Nenhuma igreja disponível para sua gestão de grupos.</p>}</ContextOperation>
  </>
}
function List({ church }: { church: string }) {
  const [field, setField] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listChurchGroups(church, search, page, signal), [church, search, page])
  const query = useRead(JSON.stringify([church, search, page]), load)
  return <><p><Link to={`${groupManagementRoute(church)}/novo`}>Criar grupo</Link></p>
    <form onSubmit={e => { e.preventDefault(); setSearch(field); setPage(0) }}><label>Pesquisar grupo<input type="search" maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar</button></form>
    <ReadResult query={query} label="grupos">{data => <><p role="status">{data.total} grupos · Página {page + 1}</p>
      {data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}><h2>{v.name}</h2><p>{v.description}</p><Link to={`${groupManagementRoute(church)}/${v.id}`}>Ver grupo {v.name}</Link></li>)}</ul> : <p>Nenhum grupo encontrado.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos grupos"/></>}</ReadResult>
  </>
}
function useCommand() {
  const pending = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  useEffect(() => () => pending.current?.abort(), [])
  async function run<T>(operation: (signal: AbortSignal) => Promise<T>, success: (value: T) => void) {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { const value = await operation(controller.signal); if (!controller.signal.aborted) success(value) }
    catch (error) { if (!controller.signal.aborted) { setBlocked(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a gravação.'} Confira os dados antes de repetir; a operação pode ter sido salva.`) } }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reset() { if (!pending.current) { setBlocked(false); setMessage('') } }
  return { run, reset, busy, blocked, message, setMessage }
}
function Editor({ church, id }: { church: string; id?: string }) {
  const [draft, setDraft] = useState<{ before: ChurchGroup | null; name: string; description: string } | null>(null)
  const [epoch, setEpoch] = useState(0), [saved, setSaved] = useState<ChurchGroup | null>(null), [validation, setValidation] = useState('')
  const command = useCommand()
  const load = useCallback(async (signal: AbortSignal) => {
    const before = id ? await readChurchGroup(church, id, signal) : null
    if (!signal.aborted) setDraft(v => v ?? { before, name: before?.name ?? '', description: before?.description ?? '' })
    return before
  }, [church, id])
  return <ResourceAccess permissionCode={permission} resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
    {command.message && <p role="alert">{command.message}</p>}{validation && <p role="alert">{validation}</p>}
    {saved ? <><p role="status">Grupo salvo.</p><Link to={`${groupManagementRoute(church)}/${saved.id}`}>Ver grupo salvo</Link></> : <>
      <button disabled={command.busy} onClick={() => { command.reset(); setDraft(null); setValidation(''); setEpoch(v => v + 1) }}>Descartar alterações e recarregar</button>
      <ScopedRead context={`${church}:${id}:${epoch}`} load={load} label="cadastro do grupo">{current => {
        if (!draft) return null
        const stale = current !== null && current.revision !== draft.before?.revision
        return <>{stale && <p role="alert">O grupo mudou. Recarregue antes de salvar.</p>}
          <form onSubmit={e => { e.preventDefault(); if (stale) return; if (!draft.name.trim()) { setValidation('Informe o nome do grupo.'); return } void command.run(signal => saveChurchGroup(church, draft.name, draft.description, draft.before, signal), setSaved) }}>
            <fieldset disabled={command.busy || command.blocked || stale}><legend>Dados do grupo</legend>
              <label>Nome do grupo<input required maxLength={180} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
              <label>Descrição<textarea maxLength={2000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label>
              <button>Salvar grupo</button>
            </fieldset>
          </form></>
      }}</ScopedRead></>}
  </ResourceAccess>
}
function AccountPicker({ church, select, disabled }: { church: string; select: (v: AccountOption) => void; disabled: boolean }) {
  const [field, setField] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => searchGroupAccounts(church, search, page, signal), [church, search, page])
  const query = useRead(JSON.stringify([church, search, page]), load)
  return <section aria-label="Selecionar usuário"><h3>Selecionar usuário</h3>
    <form onSubmit={e => { e.preventDefault(); setSearch(field); setPage(0) }}><label>Pesquisar usuário pelo nome<input maxLength={120} type="search" value={field} disabled={disabled} onChange={e => setField(e.target.value)}/></label><button disabled={disabled}>Buscar usuários</button></form>
    <ReadResult query={query} label="usuários disponíveis">{data => <>
      {data.items.length ? <ul>{data.items.map(v => <li key={v.accountId}>{v.displayName} <button type="button" disabled={disabled} onClick={() => select(v)}>Selecionar {v.displayName}</button></li>)}</ul> : <p>Nenhum usuário disponível com estes filtros.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas de usuários"/>
    </>}</ReadResult>
  </section>
}
function Detail({ church, id }: { church: string; id: string }) {
  const [page, setPage] = useState(0), [epoch, setEpoch] = useState(0), [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<AccountOption | null>(null), [before, setBefore] = useState<ChurchGroup | null>(null)
  const [success, setSuccess] = useState(''), command = useCommand()
  const load = useCallback(async (signal: AbortSignal) => {
    const group = await readChurchGroup(church, id, signal), members = await listChurchGroupUsers(church, id, page, signal)
    if (!signal.aborted) setBefore(v => v ?? group)
    return { group, members }
  }, [church, id, page])
  return <ResourceAccess permissionCode={permission} resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
    {command.message && <p role="alert">{command.message}</p>}{success && <p role="status">{success}</p>}
    <button disabled={command.busy} onClick={() => { command.reset(); setBefore(null); setSelected(null); setSuccess(''); setEpoch(v => v + 1) }}>Atualizar grupo e conferir integrantes</button>
    <ScopedRead context={`${church}:${id}:${page}:${epoch}`} load={load} label="grupo e integrantes">{({ group, members }) => {
      const stale = before !== null && before.revision !== group.revision
      return <><h2>{group.name}</h2><p>{group.description}</p><p><Link to={`${groupManagementRoute(church)}/${id}/editar`}>Editar grupo</Link></p>
        <h3>Integrantes</h3>{members.items.length ? <ul>{members.items.map(v => <li key={v.id}>{v.displayName}</li>)}</ul> : <p>Este grupo ainda não tem integrantes.</p>}
        <Pagination page={page} total={members.total} setPage={setPage} label="Páginas de integrantes"/>
        {stale && <p role="alert">O grupo mudou. Atualize os dados antes de adicionar alguém.</p>}
        <button disabled={command.busy || command.blocked || stale} onClick={() => setAdding(v => !v)}>{adding ? 'Fechar seleção de usuários' : 'Adicionar integrante'}</button>
        {adding && <AccountPicker church={church} select={setSelected} disabled={command.busy || command.blocked || stale}/>}
        {selected && before && <section><p>Adicionar {selected.displayName} ao grupo {group.name}?</p>
          <button disabled={command.busy || command.blocked || stale} onClick={() => void command.run(signal => addChurchGroupUser(before, selected, signal), value => {
            setSuccess(value.changed ? 'Integrante incluído.' : 'O usuário já faz parte do grupo.'); setSelected(null); setAdding(false); setBefore(null); setEpoch(v => v + 1)
          })}>Confirmar inclusão</button>
        </section>}
        <p>Exclusão de grupos e remoção de integrantes ainda não estão disponíveis nesta versão.</p>
      </>
    }}</ScopedRead>
  </ResourceAccess>
}
export default function ChurchGroupPages({ view }: { view: 'churches' | 'list' | 'create' | 'edit' | 'detail' }) {
  const { churchId = '', groupId = '' } = useParams(), { account } = useAuth()
  const [session, setSession] = useState({ account, epoch: 0 })
  if (session.account !== account) { setSession({ account, epoch: session.epoch + 1 }); return null }
  const valid = view === 'churches' || isUuid(churchId) && (view === 'list' || view === 'create' || isUuid(groupId))
  return <div className="occurrences"><h1 data-page-title="Grupos">Grupos</h1><p>Grupos de trabalho independentes de ministérios e departamentos.</p>
    <nav aria-label="Navegação dos grupos"><Link to="/ministerios">Ministérios</Link>{view !== 'churches' && <Link to="/grupos">Igrejas</Link>}{valid && view !== 'churches' && <Link to={groupManagementRoute(churchId)}>Todos os grupos</Link>}</nav>
    {!valid ? <p role="alert">Acesso inválido. Escolha novamente uma igreja e um grupo.</p> : <div key={`${session.epoch}:${churchId}:${groupId}:${view}`}>
      {view === 'churches' ? <Access/> : view === 'list' ? <ResourceAccess permissionCode={permission} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><List church={churchId}/></ResourceAccess>
        : view === 'detail' ? <Detail church={churchId} id={groupId}/> : <Editor church={churchId} id={view === 'edit' ? groupId : undefined}/>}
    </div>}
  </div>
}
