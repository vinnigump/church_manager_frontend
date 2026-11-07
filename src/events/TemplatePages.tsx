import { useEffect, useState } from 'react'
import { TemplateCreationForm, TemplateCreationResult, useTemplateCreation, type TemplateCreation } from './TemplateCreation'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { securityRoute } from '../security/SecurityPages'
import { isUuid, listDenominationCatalog, type EventTypePage } from './catalog-api'
import { listTemplateHistory, readTemplate, type EventTemplate, type TemplateHistory, type TemplateVersion } from './template-api'
import { TemplateActions, useTemplateMutation, type TemplateMutation } from './TemplateManagement'
import './events.css'

type Result<T> = { key: string } & ({ kind: 'ready'; data: T } | { kind: 'error'; message: string })
const catalogRoute = (id: string) => `/eventos/denominacoes/${id}/catalogo`
const statusLabel = { DRAFT: 'Rascunho', PUBLISHED: 'Publicado', DISCONTINUED: 'Descontinuado' }
const message = (error: unknown) => error instanceof ApiError ? error.message : 'Não foi possível carregar os dados. Tente novamente.'

function Pagination({ page, size, total, onChange, label, disabled = false }: { page: number; size: number; total: number; onChange: (page: number) => void; label: string; disabled?: boolean }) {
  return <nav className="catalog-pagination" aria-label={label}>
    <button disabled={disabled || page === 0} onClick={() => onChange(page - 1)}>Página anterior</button>
    <button disabled={disabled || page >= 100000 || (page + 1) * size >= total} onClick={() => onChange(page + 1)}>Próxima página</button>
  </nav>
}

function DenominationCatalog({ denominationId, creation }: { denominationId: string; creation: TemplateCreation }) {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<EventTypePage> | null>(null)
  const { revision, acknowledgeRead, failureGeneration } = creation
  const key = JSON.stringify([denominationId, page, attempt, revision])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const generation = failureGeneration.current
    listDenominationCatalog(denominationId, page, controller.signal).then(data => {
      if (!active) return
      const lastPage = Math.max(0, Math.ceil(data.total / data.size) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      acknowledgeRead(generation)
      setResult({ key, kind: 'ready', data })
    }).catch(error => { if (active) setResult({ key, kind: 'error', message: message(error) }) })
    return () => { active = false; controller.abort() }
  }, [denominationId, page, attempt, revision, key, acknowledgeRead, failureGeneration])
  if (!result || result.key !== key) return <p role="status" aria-busy="true">Carregando templates…</p>
  return <>
    <button disabled={creation.busy} onClick={() => setAttempt(value => value + 1)}>Atualizar catálogo</button>
    {result.kind === 'error' ? <p role="alert">{result.message}</p> : <>
      <p role="status">Página {page + 1} · {result.data.total} templates no catálogo.</p>
      {result.data.items.length === 0 ? <p>Nenhum template no catálogo.</p> : <ul className="event-list">{result.data.items.map(item => <li key={item.id}>
        <h2>{item.name}</h2><p>Origem denominacional · obrigatório para as igrejas vinculadas</p>
        <Link to={`/eventos/denominacoes/${denominationId}/templates/${item.id}`}>Consultar versões de {item.name}</Link>
      </li>)}</ul>}
      <Pagination page={page} size={result.data.size} total={result.data.total} onChange={setPage} label="Páginas do catálogo denominacional" disabled={creation.busy}/>
    </>}
  </>
}

