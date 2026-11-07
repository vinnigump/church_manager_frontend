import { useCallback, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { auditResources, isAuditResource, listAudit, type AuditFilters, type AuditResource } from './audit-api'
import { instant } from './security-api'
import { Pagination, ReadResult, useRead } from './SecurityPages'

const labels: Record<AuditResource, string> = { ACCESS_ROLE: 'Perfil', USER_ROLE_ASSIGNMENT: 'Atribuição', ACCESS_ROLE_DELEGATION: 'Fonte de delegação', EVENT_TYPE: 'Tipo de evento', EVENT_OCCURRENCE: 'Ocorrência', EVENT_ATTENDANCE: 'Presença', EVENT_CALENDAR: 'Calendário', AUDIT_LOG: 'Recusas administrativas de consulta e gestão' }
function utc(value: string) {
  if (!value) return undefined
  const result = `${value.length === 16 ? `${value}:00` : value}Z`
  if (!instant(result)) throw new Error('Informe datas válidas em UTC.')
  return result
}
function Workspace({ denominationId, resourceType, resourceId }: { denominationId: string; resourceType?: AuditResource; resourceId?: string }) {
  const [type, setType] = useState<AuditResource | ''>(resourceType ?? '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<AuditFilters>({ resourceType, resourceId })
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listAudit(denominationId, filters, page, signal), [denominationId, filters, page])
  const query = useRead(JSON.stringify([denominationId, filters, page]), load)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const start = utc(from), end = utc(to)
      if (start && end && Date.parse(start) >= Date.parse(end)) throw new Error('O fim exclusivo deve ser posterior ao início inclusivo.')
      setError(''); setPage(0); setFilters({ resourceType: resourceType ?? (type || undefined), resourceId, from: start, to: end })
    } catch (error) { setError(error instanceof Error ? error.message : 'Revise o intervalo.') }
  }
  return <><p>Consulta de metadados estruturados. Conteúdo legado livre e detalhes sensíveis não fazem parte desta resposta. Cada consulta autorizada registra uma tentativa de leitura no servidor; isso não comprova recebimento pelo cliente.</p>
    {resourceId && <p>Recurso selecionado: {labels[resourceType!]} · {resourceId}</p>}
    <form onSubmit={submit}>
      <label htmlFor="audit-type">Tipo de recurso</label><select id="audit-type" value={type} disabled={resourceType !== undefined} onChange={event => setType(event.target.value as AuditResource | '')}>
        <option value="">Tipos de domínio (sem recusas administrativas)</option>{auditResources.map(value => <option key={value} value={value}>{labels[value]}</option>)}
      </select>
      <label htmlFor="audit-from">Início inclusivo (UTC)</label><input id="audit-from" type="datetime-local" step="1" value={from} onChange={event => setFrom(event.target.value)}/>
      <label htmlFor="audit-to">Fim exclusivo (UTC)</label><input id="audit-to" type="datetime-local" step="1" value={to} onChange={event => setTo(event.target.value)}/>
      <p>Digite os horários em UTC. Deixe os campos vazios para não limitar o período.</p>
      <p>Recusas administrativas exigem seleção explícita do tipo e aplicação do filtro. A consulta padrão preserva os sete tipos de domínio.</p>
      {error && <p role="alert">{error}</p>}<button>Aplicar filtros de auditoria</button>
    </form>
    {filters.resourceType === 'AUDIT_LOG' && <p role="note">Esta consulta inclui apenas recusas tipadas de consulta de auditoria e do acesso inicial à gestão central de perfis e atribuições/delegações. Não representa todas as recusas do sistema; ausência de registros não comprova ausência de tentativas.</p>}
    <ReadResult query={query} label="auditoria">{data => <>
      <p role="status">Página {page + 1} · {data.total} registros.</p>
      {data.items.length ? <ol className="security-list">{data.items.map(entry => <li key={entry.id}>
        <h2>{entry.action}</h2><p>Resultado: {entry.outcome === 'SUCCESS' ? 'Sucesso' : 'Negado'}</p>
        <p>Ocorrido em <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>
        <p>Identificador do ator: {entry.actorUserId}</p><p>Tipo de recurso: {labels[entry.resourceType]}</p>
        <p>Identificador do recurso: {entry.resourceId ?? 'Não informado'}</p><p>Identificador do registro: {entry.id}</p>
      </li>)}</ol> : <p>Nenhum registro de auditoria nesta página e filtros.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas da auditoria"/>
    </>}</ReadResult>
  </>
}
export default function AuditPage() {
  const { denominationId = '', resourceType, resourceId } = useParams()
  const { account } = useAuth()
  const valid = isUuid(denominationId) && (resourceType === undefined ? resourceId === undefined : isAuditResource(resourceType) && resourceId !== undefined && isUuid(resourceId))
  return <><h1 data-page-title="Auditoria de segurança">Auditoria de segurança</h1><Link to="/conta">Voltar à minha conta</Link>
    {!valid ? <p role="alert">O acesso administrativo é inválido.</p> : <ResourceAccess permissionCode="security:audit:read" resourceType="DENOMINATION" resourceId={denominationId}>
      <Workspace key={`${account?.id}:${denominationId}:${resourceType ?? ''}:${resourceId ?? ''}`} denominationId={denominationId} resourceType={resourceType as AuditResource | undefined} resourceId={resourceId}/>
    </ResourceAccess>}
  </>
}
