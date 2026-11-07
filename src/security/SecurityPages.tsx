import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../events/catalog-api'
import { listProfiles, listProfileVersions, readPermissionCatalog, readProfile, readProfileVersion } from './security-api'
import './security.css'

export const securityRoute = (denominationId: string) => `/seguranca/denominacoes/${denominationId}`
const scopeName = (scope: string) => ({ CHURCH: 'Igreja', DENOMINATION: 'Denominação' }[scope] ?? scope)
const statusName = (status: string) => ({ ACTIVE: 'Ativo', ENABLED: 'Ativo', DISABLED: 'Desativado', LEGACY_REVIEW: 'Legado em revisão', DRAFT: 'Rascunho', PUBLISHED: 'Publicada', LEGACY_SNAPSHOT: 'Registro legado' }[status] ?? status)
type State<T> = { kind: 'loading' } | { kind: 'ready'; data: T } | { kind: 'error'; message: string }
export function useRead<T>(context: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; state: State<T> } | null>(null)
  const key = JSON.stringify([context, attempt])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    load(controller.signal)
      .then(data => { if (active) setResult({ key, state: { kind: 'ready', data } }) })
      .catch(error => { if (active) setResult({ key, state: { kind: 'error', message: error instanceof ApiError ? error.message : 'Não foi possível carregar os dados administrativos. Tente novamente.' } }) })
    return () => { active = false; controller.abort() }
  }, [key, load])
  return { state: result?.key === key ? result.state : { kind: 'loading' } as State<T>, refresh: () => setAttempt(value => value + 1) }
}
export function ReadResult<T>({ query, label, children }: { query: ReturnType<typeof useRead<T>>; label: string; children: (data: T) => ReactNode }) {
  if (query.state.kind === 'loading') return <p role="status" aria-busy="true">Carregando {label}…</p>
  return <><button onClick={query.refresh}>Atualizar {label}</button>{query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : children(query.state.data)}</>
}
export function Pagination({ page, total, setPage, label }: { page: number; total: number; setPage: (page: number) => void; label: string }) {
  return <nav className="security-actions" aria-label={label}>
    <button disabled={page === 0} onClick={() => setPage(page - 1)}>Página anterior</button>
    <button disabled={page >= 100000 || (page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>Próxima página</button>
  </nav>
}
function PermissionCatalog({ denominationId }: { denominationId: string }) {
  const load = useCallback((signal: AbortSignal) => readPermissionCatalog(denominationId, signal), [denominationId])
  const query = useRead(denominationId, load)
  return <><p>Disponibilidade no catálogo técnico não concede permissão à sua conta nem atribui perfis.</p>
    <ReadResult query={query} label="catálogo de permissões">{data => data.permissions.length ? <ul className="security-list">{data.permissions.map(permission => <li key={permission.code}>
      <h2>{permission.code}</h2><p>{permission.available ? 'Disponível no catálogo' : 'Indisponível no catálogo'}</p>
      <p>Recurso: {scopeName(permission.resourceType)}</p><p>Escopos compatíveis: {permission.scopeTypes.map(scopeName).join(', ') || 'Nenhum'}</p>
      <p>Introduzida em: {permission.introducedIn}</p>
    </li>)}</ul> : <p>Nenhuma permissão no catálogo técnico.</p>}</ReadResult>
  </>
}
function Profiles({ denominationId }: { denominationId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listProfiles(denominationId, page, signal), [denominationId, page])
  const query = useRead(JSON.stringify([denominationId, page]), load)
  return <ReadResult query={query} label="perfis">{data => <>
    <p><Link to={`${securityRoute(denominationId)}/perfis/novo`}>Criar perfil de acesso</Link></p>
    <p role="status">Página {page + 1} · {data.total} perfis.</p>
    {data.items.length ? <ul className="security-list">{data.items.map(profile => <li key={profile.id}>
      <h2>{profile.name}</h2><p>Código: {profile.code}</p><p>Escopo: {scopeName(profile.scopeType)}</p><p>Estado: {statusName(profile.status)}</p>
      <Link to={`${securityRoute(denominationId)}/perfis/${profile.id}`}>Consultar perfil {profile.name}</Link>
    </li>)}</ul> : <p>Nenhum perfil nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos perfis"/>
  </>}</ReadResult>
}
function VersionHistory({ denominationId, profileId }: { denominationId: string; profileId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listProfileVersions(denominationId, profileId, page, signal), [denominationId, profileId, page])
  const query = useRead(JSON.stringify([denominationId, profileId, page]), load)
  return <section className="security-panel" aria-labelledby="profile-history-title"><h2 id="profile-history-title">Histórico de versões</h2>
    <ReadResult query={query} label="histórico de perfis">{data => <>
      <p role="status">Página {page + 1} · {data.total} versões.</p>
      {data.items.length ? <ol className="security-list">{data.items.map(version => <li key={version.id}>
        <h3>Versão {version.versionNumber} · {version.name}</h3><p>Estado: {statusName(version.status)}</p>
        <Link to={`${securityRoute(denominationId)}/perfis/${profileId}/versoes/${version.id}`}>Consultar versão {version.versionNumber}</Link>
      </li>)}</ol> : <p>Nenhuma versão no histórico.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das versões do perfil"/>
    </>}</ReadResult>
  </section>
}
function ProfileDetails({ denominationId, profileId }: { denominationId: string; profileId: string }) {
  const load = useCallback((signal: AbortSignal) => readProfile(denominationId, profileId, signal), [denominationId, profileId])
  const query = useRead(JSON.stringify([denominationId, profileId]), load)
  return <ReadResult query={query} label="perfil">{profile => <>
    <h2>{profile.name}</h2><p>Código: {profile.code}</p><p>Escopo: {scopeName(profile.scopeType)}</p><p>Estado: {statusName(profile.status)}</p>
    <p><Link to={`${securityRoute(denominationId)}/perfis/${profile.id}/gerenciar`}>Gerenciar perfil</Link></p>
    {profile.publishedVersionId ? <p><Link to={`${securityRoute(denominationId)}/perfis/${profile.id}/versoes/${profile.publishedVersionId}`}>Consultar versão publicada de referência</Link></p> : <p>Este perfil não possui versão publicada de referência.</p>}
    <p>Consultar ou publicar um perfil não o atribui a nenhuma pessoa.</p>
    <VersionHistory denominationId={denominationId} profileId={profileId}/>
  </>}</ReadResult>
}
function VersionDetails({ denominationId, profileId, versionId }: { denominationId: string; profileId: string; versionId: string }) {
  const load = useCallback((signal: AbortSignal) => readProfileVersion(denominationId, profileId, versionId, signal), [denominationId, profileId, versionId])
  const query = useRead(JSON.stringify([denominationId, profileId, versionId]), load)
  return <ReadResult query={query} label="versão do perfil">{version => <>
    <h2>Versão {version.versionNumber} · {version.name}</h2><p>Estado: {statusName(version.status)}</p>
    <p>Criada em <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>
    {version.publishedAt && <p>Publicada em <time dateTime={version.publishedAt}>{new Date(version.publishedAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>}
    <h3>Permissões registradas nesta versão</h3><p>Este snapshot preserva o histórico, inclusive códigos retirados do catálogo. Não representa autorização efetiva da conta.</p>
    {version.permissionCodes.length ? <ul className="security-codes">{version.permissionCodes.map(code => <li key={code}>{code}</li>)}</ul> : <p>Nenhuma permissão registrada nesta versão.</p>}
  </>}</ReadResult>
}
export default function SecurityPages({ view }: { view: 'catalog' | 'profiles' | 'profile' | 'version' }) {
  const { denominationId = '', profileId = '', versionId = '' } = useParams()
  const { account } = useAuth()
  const valid = isUuid(denominationId) && (view === 'catalog' || view === 'profiles' || isUuid(profileId)) && (view !== 'version' || isUuid(versionId))
  const title = { catalog: 'Catálogo técnico de permissões', profiles: 'Perfis de acesso', profile: 'Detalhes do perfil', version: 'Versão do perfil' }[view]
  return <><h1 data-page-title={title}>{title}</h1><Link to="/conta">Voltar à minha conta</Link>
    {!valid ? <p role="alert">O acesso administrativo é inválido. Abra novamente o acesso da sua denominação.</p> :
      <ResourceAccess permissionCode="security:profile:manage" resourceType="DENOMINATION" resourceId={denominationId}>
        <nav className="security-actions" aria-label="Segurança da denominação"><Link to={`${securityRoute(denominationId)}/perfis`}>Perfis de acesso</Link><Link to={`${securityRoute(denominationId)}/permissoes`}>Catálogo técnico de permissões</Link>
          {view === 'version' && <Link to={`${securityRoute(denominationId)}/perfis/${profileId}`}>Voltar ao perfil</Link>}
        </nav>
        <div key={`${account?.id}:${denominationId}:${profileId}:${versionId}:${view}`}>
          {view === 'catalog' ? <PermissionCatalog denominationId={denominationId}/> : view === 'profiles' ? <Profiles denominationId={denominationId}/>
            : view === 'profile' ? <ProfileDetails denominationId={denominationId} profileId={profileId}/> : <VersionDetails denominationId={denominationId} profileId={profileId} versionId={versionId}/>}
        </div>
      </ResourceAccess>}
  </>
}
