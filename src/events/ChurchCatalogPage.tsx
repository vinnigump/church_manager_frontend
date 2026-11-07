import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ResourceAccess } from '../authorization'
import { ApiError } from '../api'
import { isUuid, listChurchCatalog, type EventTypePage } from './catalog-api'
import './events.css'

type CatalogLoad = { key: string } & ({ kind: 'ready'; data: EventTypePage } | { kind: 'error'; message: string })

function CatalogRecords({ churchId }: { churchId: string }) {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<CatalogLoad | null>(null)
  const key = JSON.stringify([churchId, page, attempt])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    listChurchCatalog(churchId, page, controller.signal)
      .then(data => { if (active) setResult({ key, kind: 'ready', data }) })
      .catch(error => { if (active) setResult({ key, kind: 'error', message: error instanceof ApiError ? error.message : 'Não foi possível carregar o catálogo. Tente novamente.' }) })
    return () => { active = false; controller.abort() }
  }, [churchId, page, attempt, key])

  if (!result || result.key !== key) return <p role="status" aria-busy="true">Carregando catálogo…</p>
  if (result.kind === 'error') return <><p role="alert">{result.message}</p><button onClick={() => setAttempt(value => value + 1)}>Atualizar catálogo</button></>
  const { data } = result
  return <>
    <p role="status">Página {data.page + 1} · {data.total} tipos de evento no catálogo.</p>
    {data.items.length === 0 ? <p>Nenhum tipo de evento nesta página.</p> : <ul className="event-list">{data.items.map(item => <li key={item.id}>
      <h2>{item.name}</h2><p>{item.scopeType === 'DENOMINATION' ? 'Origem denominacional' : 'Origem local'}</p>
      <p>{item.mandatory ? 'Obrigatório no catálogo' : 'Não obrigatório'}</p><p>{item.enabled ? 'Habilitado' : 'Desabilitado'}</p>
    </li>)}</ul>}
    <nav className="catalog-pagination" aria-label="Páginas do catálogo">
      <button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Página anterior</button>
      <button disabled={page >= 100000 || (page + 1) * data.size >= data.total} onClick={() => setPage(value => value + 1)}>Próxima página</button>
    </nav>
  </>
}

export default function ChurchCatalogPage() {
  const { churchId = '' } = useParams()
  return <><h1 data-page-title="Catálogo de eventos">Catálogo de eventos da igreja</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) ? <p role="alert">O acesso ao catálogo é inválido. Abra novamente o acesso da sua igreja.</p>
      : <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}><CatalogRecords key={churchId} churchId={churchId}/></ResourceAccess>}
  </>
}
