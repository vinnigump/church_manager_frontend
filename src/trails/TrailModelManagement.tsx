import { useCallback, useState, type FormEvent } from 'react'
import { useRead } from '../security/SecurityPages'
import * as trails from './sequential-trail-api'
import TrailModelEditor from './TrailModelEditor'
import { destinationLabel, Feedback, kindLabel, Query, TrailPicker, useTrailWrite } from './TrailWidgets'

export default function TrailModelManagement({ scope }: { scope: trails.Scope }) {
  const [editor, setEditor] = useState<{ before?: trails.Version; revise?: boolean } | null>(null)
  const [configuration, setConfiguration] = useState<trails.Version | null>(null), [notice, setNotice] = useState('')
  const write = useTrailWrite(), kind = scope.kind, scopeId = scope.id
  const load = useCallback(async (signal: AbortSignal) => {
    const context = { kind, id: scopeId }
    const [all, owned] = await Promise.all([trails.versions(context, signal), kind === 'CHURCH' ? trails.ownedVersions(context, signal) : Promise.resolve(null)])
    return { all, ownedIds: new Set((owned ?? all).map(v => v.id)) }
  }, [kind, scopeId])
  const query = useRead(`${kind}:${scopeId}`, load)
  function reload() { setEditor(null); setConfiguration(null); write.reset(); query.refresh() }
  if (editor) return <TrailModelEditor scope={scope} {...editor} done={() => { setNotice('Rascunho salvo.'); reload() }} cancel={reload}/>
  if (configuration) return <PublicationPanel church={scopeId} model={configuration} done={() => { setNotice('Configuração da igreja registrada.'); reload() }} cancel={reload}/>
  return <section><h2>Modelos de trilha</h2>
    {notice && <p role="status">{notice}</p>}<Feedback write={write}/>
    <button type="button" disabled={write.busy || write.blocked} onClick={() => { setNotice(''); setEditor({}) }}>Criar modelo de trilha</button>
    <Query query={query} busy={write.busy} label="modelos" refresh={reload}>{({ all, ownedIds }) => all.length ? <ul className="event-list">{all.map(v => <li key={v.id}>
      <h3>{v.name}</h3><p>Versão {v.versionNumber} · {v.status === 'DRAFT' ? 'Rascunho' : v.status === 'PUBLISHED' ? 'Modelo finalizado' : 'Versão anterior'}</p>
      <ol>{v.steps.map(s => <li key={s.id}>{s.definition.name} · {kindLabel[s.definition.kind]}</li>)}</ol>
      {ownedIds.has(v.id) ? <div className="trail-actions">
        {v.status === 'DRAFT' && <>
          <button type="button" disabled={write.busy || write.blocked} onClick={() => setEditor({ before: v })}>Editar rascunho</button>
          <button type="button" disabled={write.busy || write.blocked} onClick={() => void write.run(signal => trails.publish(scope, v, signal), () => query.refresh(), 'Modelo finalizado. Novas alterações precisam de outra versão.')}>Finalizar modelo</button>
        </>}
        {v.status !== 'DRAFT' && <button type="button" disabled={write.busy || write.blocked} onClick={() => setEditor({ before: v, revise: true })}>Criar nova versão</button>}
        {scope.kind === 'DENOMINATION' && v.status === 'PUBLISHED' && <button type="button" disabled={write.busy || write.blocked} onClick={() => void write.run(signal => trails.designate(scope, v, signal), () => undefined, 'Modelo oficial de membresia registrado para a denominação.')}>Definir como modelo oficial de membresia</button>}
      </div> : <p>Modelo da denominação. A igreja configura os destinatários e questionários locais.</p>}
      {scope.kind === 'CHURCH' && v.status === 'PUBLISHED' && <button type="button" disabled={write.busy || write.blocked} onClick={() => setConfiguration(v)}>Configurar uso na igreja</button>}
    </li>)}</ul> : <p>Nenhum modelo de trilha disponível.</p>}</Query>
  </section>
}
function PublicationPanel({ church, model, done, cancel }: { church: string; model: trails.Version; done: () => void; cancel: () => void }) {
  const write = useTrailWrite()
  const load = useCallback((signal: AbortSignal) => trails.readPublication(church, model.id, signal), [church, model.id])
  const query = useRead(`${church}:${model.id}`, load)
  return <section><h2>Usar {model.name} na igreja</h2><Feedback write={write}/>
    <p>Os destinos e questionários escolhidos valem para novos participantes. Cada percurso iniciado preserva sua configuração.</p>
    <Query query={query} busy={write.busy} label="configuração" refresh={() => { write.reset(); query.refresh() }}>{before => <PublicationForm key={`${before.id}:${before.revision}`} model={model} before={before} write={write} done={done}/>}</Query>
    <button type="button" disabled={write.busy} onClick={cancel}>Voltar aos modelos</button>
  </section>
}
function PublicationForm({ model, before, write, done }: { model: trails.Version; before: trails.Publication; write: ReturnType<typeof useTrailWrite>; done: () => void }) {
  const needed = model.steps.filter(s => s.definition.kind === 'MANUAL' && s.definition.assignment === 'CHURCH_DESTINATION' || s.definition.kind === 'QUESTIONNAIRE' && s.definition.requirementId === null)
  const [enabled, setEnabled] = useState(before.enabled)
  const [bindings, setBindings] = useState(() => needed.map(s => before.bindings.find(b => b.stepId === s.id) ?? { stepId: s.id, destinationKind: s.definition.kind === 'QUESTIONNAIRE' ? 'QUESTIONNAIRE' as const : 'USER_ACCOUNT' as const, destinationId: '' }))
  function update(stepId: string, change: Partial<trails.Binding>) { setBindings(rows => rows.map(v => v.stepId === stepId ? { ...v, ...change } : v)) }
  function submit(event: FormEvent) { event.preventDefault(); void write.run(signal => trails.savePublication(before, enabled, bindings, signal), done) }
  return <form onSubmit={submit}><fieldset disabled={write.busy || write.blocked}><legend>Configuração da igreja</legend>
    <label className="trail-checkbox"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>Disponível para participantes desta igreja</label>
    {!needed.length && <p>Este modelo não exige destinatários ou questionários locais.</p>}
    {needed.map(s => { const binding = bindings.find(b => b.stepId === s.id)!; return <section key={s.id} className="trail-step-editor"><h3>{s.position}. {s.definition.name}</h3>
      {s.definition.kind === 'MANUAL' && <label>Destinar a<select value={binding.destinationKind} onChange={e => update(s.id, { destinationKind: e.target.value as trails.Destination, destinationId: '' })}>
        {(['USER_ACCOUNT', 'GROUP', 'MINISTRY', 'DEPARTMENT'] as const).map(value => <option key={value} value={value}>{destinationLabel[value]}</option>)}
      </select></label>}
      <TrailPicker key={`${s.id}:${binding.destinationKind}`} scopeKind="CHURCH" scopeId={before.churchId} kind={binding.destinationKind} value={binding.destinationId} change={destinationId => update(s.id, { destinationId })} label={s.definition.kind === 'QUESTIONNAIRE' ? 'Questionário publicado da igreja' : 'Destinatário da tarefa'}/>
    </section> })}
    <button type="submit">Salvar configuração</button>
  </fieldset></form>
}
