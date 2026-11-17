import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ResourceAccess } from '../authorization'
import { useRead } from '../security/SecurityPages'
import * as trails from './sequential-trail-api'
import { blockLabel, Feedback, kindLabel, Query, stateLabel, useTrailWrite } from './TrailWidgets'

export default function ManagedTrailExecutions({ church }: { church: string }) {
  const [selected, setSelected] = useState(''), [values, setValues] = useState<Record<string, trails.Execution>>({})
  const write = useTrailWrite(), load = useCallback((signal: AbortSignal) => trails.executions(church, signal), [church])
  const query = useRead(church, load)
  return <section><h2>Participantes e andamento</h2><Feedback write={write}/>
    <Query query={query} label="participantes" busy={write.busy} refresh={() => { write.reset(); setValues({}); setSelected(''); query.refresh() }}>{rows => <>
      {!rows.length ? <p>Nenhum participante com percurso sequencial nesta igreja.</p> : <ul className="event-list">{rows.map(row => {
        const run = values[row.id] ?? row
        return <li key={run.id}><h3>{run.participantName}</h3><p>{run.name} · {stateLabel[run.status] ?? 'Situação em conferência'}</p>
          <button type="button" disabled={write.busy} onClick={() => setSelected(selected === run.id ? '' : run.id)}>{selected === run.id ? 'Fechar acompanhamento' : 'Acompanhar participante'}</button>
          {selected === run.id && <RunDetail run={run} write={write} save={v => setValues(before => ({ ...before, [v.id]: v }))}/>}
        </li>
      })}</ul>}
    </>}</Query>
  </section>
}
function RunDetail({ run, write, save }: { run: trails.Execution; write: ReturnType<typeof useTrailWrite>; save: (value: trails.Execution) => void }) {
  return <>
    {blockLabel(run.blockReason) && <p role="status">{blockLabel(run.blockReason)}</p>}
    {run.status === 'IN_PROGRESS' && (run.official || run.blockReason === 'ADMISSION_AUTHORIZATION_REQUIRED') && <ResourceAccess permissionCode="TRAIL_ADMISSION_AUTHORIZE" resourceType="CHURCH" resourceId={run.churchId} optional>
      <p>A autorização de ingresso pode ser registrada durante o percurso. A conclusão válida da trilha oficial registra a membresia automaticamente.</p>
      <ReasonForm key={`${run.id}:authorize`} label="Registrar autorização de ingresso" write={write} submit={reason => void write.run(signal => trails.administrative(run.churchId, run.id, 'authorize', reason, signal), save, 'Autorização de ingresso registrada.')}/>
    </ResourceAccess>}
    <ol className="event-list">{run.steps.map(s => <li key={s.id}><h4>{s.position}. {s.name}</h4>
      <p>{kindLabel[s.kind]} · {stateLabel[s.status] ?? 'Situação em conferência'}</p><p className="trail-instructions">{s.instructions}</p>
      {s.satisfactionMode === 'WAIVED' && <p>Requisito dispensado pela equipe.</p>}
      {s.satisfactionMode === 'ADMINISTRATIVE' && <p>Conclusão administrativa registrada.</p>}
      {s.kind === 'MANUAL' && s.workItemId && <ResourceAccess permissionCode="TASK_VIEW" resourceType="CHURCH" resourceId={run.churchId} optional><Link to={`/tarefas/igrejas/${run.churchId}/${s.workItemId}`}>Acompanhar a tarefa e seu responsável</Link></ResourceAccess>}
      {run.status === 'IN_PROGRESS' && s.available && s.kind !== 'MANUAL' && <ResourceAccess permissionCode="TRAIL_COMPLETE_ADMIN" resourceType="CHURCH" resourceId={run.churchId} optional>
        <ReasonForm key={`${s.id}:waive`} label="Dispensar requisito desta etapa" write={write} submit={reason => void write.run(signal => trails.administrative(run.churchId, run.id, 'waive', reason, signal, s.id), save, 'Dispensa administrativa registrada.')}/>
      </ResourceAccess>}
    </li>)}</ol>
  </>
}
function ReasonForm({ label, write, submit }: { label: string; write: ReturnType<typeof useTrailWrite>; submit: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  function send(event: FormEvent) { event.preventDefault(); submit(reason) }
  return <details><summary>{label}</summary><form onSubmit={send}><fieldset disabled={write.busy || write.blocked}>
    <legend>{label}</legend><label>Justificativa<textarea required maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)}/></label>
    <button type="submit">{label}</button>
  </fieldset></form></details>
}
