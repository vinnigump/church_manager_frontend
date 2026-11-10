import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth'
import { ResourceAccess, type AuthorizationQuery } from './authorization'
import { ContextOperation } from './components/ContextOperation'
import { isUuid } from './validation'

export interface AuthorizedResource {
  resourceType: AuthorizationQuery['resourceType']
  resourceId: string
  label: string
}

// self-authorization-contexts-v1 1.0.0: complete snapshot, never partial options.
export async function discoverResources(signal?: AbortSignal): Promise<AuthorizedResource[]> {
  const data = await api.request<unknown>('/accounts/me/authorization/contexts', { signal })
  const invalid = () => new Error('Não foi possível validar os recursos autorizados.')
  if (typeof data !== 'object' || data === null || Object.keys(data).length !== 1 || !('contexts' in data) || !Array.isArray(data.contexts)) throw invalid()
  const seen = new Set<string>()
  return data.contexts.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || Object.keys(item).length !== 3 || !('resourceType' in item) || !('resourceId' in item) || !('label' in item)
      || (item.resourceType !== 'CHURCH' && item.resourceType !== 'DENOMINATION') || typeof item.resourceId !== 'string' || !isUuid(item.resourceId)
      || typeof item.label !== 'string' || item.label.length === 0) throw invalid()
    const key = `${item.resourceType}:${item.resourceId.toLowerCase()}`
    if (seen.has(key)) throw invalid()
    seen.add(key)
    return { resourceType: item.resourceType, resourceId: item.resourceId, label: item.label }
  })
}

function ResourceLinks({ resource }: { resource: AuthorizedResource }) {
  const { resourceType, resourceId } = resource
  const links = resourceType === 'CHURCH' ? [
    ['EVENT_VIEW', `/eventos/igrejas/${resourceId}/catalogo`, 'Catálogo de eventos'],
    ['EVENT_VIEW', `/eventos/igrejas/${resourceId}/ocorrencias`, 'Ocorrências administrativas'],
    ['EVENT_CALENDAR_MANAGE', `/eventos/igrejas/${resourceId}/calendarios`, 'Calendário anual'],
  ] : [
    ['EVENT_TEMPLATE_MANAGE', `/eventos/denominacoes/${resourceId}/catalogo`, 'Templates de eventos'],
    ['security:profile:manage', `/seguranca/denominacoes/${resourceId}/perfis`, 'Perfis de acesso'],
    ['security:assignment:manage', `/seguranca/denominacoes/${resourceId}/atribuicoes`, 'Atribuições de acesso'],
    ['security:audit:read', `/seguranca/denominacoes/${resourceId}/auditoria`, 'Auditoria'],
  ]
  return <li><h3>{resource.label}</h3><p>{resourceType === 'CHURCH' ? 'Igreja' : 'Denominação'}</p>
    {links.map(([permissionCode, to, label]) => <ResourceAccess key={to} permissionCode={permissionCode} resourceType={resourceType} resourceId={resourceId} optional>
      <p><Link to={to}>{label}</Link></p>
    </ResourceAccess>)}
  </li>
}

export default function AuthorizedResources() {
  const { account } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const load = useCallback((_id: string, signal: AbortSignal) => discoverResources(signal), [])
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  if (!account) return null
  return <section aria-labelledby="authorized-resources-title">
    <h2 id="authorized-resources-title">Recursos autorizados</h2>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>Atualizar acessos</button>
    <ResourceSnapshot key={attempt} account={account} load={load}/>
  </section>
}

function ResourceSnapshot({ account, load }: { account: object; load: (id: string, signal: AbortSignal) => Promise<AuthorizedResource[]> }) {
  // A new session object invalidates work even when the same account logs in again.
  const operation = useCallback((id: string, signal: AbortSignal) => load(id, signal), [account, load])
  return <ContextOperation contextId="authorized-resources" operation={operation}>{state => {
    if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando recursos autorizados…</p>
    if (state.kind === 'error') return <p role="alert">Não foi possível carregar os recursos autorizados. Atualize os acessos para tentar novamente.</p>
    return state.data.length ? <ul>{state.data.map(resource => <ResourceLinks key={`${resource.resourceType}:${resource.resourceId}`} resource={resource}/>)}</ul>
      : <p role="status">Nenhum recurso autorizado disponível.</p>
  }}</ContextOperation>
}
