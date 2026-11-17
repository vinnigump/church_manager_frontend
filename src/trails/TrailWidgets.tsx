import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../api'
import { Pagination, useRead } from '../security/SecurityPages'
import { options, type Kind, type Destination, type Scope } from './sequential-trail-api'

export const kindLabel: Record<Kind, string> = { MANUAL: 'Tarefa', EVENT_PARTICIPATION: 'Evento', QUESTIONNAIRE: 'Questionário' }
export const destinationLabel: Record<Destination, string> = { USER_ACCOUNT: 'Usuário', GROUP: 'Grupo', MINISTRY: 'Ministério', DEPARTMENT: 'Departamento', QUESTIONNAIRE: 'Questionário' }
export const stateLabel: Record<string, string> = { NOT_STARTED: 'Não iniciada', IN_PROGRESS: 'Em andamento', PAUSED: 'Pausada', COMPLETED: 'Concluída', CANCELLED: 'Cancelada', PENDING: 'Pendente', BLOCKED: 'Aguardando liberação', AVAILABLE: 'Disponível', SKIPPED: 'Registro anterior' }
export function blockLabel(reason: string | null) {
  if (!reason) return null
  return ({ ADMISSION_AUTHORIZATION_REQUIRED: 'Autorização de ingresso pendente. Suas etapas concluídas estão preservadas.',
    ADULT_ELIGIBILITY_REQUIRED: 'A equipe precisa conferir os dados de idade para o processo de membresia.',
    ACTIVE_CONTEXT_REQUIRED: 'A equipe precisa verificar a situação da pessoa e da igreja.',
    MEMBERSHIP_SLOT_OCCUPIED: 'Já existe uma membresia vigente. A equipe precisa verificar a situação.',
    EVIDENCE_REVIEW_REQUIRED: 'A equipe precisa revisar evidências desta conclusão.' } as Record<string, string>)[reason] ?? 'A equipe precisa verificar uma pendência antes de continuar.'
}
export function useTrailWrite() {
  const pending = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  useEffect(() => () => pending.current?.abort(), [])
  async function run<T>(operation: (signal: AbortSignal) => Promise<T>, success: (value: T) => void, notice = 'Alteração registrada.') {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { const value = await operation(controller.signal); if (!controller.signal.aborted) { success(value); setMessage(notice) } }
    catch (error) { if (!controller.signal.aborted) { setBlocked(true); setMessage(error instanceof ApiError ? `${error.message} Atualize os dados antes de tentar novamente.` : 'Não foi possível confirmar a operação. Atualize os dados antes de tentar novamente.') } }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return { run, busy, blocked, message, reset: () => { if (!pending.current) { setBlocked(false); setMessage('') } } }
}
export function Feedback({ write }: { write: ReturnType<typeof useTrailWrite> }) { return write.message ? <p role={write.blocked ? 'alert' : 'status'}>{write.message}</p> : null }
export function Query<T>({ query, busy = false, label, refresh, hideRefresh = false, children }: { query: ReturnType<typeof useRead<T>>; busy?: boolean; label: string; refresh?: () => void; hideRefresh?: boolean; children: (value: T) => ReactNode }) {
  return <>
    {(!hideRefresh || query.state.kind === 'error') && <button type="button" disabled={busy} onClick={refresh ?? query.refresh}>Atualizar {label}</button>}
    {query.state.kind === 'loading' ? <p role="status" aria-busy="true">Carregando {label}…</p> : query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : children(query.state.data)}
  </>
}
export function TrailPicker({ scopeKind, scopeId, kind, value, change, label, disabled = false }: { scopeKind: Scope['kind']; scopeId: string; kind: Kind | Destination; value: string; change: (id: string) => void; label: string; disabled?: boolean }) {
  const [queryText, setQueryText] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => options({ kind: scopeKind, id: scopeId }, kind, queryText, page, signal), [scopeKind, scopeId, kind, queryText, page])
  const query = useRead(JSON.stringify([scopeKind, scopeId, kind, queryText, page]), load)
  return <fieldset disabled={disabled} className="trail-picker"><legend>{label}</legend>
    <label>Pesquisar<input maxLength={120} value={queryText} onChange={e => { setQueryText(e.target.value); setPage(0) }}/></label>
    <Query query={query} busy={disabled} label="opções">{data => <>
      <label>Selecione<select required value={value} onChange={e => change(e.target.value)}>
        <option value="">Selecione</option>
        {value && !data.items.some(v => v.id === value) && <option value={value}>Escolha atual (preservar)</option>}
        {data.items.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select></label>
      {!data.items.length && <p>Nenhuma opção nesta busca.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label={`Páginas de ${label}`}/>
    </>}</Query>
  </fieldset>
}
