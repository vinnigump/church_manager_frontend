import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../events/catalog-api'
import { copyProfileDraft, createProfile, publishProfile, readProfileDraft, replaceProfileDraft, setProfileActive, type ProfileCommandResult } from './profile-management-api'
import { readPermissionCatalog, readProfile, type PermissionCatalog, type ProfileVersionDetail, type SecurityProfile, type SecurityScope } from './security-api'
import { securityRoute } from './SecurityPages'
import './security.css'

type Operation = 'create' | 'copy' | 'edit' | 'publish' | 'deactivate' | 'reactivate'
function useProfileMutation() {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [result, setResult] = useState<ProfileCommandResult | null>(null)
  const [revision, setRevision] = useState(0)
  const request = useRef<AbortController | null>(null)
  const refreshRequired = useRef(false)
  const active = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort() } }, [])
  async function run(operation: Operation, execute: (signal: AbortSignal) => Promise<ProfileCommandResult>) {
    if (request.current || refreshRequired.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setMessage(''); setFailed(false); setResult(null)
    try {
      const value = await execute(controller.signal)
      if (!active.current) return
      setResult(value)
      setMessage({ create: 'Perfil criado em rascunho. Nenhuma atribuição foi criada.', copy: 'Novo rascunho criado. As permissões efetivas não foram alteradas.',
        edit: 'Rascunho salvo. As permissões efetivas não foram alteradas.', publish: value.status === 'DISABLED' ? 'Versão publicada. O perfil continua desativado.' : 'Versão publicada. O servidor passa a usá-la nas novas decisões de acesso.',
        deactivate: 'Perfil desativado. Versões e atribuições foram preservadas.', reactivate: 'Perfil reativado após validação pelo servidor.' }[operation])
      setRevision(value => value + 1)
    } catch (error) {
      if (active.current) {
        refreshRequired.current = true; setBlocked(true); setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500
          ? `${error.message} O servidor também protege o último acesso administrativo. Atualize os dados antes de tentar novamente.`
          : 'O resultado da alteração não pôde ser confirmado. Atualize os dados antes de tentar novamente.')
      }
    } finally { request.current = null; if (active.current) setBusy(false) }
  }
  function refresh() {
    if (request.current) return
    refreshRequired.current = false; setBlocked(false)
    if (failed) { setMessage(''); setFailed(false) }
    setRevision(value => value + 1)
  }
  return { busy, blocked, message, failed, result, revision, run, refresh }
}
type Mutation = ReturnType<typeof useProfileMutation>
interface ManagementData { catalog: PermissionCatalog; profile: SecurityProfile | null; draft: ProfileVersionDetail | null }
function PermissionPicker({ catalog, scope, selected, setSelected, disabled }: { catalog: PermissionCatalog; scope: string; selected: string[]; setSelected: (codes: string[]) => void; disabled: boolean }) {
  const choices = [...new Set([...catalog.permissions.filter(item => item.available && item.scopeTypes.includes(scope as SecurityScope)).map(item => item.code), ...selected])].sort()
  return <fieldset disabled={disabled} className="security-permissions"><legend>Permissões do perfil</legend>
    <p>Selecione somente permissões disponíveis e compatíveis com o escopo. Nenhuma atribuição é criada ao selecionar códigos.</p>
    {choices.length ? choices.map(code => {
      const permitted = catalog.permissions.some(item => item.code === code && item.available && item.scopeTypes.includes(scope as SecurityScope))
      const checked = selected.includes(code)
      return <label key={code}><input type="checkbox" checked={checked} disabled={!permitted && !checked} onChange={event => setSelected(event.target.checked ? [...selected, code] : selected.filter(value => value !== code))}/><span>{code}{!permitted && <small> — indisponível ou incompatível; remova antes de salvar ou publicar</small>}</span></label>
    }) : <p>Nenhuma permissão disponível neste escopo.</p>}
    {!selected.length && <p>Nenhuma permissão selecionada.</p>}
  </fieldset>
}
function ProfileControls({ denominationId, data, mutation }: { denominationId: string; data: ManagementData; mutation: Mutation }) {
  const id = useId()
  const { profile, draft, catalog } = data
  const [name, setName] = useState(draft?.name ?? '')
  const [code, setCode] = useState('')
  const [scope, setScope] = useState<SecurityScope>((profile?.scopeType as SecurityScope) ?? 'CHURCH')
  const [codes, setCodes] = useState<string[]>(draft?.permissionCodes ?? [])
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'publish' | 'deactivate' | 'reactivate' | null>(null)
  const creating = profile === null
  if (profile && (!['DRAFT', 'ACTIVE', 'DISABLED'].includes(profile.status) || !['CHURCH', 'DENOMINATION'].includes(profile.scopeType))) return <p>Este perfil legado ou de escopo não suportado exige tratamento administrativo específico. Nenhuma alteração está disponível nesta tela.</p>
  const disabled = mutation.busy || mutation.blocked
  const unsupported = codes.some(value => !catalog.permissions.some(item => item.code === value && item.available && item.scopeTypes.includes(scope)))
  const dirty = draft && (name.trim() !== draft.name || JSON.stringify([...codes].sort()) !== JSON.stringify([...draft.permissionCodes].sort()))
  function changed() { setError(''); setConfirm(null) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 160 || (creating && (!code.trim() || code.trim().length > 80)) || codes.length > 100 || unsupported) { setError('Revise nome, código e permissões disponíveis para o escopo.'); return }
    setError(''); setConfirm(null)
    if (creating) await mutation.run('create', signal => createProfile(denominationId, { code, scopeType: scope, name, permissionCodes: codes }, signal))
    else if (draft) await mutation.run('edit', signal => replaceProfileDraft(denominationId, profile, draft, { name, permissionCodes: codes }, signal))
  }
  return <>
    {profile && <><h2>{profile.name}</h2><p>Código: {profile.code} · Escopo: {profile.scopeType === 'CHURCH' ? 'Igreja' : 'Denominação'}</p><p>Estado atual: {{ DRAFT: 'Rascunho', ACTIVE: 'Ativo', DISABLED: 'Desativado' }[profile.status]}</p></>}
    {(creating || draft) && <section className="security-panel" aria-labelledby={`${id}-draft-title`}><h2 id={`${id}-draft-title`}>{creating ? 'Novo perfil com rascunho inicial' : `Editar rascunho da versão ${draft!.versionNumber}`}</h2>
      <p>Salvar um rascunho não publica permissões nem atribui o perfil a ninguém.</p>
      <form onSubmit={submit} aria-busy={mutation.busy}>
        {creating && <><label htmlFor={`${id}-code`}>Código do perfil</label><input id={`${id}-code`} required maxLength={80} disabled={disabled} value={code} onChange={event => { setCode(event.target.value); changed() }}/>
          <label htmlFor={`${id}-scope`}>Escopo do perfil</label><select id={`${id}-scope`} disabled={disabled} value={scope} onChange={event => { setScope(event.target.value as SecurityScope); changed() }}><option value="CHURCH">Igreja</option><option value="DENOMINATION">Denominação</option></select></>}
        <label htmlFor={`${id}-name`}>Nome do rascunho do perfil</label><input id={`${id}-name`} required maxLength={160} disabled={disabled} value={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setName(event.target.value); changed() }}/>
        <PermissionPicker catalog={catalog} scope={scope} selected={codes} setSelected={values => { setCodes(values); changed() }} disabled={disabled}/>
        {unsupported && <p role="alert">Há permissões indisponíveis ou incompatíveis selecionadas. Remova-as explicitamente antes de salvar ou publicar.</p>}
        {error && <p id={`${id}-error`} role="alert">{error}</p>}
        <button disabled={disabled || unsupported}>{creating ? 'Criar perfil em rascunho' : 'Salvar rascunho do perfil'}</button>
      </form>
    </section>}
    {profile && !draft && profile.publishedVersionId && <button disabled={disabled} onClick={() => { void mutation.run('copy', signal => copyProfileDraft(denominationId, profile, signal)) }}>Criar novo rascunho do perfil</button>}
    {profile && draft && <><p>{dirty ? 'Salve as alterações antes de publicar.' : 'A publicação usa o nome e as permissões salvos no rascunho.'}</p><button disabled={disabled || Boolean(dirty) || unsupported} onClick={() => setConfirm('publish')}>Publicar versão do perfil</button></>}
    {profile?.status === 'ACTIVE' && profile.publishedVersionId && <button disabled={disabled} onClick={() => setConfirm('deactivate')}>Desativar perfil</button>}
    {profile?.status === 'DISABLED' && profile.publishedVersionId && <button disabled={disabled} onClick={() => setConfirm('reactivate')}>Reativar perfil</button>}
    {confirm && profile && <div role="group" aria-label="Confirmar alteração do perfil">
      <p>{confirm === 'publish' ? `Publicar a versão ${draft?.versionNumber}: ${draft?.name}? Alterações passam a valer nas novas decisões de acesso. ${profile.status === 'DISABLED' ? 'O perfil continuará desativado até uma reativação explícita.' : 'A publicação não atribui o perfil a ninguém.'}`
        : confirm === 'deactivate' ? 'Desativar este perfil? Suas versões e atribuições serão preservadas, mas ele deixará de conceder permissões. O servidor protege o último acesso administrativo de recuperação.'
          : 'Reativar este perfil? Suas permissões publicadas poderão voltar a valer nas atribuições vigentes após validação pelo servidor.'}</p>
      {dirty && confirm !== 'publish' && <p>Alterações não salvas no rascunho serão descartadas desta tela.</p>}
      <button disabled={disabled || (confirm === 'publish' && (Boolean(dirty) || unsupported))} onClick={() => {
        if (confirm === 'publish' && draft) void mutation.run('publish', signal => publishProfile(denominationId, profile, draft, signal))
        else if (confirm !== 'publish') void mutation.run(confirm, signal => setProfileActive(denominationId, profile, confirm === 'reactivate', signal))
      }}>Confirmar {confirm === 'publish' ? 'publicação do perfil' : confirm === 'deactivate' ? 'desativação do perfil' : 'reativação do perfil'}</button>{' '}
      <button disabled={mutation.busy} onClick={() => setConfirm(null)}>Cancelar alteração</button>
    </div>}
  </>
}
function ManagementRecords({ denominationId, profileId, mutation }: { denominationId: string; profileId?: string; mutation: Mutation }) {
  const [state, setState] = useState<{ kind: 'ready'; data: ManagementData } | { kind: 'error'; message: string } | null>(null)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const loadDraft = profileId ? readProfileDraft(denominationId, profileId, controller.signal).catch(error => { if (error instanceof ApiError && error.status === 404) return null; throw error }) : Promise.resolve(null)
    Promise.all([readPermissionCatalog(denominationId, controller.signal), profileId ? readProfile(denominationId, profileId, controller.signal) : Promise.resolve(null), loadDraft])
      .then(([catalog, profile, draft]) => { if (active) setState({ kind: 'ready', data: { catalog, profile, draft } }) })
      .catch(error => { if (active) setState({ kind: 'error', message: error instanceof ApiError ? error.message : 'Não foi possível carregar os dados de gestão do perfil.' }) })
    return () => { active = false; controller.abort() }
  }, [denominationId, profileId])
  return <>
    <button disabled={mutation.busy} onClick={mutation.refresh}>Atualizar dados de gestão</button>
    {!state ? <p role="status" aria-busy="true">Carregando gestão do perfil…</p> : state.kind === 'error' ? <p role="alert">{state.message}</p>
      : <ProfileControls denominationId={denominationId} data={state.data} mutation={mutation}/>}
  </>
}
function ManagementWorkspace({ denominationId, profileId }: { denominationId: string; profileId?: string }) {
  const mutation = useProfileMutation()
  return <ResourceAccess key={mutation.revision} permissionCode="security:profile:manage" resourceType="DENOMINATION" resourceId={denominationId}>
    <nav className="security-actions" aria-label="Gestão de perfis"><Link to={`${securityRoute(denominationId)}/perfis`}>Voltar aos perfis</Link>{profileId && <Link to={`${securityRoute(denominationId)}/perfis/${profileId}`}>Consultar perfil</Link>}</nav>
    {mutation.message && <p role={mutation.failed ? 'alert' : 'status'}>{mutation.message}</p>}
    {mutation.busy && <p role="status">Salvando alteração do perfil…</p>}
    {!profileId && mutation.result && <p><Link to={`${securityRoute(denominationId)}/perfis/${mutation.result.profileId}`}>Abrir perfil criado</Link></p>}
    <ManagementRecords denominationId={denominationId} profileId={profileId} mutation={mutation}/>
  </ResourceAccess>
}
export default function ProfileManagementPage({ create = false }: { create?: boolean }) {
  const { denominationId = '', profileId = '' } = useParams()
  const { account } = useAuth()
  const valid = isUuid(denominationId) && (create || isUuid(profileId))
  const title = create ? 'Criar perfil de acesso' : 'Gerenciar perfil de acesso'
  return <><h1 data-page-title={title}>{title}</h1><Link to="/conta">Voltar à minha conta</Link>
    {!valid ? <p role="alert">O acesso à gestão do perfil é inválido. Abra novamente o acesso da sua denominação.</p>
      : <ManagementWorkspace key={`${account?.id}:${denominationId}:${profileId}:${create}`} denominationId={denominationId} profileId={create ? undefined : profileId}/>}
  </>
}
