import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { ReadResult, useRead } from '../security/SecurityPages'
import { audienceCategories, readAudience, sameAudience, saveAudience, validateAudiencePolicy, type AudienceCategory, type AudiencePolicy, type AudienceView } from './audience-api'
import './occurrences.css'

const categoryLabel: Record<AudienceCategory, string> = { functionIds: 'Funções eclesiásticas', ministryIds: 'Ministérios', departmentIds: 'Departamentos' }
const visibilityLabel = { PUBLIC: 'Pública', CHURCH: 'Membros formais ativos da igreja', ELIGIBLE_AUDIENCE: 'Audiência elegível' }
interface Fields { visibility: string; churchLinkRequired: string; activeMembershipRequired: string; minimumAge: string; maximumAge: string; functionIds: string[]; ministryIds: string[]; departmentIds: string[] }
interface Draft { before: AudienceView; fields: Fields }
function fieldsFor(value: AudienceView): Fields {
  const p = value.policy
  return { visibility: p?.visibility ?? '', churchLinkRequired: p ? String(p.churchLinkRequired) : '', activeMembershipRequired: p ? String(p.activeMembershipRequired) : '',
    minimumAge: p?.minimumAge == null ? '' : String(p.minimumAge), maximumAge: p?.maximumAge == null ? '' : String(p.maximumAge), functionIds: p?.functionIds ?? [], ministryIds: p?.ministryIds ?? [], departmentIds: p?.departmentIds ?? [] }
}
function policyFor(fields: Fields) {
  for (const key of ['churchLinkRequired', 'activeMembershipRequired'] as const) if (!['true', 'false'].includes(fields[key])) throw new Error('Selecione explicitamente as exigências de vínculo e membresia.')
  for (const key of ['minimumAge', 'maximumAge'] as const) if (fields[key] !== '' && !/^\d+$/.test(fields[key])) throw new Error('Informe idade inteira ou deixe vazia para não limitar.')
  return validateAudiencePolicy({ ...fields, churchLinkRequired: fields.churchLinkRequired === 'true', activeMembershipRequired: fields.activeMembershipRequired === 'true', minimumAge: fields.minimumAge === '' ? null : Number(fields.minimumAge), maximumAge: fields.maximumAge === '' ? null : Number(fields.maximumAge) })
}
function useAudience(churchId: string, occurrenceId: string) {
  const [draft, setDraft] = useState<Draft | null>(null), [stale, setStale] = useState(false), [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [message, setMessage] = useState(''), [result, setResult] = useState<AudienceView | null>(null), [epoch, setEpoch] = useState(0)
  const draftRef = useRef<Draft | null>(null), sent = useRef(false), pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const observe = useCallback((view: AudienceView) => {
    if (!draftRef.current) { const next = { before: view, fields: fieldsFor(view) }; draftRef.current = next; setDraft(next) }
    else if (!sent.current && (draftRef.current.before.revision !== view.revision || !sameAudience(draftRef.current.before.policy, view.policy))) setStale(true)
  }, [])
  function change(fields: Fields) { if (!draftRef.current || pending.current || sent.current) return; const next = { ...draftRef.current, fields }; draftRef.current = next; setDraft(next) }
  async function run(before: AudienceView, policy: AudiencePolicy) {
    if (pending.current || sent.current || stale) return
    const controller = new AbortController(); pending.current = controller; sent.current = true; setAttempted(true); setBusy(true); setMessage('')
    try { const value = await saveAudience(churchId, occurrenceId, before, policy, controller.signal); if (!controller.signal.aborted) { setResult(value); setEpoch(v => v + 1) } }
    catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a configuração.'} O resultado pode ter sido gravado. Consulte os dados antes de outra tentativa.`) }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reload() { if (pending.current) return; draftRef.current = null; sent.current = false; setDraft(null); setStale(false); setAttempted(false); setMessage(''); setResult(null); setEpoch(v => v + 1) }
  return { draft, stale, busy, attempted, message, result, epoch, observe, change, run, reload }
}
type Control = ReturnType<typeof useAudience>
function Summary({ policy }: { policy: AudiencePolicy }) {
  return <><p>Visibilidade: {visibilityLabel[policy.visibility]} · vínculo com a igreja: {policy.churchLinkRequired ? 'exigido' : 'não exigido'} · membresia ativa: {policy.activeMembershipRequired ? 'exigida' : 'não exigida'}.</p>
    <p>Idade mínima inclusiva: {policy.minimumAge ?? 'sem limite'} · máxima inclusiva: {policy.maximumAge ?? 'sem limite'}.</p>
    {audienceCategories.map(category => <p key={category}>{categoryLabel[category]}: {policy[category].length ? policy[category].join(', ') : 'sem seleção restritiva nesta categoria'}.</p>)}
  </>
}
function Editor({ current, control }: { current: AudienceView; control: Control }) {
  const [confirmation, setConfirmation] = useState<AudiencePolicy | null>(null), [error, setError] = useState('')
  if (!control.draft || control.result) return null
  const { before, fields } = control.draft
  function change(name: keyof Fields, value: string | string[]) { control.change({ ...fields, [name]: value }); setConfirmation(null); setError('') }
  function review(event: FormEvent) {
    event.preventDefault(); if (control.stale || control.busy || control.attempted || before.revision !== current.revision) return
    try { setConfirmation(policyFor(fields)); setError('') } catch (error) { setConfirmation(null); setError(error instanceof Error ? error.message : 'Revise a política.') }
  }
  return <><form aria-label="Configuração explícita de audiência" onSubmit={review}><fieldset disabled={control.stale || control.busy || control.attempted}>
    <legend>Substituir política completa</legend>
    <label>Visibilidade<select required value={fields.visibility} onChange={e => change('visibility', e.target.value)}><option value="">Selecione explicitamente</option><option value="PUBLIC">Pública</option><option value="CHURCH">Membros formais ativos da igreja</option><option value="ELIGIBLE_AUDIENCE">Audiência elegível</option></select></label>
    <label>Exigir vínculo com a igreja<select required value={fields.churchLinkRequired} onChange={e => change('churchLinkRequired', e.target.value)}><option value="">Selecione explicitamente</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Exigir membresia formal ativa<select required value={fields.activeMembershipRequired} onChange={e => change('activeMembershipRequired', e.target.value)}><option value="">Selecione explicitamente</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Idade mínima inclusiva (vazia: sem limite)<input type="number" min="0" max="2147483647" step="1" value={fields.minimumAge} onChange={e => change('minimumAge', e.target.value)}/></label>
    <label>Idade máxima inclusiva (vazia: sem limite)<input type="number" min="0" max="2147483647" step="1" value={fields.maximumAge} onChange={e => change('maximumAge', e.target.value)}/></label>
    <p>Requisitos são combinados entre categorias; dentro de cada seleção, basta um dos valores. Visibilidade não é autorização de inscrição. Idade e vínculos da pessoa serão avaliados pelo servidor, não por este formulário.</p>
    <p>As referências abaixo vieram da política autorizada. É possível conservar ou remover uma seleção existente. A inclusão de novas referências depende de catálogos autorizados ainda indisponíveis; nenhum UUID precisa ser digitado.</p>
    {audienceCategories.map(category => <fieldset key={category}><legend>{categoryLabel[category]}</legend>
      {before.policy?.[category].length ? before.policy[category].map(id => <label key={id}><input type="checkbox" checked={fields[category].includes(id)} onChange={e => change(category, e.target.checked ? [...fields[category], id] : fields[category].filter(value => value !== id))}/>Manter {categoryLabel[category]} {id}</label>) : <p>Sem referências existentes nesta categoria.</p>}
      <p>Remover todas mantém esta categoria sem seleção restritiva; os outros requisitos continuam explícitos.</p>
    </fieldset>)}
    {error && <p role="alert">{error}</p>}<button>Revisar política de audiência</button>
  </fieldset></form>
    {confirmation && !control.stale && !control.attempted && before.revision === current.revision && <section aria-label="Confirmar política de audiência"><h2>Confirmar substituição na revisão {before.revision}</h2>
      <Summary policy={confirmation}/><p>Esta configuração não publica ocorrência ou calendário, não abre inscrições e não altera inscritos existentes, modalidade, modo de participação ou check-in.</p>
      <button disabled={control.busy} onClick={() => void control.run(before, confirmation)}>Confirmar política de audiência</button>{' '}<button disabled={control.busy} onClick={() => setConfirmation(null)}>Voltar sem gravar</button>
    </section>}
  </>
}
function Records({ churchId, occurrenceId, control }: { churchId: string; occurrenceId: string; control: Control }) {
  const { observe } = control
  const load = useCallback(async (signal: AbortSignal) => { const view = await readAudience(churchId, occurrenceId, signal); if (!signal.aborted) observe(view); return view }, [churchId, occurrenceId, observe])
  const query = useRead(`${churchId}:${occurrenceId}`, load)
  return <ReadResult query={query} label="audiência">{view => <>
    <h2>Política da ocorrência {view.occurrenceId}</h2><p>Revisão compartilhada consultada: {view.revision}.</p>
    {view.policy ? <Summary policy={view.policy}/> : <p>Política ainda não configurada. A ausência não significa visibilidade pública.</p>}
    <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={churchId} optional><Editor current={view} control={control}/></ResourceAccess>
  </>}</ReadResult>
}
function Workspace({ churchId, occurrenceId }: { churchId: string; occurrenceId: string }) {
  const control = useAudience(churchId, occurrenceId)
  return <ResourceAccess key={control.epoch} permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <button disabled={control.busy} onClick={control.reload}>Descartar tentativa e recarregar audiência</button>
    {control.stale && <p role="alert">A revisão da ocorrência mudou. Descarte o rascunho e recarregue antes de continuar; a revisão original não foi substituída.</p>}
    {control.busy && <p role="status" aria-busy="true">Confirmando política…</p>}{control.message && <p role="alert">{control.message}</p>}
    {control.result && <p role="status">Política confirmada pelo servidor na revisão {control.result.revision}. Nenhuma inscrição ou publicação foi criada por esta operação.</p>}
    <Records churchId={churchId} occurrenceId={occurrenceId} control={control}/>
  </ResourceAccess>
}
export default function AudiencePage() {
  const { churchId = '', occurrenceId = '' } = useParams(); const { account } = useAuth()
  return <div className="occurrences"><h1 data-page-title="Audiência da ocorrência">Audiência da ocorrência</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) || !isUuid(occurrenceId) ? <p role="alert">O acesso à audiência é inválido. Abra novamente o detalhe autorizado da ocorrência.</p> : <><p><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${occurrenceId}`}>Voltar à ocorrência</Link></p><Workspace key={`${account?.id}:${churchId}:${occurrenceId}`} churchId={churchId} occurrenceId={occurrenceId}/></>}
  </div>
}
