import type { ReactNode } from 'react'
import { useDefaultChurch } from '../church-context'
import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useRead } from '../security/SecurityPages'
import EventTaskRegistration from '../events/EventTaskRegistration'
import * as trails from './sequential-trail-api'
import { blockLabel, Feedback, kindLabel, Query, stateLabel, useTrailWrite } from './TrailWidgets'

export function Enroll({ person }: { person: string }) {
  const load = useCallback((signal: AbortSignal) => trails.ownChurches(signal), [])
  const query = useRead('trail-churches', load)
  return <Query query={query} label="igrejas" hideRefresh>{churches => churches.length ? <ChurchEnrollment churches={churches} person={person}/> : <p>Nenhuma igreja está disponível para iniciar uma trilha com seu cadastro atual. Consulte a equipe da igreja.</p>}</Query>
}
function ChurchEnrollment({ churches, person }: { churches: trails.Church[]; person: string }) {
  const { defaultChurchId } = useDefaultChurch()
  const [choice, setChurch] = useState<string | null>(null), [choosing, setChoosing] = useState(false)
  const church = choice ?? (churches.some(v => v.churchId === defaultChurchId) ? defaultChurchId! : '')
  const write = useTrailWrite(), navigate = useNavigate()
  return <>
    {church && !choosing ? <p>{churches.find(v => v.churchId === church)?.churchName}{churches.length > 1 && <> · <button type="button" disabled={write.busy} onClick={() => setChoosing(true)}>Trocar igreja</button></>}</p> : <label>Igreja<select value={church} disabled={write.busy} onChange={e => { setChurch(e.target.value); setChoosing(false); write.reset() }}>
      <option value="">Selecione a igreja</option>{churches.map(v => <option key={v.churchId} value={v.churchId}>{v.churchName}</option>)}
    </select></label>}<Feedback write={write}/>
    {church && <AvailableList key={church} church={church} write={write} begin={publication => void write.run(signal => trails.start(church, publication, person, signal), run => navigate(`/minhas-trilhas/${run.id}`))}/>}
  </>
}
function AvailableList({ church, write, begin }: { church: string; write: ReturnType<typeof useTrailWrite>; begin: (publication: string) => void }) {
  const load = useCallback((signal: AbortSignal) => trails.available(church, signal), [church])
  const query = useRead(church, load)
  return <Query query={query} busy={write.busy} label="trilhas disponíveis" refresh={() => { write.reset(); query.refresh() }}>{rows => rows.length ? <ul className="event-list">{rows.map(v => <li key={v.publicationId}>
    <h2>{v.name}</h2><p>Versão {v.versionNumber}{v.official ? ' · Processo de membresia da igreja' : ''}</p>
    <button type="button" disabled={write.busy || write.blocked} onClick={() => begin(v.publicationId)}>Participar de {v.name}</button>
  </li>)}</ul> : <p>A igreja ainda não disponibilizou uma trilha.</p>}</Query>
}
export function OwnExecution({ id, person, fallback }: { id: string; person: string; fallback?: ReactNode }) {
  const [value, setValue] = useState<trails.Execution | null>(null)
  const [eventBusy, setEventBusy] = useState(false)
  const write = useTrailWrite()
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await trails.ownExecution(id, person, signal) }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  }, [id, person])
  const query = useRead(`${id}:${person}`, load)
  return <><Feedback write={write}/><Query query={query} busy={write.busy || eventBusy} label="percurso" refresh={() => { write.reset(); setValue(null); query.refresh() }}>{data => {
    const run = value ?? data
    if (!run) return fallback ?? <p>Este percurso não está disponível para execução. <Link to={`/minhas-trilhas/${id}`}>Consultar o registro do percurso</Link>.</p>
    const completed = run.steps.filter(s => s.status === 'COMPLETED').length
    const next = run.steps.find(s => !['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(s.status))
    return <>
      <div className="trail-run-summary"><span className="trail-eyebrow">Seu percurso</span><h2>{run.name}</h2><p>{completed} de {run.steps.length} etapas concluídas</p><progress className="trail-progress" value={completed} max={Math.max(1, run.steps.length)} aria-label="Etapas concluídas"/><p>{stateLabel[run.status] ?? 'Situação em conferência'}</p></div>
      {blockLabel(run.blockReason) && <p role="status">{blockLabel(run.blockReason)}</p>}
      {next && run.status !== 'CANCELLED' && <section className="trail-next-step" aria-label="Próximo passo"><h3>Próximo passo: {next.name}</h3><p>{next.available ? 'Consulte a instrução e a ação desta etapa abaixo.' : 'Aguarde a liberação dos requisitos desta etapa pela igreja.'}</p><a href={`#etapa-${next.id}`}>Ir para a etapa</a></section>}
      <details><summary>Conferir atualização do percurso</summary><button type="button" disabled={write.busy || eventBusy || write.blocked} onClick={() => void write.run(signal => trails.refresh(id, person, signal), setValue, 'Andamento conferido.')}>Conferir andamento</button></details>
      <ol className="event-list trail-timeline">{run.steps.map(s => <li key={s.id} id={`etapa-${s.id}`} data-step-state={s.status}>
        <h3>{s.position}. {s.name}</h3><p>{kindLabel[s.kind]} · {stateLabel[s.status] ?? 'Situação em conferência'}</p>
        <p className="trail-instructions">{s.instructions}</p>
        {s.satisfactionMode === 'WAIVED' && <p>Requisito dispensado pela equipe.</p>}
        {s.satisfactionMode === 'ADMINISTRATIVE' && <p>Conclusão administrativa registrada. Este registro não representa presença ou resposta ao questionário.</p>}
        {s.available && run.status === 'IN_PROGRESS' && <>
          {s.kind === 'MANUAL' && <section aria-label="Responsabilidade desta etapa">
            {s.destinationName && <p>Para quem é: {s.destinationName}</p>}
            <p>Quem vai executar: {s.executorName ? <>{s.executorName}{s.executorIsParticipant && ' (você)'}</> : 'Aguardando atribuição da equipe'}</p>
            {s.executorIsParticipant && s.workItemId ? <Link to={`/minhas-tarefas/${s.workItemId}`}>Abrir minha tarefa e concluir</Link> : s.executorIsParticipant === undefined ? <p>Consulte <Link to="/minhas-tarefas">Minhas tarefas</Link> para verificar sua responsabilidade.</p> : <p>Aguarde a conclusão pelo responsável desta etapa.</p>}
          </section>}
          {s.kind === 'QUESTIONNAIRE' && s.requirementId && <Link to={`/questionarios/igrejas/${run.churchId}/responder/${s.requirementId}?taskInstanceId=${s.id}`}>Responder questionário desta etapa</Link>}
          {s.kind === 'EVENT_PARTICIPATION' && s.requirementId && <fieldset disabled={write.busy || write.blocked}><legend>Participação em evento</legend><EventTaskRegistration churchId={run.churchId} eventTypeId={s.requirementId} taskInstanceId={s.id} onBusyChange={setEventBusy}/></fieldset>}
        </>}
      </li>)}</ol>
    </>
  }}</Query></>
}
