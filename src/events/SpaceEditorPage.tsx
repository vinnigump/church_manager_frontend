import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { ReadResult, useRead } from '../security/SecurityPages'
import { editableOccurrence, readOccurrence, type Occurrence } from './occurrence-api'
import { readOccurrenceSpace, saveOccurrenceSpace, validateSpaceWrite, type OccurrenceSpace } from './planning-api'
import './planning.css'

interface Snapshot { occurrence: Occurrence; space: OccurrenceSpace }
interface Draft { snapshot: Snapshot; code: string; name: string }
interface Control { draft: Draft | null; initialize: (value: Snapshot) => void; change: (field: 'code' | 'name', value: string) => void; busy: boolean; blocked: boolean; submit: (e: FormEvent) => void }
function SpaceEditorRecords({ churchId, occurrenceId, control }: { churchId: string; occurrenceId: string; control: Control }) {
  const { initialize } = control
  const load = useCallback(async (signal: AbortSignal) => {
    const [occurrence, space] = await Promise.all([readOccurrence(churchId, occurrenceId, signal), readOccurrenceSpace(churchId, occurrenceId, signal)])
    if (occurrence.revision !== space.revision) throw new Error('Revisão mudou durante a consulta.')
    const snapshot = { occurrence, space }
    if (!signal.aborted) initialize(snapshot)
    return snapshot
  }, [churchId, occurrenceId, initialize])
  const query = useRead(`${churchId}:${occurrenceId}`, load)
  if (query.state.kind !== 'ready') return <ReadResult query={query} label="espaço do rascunho">{() => null}</ReadResult>
  const current = query.state.data
  if (!editableOccurrence(current.occurrence)) return <p role="alert">Somente rascunhos sem marco de primeira publicação permitem configurar espaço por esta tela.</p>
  const draft = control.draft
  if (!draft) return <p role="status">Preparando espaço…</p>
  const stale = current.space.revision !== draft.snapshot.space.revision
  return <>{stale && <p role="alert">A revisão da ocorrência mudou. Recarregue e descarte as alterações locais antes de salvar o espaço.</p>}
    <form onSubmit={control.submit}><fieldset disabled={control.busy || control.blocked || stale}><legend>Espaço do rascunho</legend>
      <p>Código estável e exato dentro da igreja. MAIN e main são espaços distintos; o nome não define identidade. Esta tela não cadastra locais.</p>
      <label>Código do espaço<input maxLength={64} value={draft.code} onChange={e => control.change('code', e.target.value)}/></label>
      <label>Nome de exibição (opcional)<input maxLength={180} value={draft.name} onChange={e => control.change('name', e.target.value)}/></label>
      <p>Nome exige código; espaços nas extremidades do nome serão removidos. Deixar ambos vazios remove o espaço e retorna “A definir”. Não significa disponibilidade.</p>
      <p>Revisão compartilhada da ocorrência: {draft.snapshot.space.revision}. Salvar reavalia o planejamento no servidor, sem reservar ou publicar.</p>
      <button type="submit">Salvar espaço do rascunho</button>
    </fieldset></form>
  </>
}
function SpaceWorkspace({ churchId, occurrenceId }: { churchId: string; occurrenceId: string }) {
  // Keep dirty fields, original revision and command lock across focus/guard remounts.
  const [draft, setDraft] = useState<Draft | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const initialize = useCallback((snapshot: Snapshot) => setDraft(d => d ?? { snapshot, code: snapshot.space.code ?? '', name: snapshot.space.name ?? '' }), [])
  const change = (field: 'code' | 'name', value: string) => setDraft(d => d && ({ ...d, [field]: value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || pending.current || blocked || saved) return
    let input
    try { input = validateSpaceWrite({ code: draft.code === '' ? null : draft.code, name: draft.name === '' ? null : draft.name }) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Revise o espaço.'); return }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try {
      const result = await saveOccurrenceSpace(churchId, draft.snapshot.occurrence, draft.snapshot.space, input, controller.signal)
      if (!controller.signal.aborted) { setSaved(true); setMessage(`Espaço salvo. Nenhuma reserva ou publicação foi realizada.${result.conflicts === null ? ' A avaliação de sobreposições não foi disponibilizada; consulte novamente com permissão de leitura.' : ' Consulte a avaliação atualizada do planejamento.'}`) }
    } catch (error) {
      if (!controller.signal.aborted) { setBlocked(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a alteração do espaço.'} Recarregue e confira os dados antes de nova tentativa.`) }
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <ResourceAccess key={attempt} permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={churchId}>
      {message && <p role={saved ? 'status' : 'alert'}>{message}</p>}{busy && <p role="status" aria-busy="true">Salvando espaço…</p>}
      {saved ? <Link to={`/eventos/igrejas/${churchId}/ocorrencias/${occurrenceId}/planejamento`}>Consultar planejamento atualizado</Link> : <>
        <button disabled={busy} onClick={() => { setDraft(null); setBlocked(false); setMessage(''); setAttempt(v => v + 1) }}>Recarregar espaço e descartar alterações locais</button>
        <SpaceEditorRecords key={attempt} churchId={churchId} occurrenceId={occurrenceId} control={{ draft, initialize, change, busy, blocked, submit }}/>
      </>}
    </ResourceAccess>
  </ResourceAccess>
}
export default function SpaceEditorPage() {
  const { churchId = '', occurrenceId = '' } = useParams()
  const { account } = useAuth()
  return <div className="planning"><h1 data-page-title="Configurar espaço do rascunho">Configurar espaço do rascunho</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) || !isUuid(occurrenceId) ? <p role="alert">O acesso ao espaço é inválido. Abra novamente o acesso autorizado da ocorrência.</p> : <>
      <p><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${occurrenceId}`}>Voltar à ocorrência</Link></p>
      <SpaceWorkspace key={`${account?.id}:${churchId}:${occurrenceId}`} churchId={churchId} occurrenceId={occurrenceId}/>
    </>}
  </div>
}