function VersionDetails({ version }: { version: TemplateVersion }) {
  return <><h3>Versão {version.number} · {version.name}</h3><p>Estado da versão: {statusLabel[version.status]}</p>
    <p>Criada em <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>
    {version.publishedAt && <p>Publicada em <time dateTime={version.publishedAt}>{new Date(version.publishedAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>}
  </>
}

function DenominationCatalogWorkspace({ denominationId }: { denominationId: string }) {
  const creation = useTemplateCreation(denominationId)
  return <ResourceAccess permissionCode="EVENT_TEMPLATE_MANAGE" resourceType="DENOMINATION" resourceId={denominationId}>
    <ResourceAccess permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId} optional><Link to={`${securityRoute(denominationId)}/atribuicoes`}>Atribuições de acesso da denominação</Link></ResourceAccess>
    <ResourceAccess permissionCode="security:profile:manage" resourceType="DENOMINATION" resourceId={denominationId} optional><Link to={`${securityRoute(denominationId)}/perfis`}>Perfis de acesso da denominação</Link></ResourceAccess>
    <TemplateCreationResult denominationId={denominationId} creation={creation}/>
    <TemplateCreationForm creation={creation}/>
    <DenominationCatalog denominationId={denominationId} creation={creation}/>
  </ResourceAccess>
}

function VersionHistory({ denominationId, typeId, publishedVersionId }: { denominationId: string; typeId: string; publishedVersionId: string | null }) {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<TemplateHistory> | null>(null)
  const key = JSON.stringify([denominationId, typeId, page, attempt])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    listTemplateHistory(denominationId, typeId, page, controller.signal).then(data => {
      if (!active) return
      const lastPage = Math.max(0, Math.ceil(data.total / data.size) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setResult({ key, kind: 'ready', data })
    }).catch(error => { if (active) setResult({ key, kind: 'error', message: message(error) }) })
    return () => { active = false; controller.abort() }
  }, [denominationId, typeId, page, attempt, key])
  return <section className="events-panel" aria-labelledby="template-history-title"><h2 id="template-history-title">Histórico de versões</h2>
    <p>Versões publicadas são imutáveis. Ocorrências existentes preservam sua versão anterior.</p>
    {!result || result.key !== key ? <p role="status" aria-busy="true">Carregando histórico…</p> : <>
      <button onClick={() => setAttempt(value => value + 1)}>Atualizar histórico</button>
      {result.kind === 'error' ? <p role="alert">{result.message}</p> : <>
        <p role="status">Página {page + 1} · {result.data.total} versões.</p>
        {result.data.items.length === 0 ? <p>Nenhuma versão no histórico.</p> : <ol className="event-list">{result.data.items.map(version => <li key={version.id}><VersionDetails version={version}/>{version.id === publishedVersionId && <p>Versão publicada de referência na última consulta do template.</p>}</li>)}</ol>}
        <Pagination page={page} size={result.data.size} total={result.data.total} onChange={setPage} label="Páginas do histórico"/>
      </>}
    </>}
  </section>
}

function TemplateDetails({ denominationId, typeId, mutation }: { denominationId: string; typeId: string; mutation: TemplateMutation }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<EventTemplate> | null>(null)
  const { revision } = mutation
  const key = JSON.stringify([denominationId, typeId, attempt, revision])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    readTemplate(denominationId, typeId, controller.signal)
      .then(data => { if (active) setResult({ key, kind: 'ready', data }) })
      .catch(error => { if (active) setResult({ key, kind: 'error', message: message(error) }) })
    return () => { active = false; controller.abort() }
  }, [denominationId, typeId, attempt, revision, key])
  if (!result || result.key !== key) return <p role="status" aria-busy="true">Carregando template…</p>
  return <>
    <button disabled={mutation.busy} onClick={() => { mutation.refresh(); setAttempt(value => value + 1) }}>Atualizar template</button>
    {result.kind === 'error' ? <p role="alert">{result.message}</p> : <>
      <h2>Estado do template: {statusLabel[result.data.status]}</h2>
      {result.data.status === 'DISCONTINUED' && <p>Este template não está disponível para novas ocorrências. Seu histórico foi preservado.</p>}
      <section className="events-panel" aria-labelledby="template-draft-title"><h2 id="template-draft-title">Rascunho atual</h2>
        {result.data.draft ? <VersionDetails version={result.data.draft}/> : <p>Não há rascunho atual.</p>}
      </section>
      <TemplateActions key={`${result.data.revision}:${result.data.draft?.id}:${result.data.draft?.revision}`} template={result.data} mutation={mutation}/>
      <VersionHistory key={`${attempt}:${revision}`} denominationId={denominationId} typeId={typeId} publishedVersionId={result.data.publishedVersionId}/>
    </>}
  </>
}

export function DenominationCatalogPage() {
  const { denominationId = '' } = useParams()
  const { account } = useAuth()
  return <><h1 data-page-title="Catálogo denominacional">Catálogo denominacional de eventos</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(denominationId) ? <p role="alert">O acesso ao catálogo é inválido. Abra novamente o acesso da sua denominação.</p> :
      <DenominationCatalogWorkspace key={`${account?.id}:${denominationId}`} denominationId={denominationId}/>}
  </>
}

export function TemplateHistoryPage() {
  const { denominationId = '', typeId = '' } = useParams()
  const { account } = useAuth()
  return <><h1 data-page-title="Versões do template">Versões do template de evento</h1>
    {!isUuid(denominationId) || !isUuid(typeId) ? <p role="alert">O acesso ao template é inválido. Abra novamente o catálogo da sua denominação.</p> : <>
      <Link to={catalogRoute(denominationId)}>Voltar ao catálogo denominacional</Link>
      <TemplateWorkspace key={`${account?.id}:${denominationId}:${typeId}`} denominationId={denominationId} typeId={typeId}/>
    </>}
  </>
}

function TemplateWorkspace({ denominationId, typeId }: { denominationId: string; typeId: string }) {
  const mutation = useTemplateMutation(denominationId)
  return <ResourceAccess permissionCode="EVENT_TEMPLATE_MANAGE" resourceType="DENOMINATION" resourceId={denominationId}>
    {mutation.message && <p role={mutation.failed ? 'alert' : 'status'}>{mutation.message}</p>}
    <TemplateDetails denominationId={denominationId} typeId={typeId} mutation={mutation}/>
  </ResourceAccess>
}
