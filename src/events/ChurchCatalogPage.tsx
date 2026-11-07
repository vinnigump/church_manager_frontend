import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ResourceAccess } from '../authorization'
import { ApiError } from '../api'
import { isUuid, listChurchCatalog, type EventTypePage } from './catalog-api'
import { useAuth } from '../auth'
import { ActionAccess, CatalogCards, CreateLocalTypeForm, LocalMutationResult, useLocalTypeMutation, type LocalTypeMutation } from './LocalTypeManagement'
import './events.css'
import './event-admin.css'

type CatalogLoad = { key: string } & ({ kind: 'ready'; data: EventTypePage } | { kind: 'error'; message: string })

function CatalogRecords({ churchId, mutation }: { churchId: string; mutation: LocalTypeMutation }) {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<CatalogLoad | null>(null)
  const { revision } = mutation
  const key = JSON.stringify([churchId, page, attempt, revision])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    listChurchCatalog(churchId, page, controller.signal)
      .then(data => {
        if (!active) return
        // O catálogo pode encolher após uma desabilitação ou alteração externa.
        // Reconsulta somente a última página válida; nunca repete uma escrita.
        const lastPage = Math.max(0, Math.ceil(data.total / data.size) - 1)
        if (page > lastPage) { setPage(lastPage); return }
        setResult({ key, kind: 'ready', data })
      })
      .catch(error => { if (active) setResult({ key, kind: 'error', message: error instanceof ApiError ? error.message : 'Não foi possível carregar o catálogo. Tente novamente.' }) })
    return () => { active = false; controller.abort() }
  }, [churchId, page, attempt, revision, key])

  if (!result || result.key !== key) return <p role="status" aria-busy="true">Carregando catálogo…</p>
  if (result.kind === 'error') return <><p role="alert">{result.message}</p><button disabled={mutation.busy} onClick={() => setAttempt(value => value + 1)}>Atualizar catálogo</button></>
  const { data } = result
  return <>
    <p role="status">Página {data.page + 1} · {data.total} tipos de evento no catálogo.</p>
    <button disabled={mutation.busy} onClick={() => setAttempt(value => value + 1)}>Atualizar catálogo</button>
    {data.items.length === 0 ? <p>Nenhum tipo de evento nesta página.</p> : <ActionAccess churchId={churchId} permissionCode="EVENT_EDIT" fallback={<CatalogCards items={data.items}/>}><CatalogCards items={data.items} mutation={mutation}/></ActionAccess>}
    <nav className="catalog-pagination" aria-label="Páginas do catálogo">
      <button disabled={mutation.busy || page === 0} onClick={() => setPage(value => value - 1)}>Página anterior</button>
      <button disabled={mutation.busy || page >= 100000 || (page + 1) * data.size >= data.total} onClick={() => setPage(value => value + 1)}>Próxima página</button>
    </nav>
  </>
}

function CatalogWorkspace({ churchId }: { churchId: string }) {
  const mutation = useLocalTypeMutation(churchId)
  return <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <ResourceAccess permissionCode="EVENT_CALENDAR_MANAGE" resourceType="CHURCH" resourceId={churchId} optional><Link to={`/eventos/igrejas/${churchId}/calendarios`}>Calendário anual administrativo</Link></ResourceAccess>
    <LocalMutationResult churchId={churchId} mutation={mutation}/>
    <ActionAccess churchId={churchId} permissionCode="EVENT_CREATE"><CreateLocalTypeForm mutation={mutation}/></ActionAccess>
    <CatalogRecords churchId={churchId} mutation={mutation}/>
  </ResourceAccess>
}

export default function ChurchCatalogPage() {
  const { churchId = '' } = useParams()
  const { account } = useAuth()
  return <div className="event-admin"><h1 data-page-title="Catálogo de eventos">Catálogo de eventos da igreja</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) ? <p role="alert">O acesso ao catálogo é inválido. Abra novamente o acesso da sua igreja.</p>
      : <CatalogWorkspace key={`${account?.id}:${churchId}`} churchId={churchId}/>}
  </div>
}
