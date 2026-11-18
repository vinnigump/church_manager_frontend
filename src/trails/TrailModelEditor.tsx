import { flushSync } from 'react-dom'
import UnsavedChangesGuard from '../components/UnsavedChangesGuard'
import { useState, type FormEvent } from 'react'
import * as trails from './sequential-trail-api'
import { Feedback, kindLabel, TrailPicker, useTrailWrite } from './TrailWidgets'

interface Editable { key: string; step: trails.Step }
const blank = (): Editable => ({ key: crypto.randomUUID(), step: { name: '', instructions: '', kind: 'MANUAL', assignment: 'PARTICIPANT', requirementId: null, requiresAdmissionAuthorization: false } })
export default function TrailModelEditor({ scope, before, revise = false, done, cancel }: { scope: trails.Scope; before?: trails.Version; revise?: boolean; done: (value: trails.Version) => void; cancel: () => void }) {
  const [requestId] = useState(() => before && !revise ? before.id : crypto.randomUUID())
  const [name, setName] = useState(before?.name ?? '')
  const [steps, setSteps] = useState<Editable[]>(() => before ? before.steps.map(v => ({ key: v.id, step: { ...v.definition } })) : [blank()])
  const [baseline] = useState(() => JSON.stringify({ name, steps: steps.map(v => v.step) }))
  const [saved, setSaved] = useState(false)
  const dirty = !saved && baseline !== JSON.stringify({ name, steps: steps.map(v => v.step) })
  const write = useTrailWrite()
  function update(key: string, change: Partial<trails.Step>) { setSteps(rows => rows.map(v => v.key === key ? { ...v, step: { ...v.step, ...change } } : v)) }
  function move(index: number, delta: number) { setSteps(rows => { const copy = [...rows]; [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]]; return copy }) }
  function submit(event: FormEvent) {
    event.preventDefault()
    void write.run(signal => trails.saveVersion(scope, { requestId, name, steps: steps.map(v => v.step) }, signal, before, revise), value => { flushSync(() => setSaved(true)); done(value) }, 'Modelo salvo.')
  }
  return <section className="trail-editor">
    {dirty && <UnsavedChangesGuard dirty/>}
    <h2>{before ? revise ? 'Nova versão do modelo' : 'Editar rascunho' : 'Criar modelo de trilha'}</h2>
    <p>As etapas serão percorridas na ordem abaixo. Cada conclusão libera a seguinte.</p>
    <details className="trail-flow-preview"><summary>Prévia da sequência ({steps.length} etapas)</summary><ol>{steps.map(({ key, step }) => <li key={key}>{step.name || 'Etapa sem nome'} · {kindLabel[step.kind]} · {step.kind === 'MANUAL' ? step.assignment === 'CHURCH_DESTINATION' ? 'Pessoa ou equipe definida pela igreja' : 'Participante' : step.kind === 'QUESTIONNAIRE' ? 'Participante responde; correção conforme configuração' : 'Participante se inscreve; presença é registrada no evento'}</li>)}</ol></details>
    <Feedback write={write}/>
    {write.blocked && <p>Confira a lista de modelos antes de iniciar outro cadastro. Suas informações continuam visíveis abaixo.</p>}
    <form onSubmit={submit}><fieldset disabled={write.busy || write.blocked}>
      <legend>Informações do modelo</legend><label>Nome da trilha<input required maxLength={200} value={name} onChange={e => setName(e.target.value)}/></label>
      {steps.map(({ key, step }, index) => <details key={key} className="trail-step-editor" open={steps.length === 1 || undefined}>
        <summary><span className="trail-step-number">{index + 1}</span> {step.name || `Etapa ${index + 1}`} · {kindLabel[step.kind]}</summary>
        <label>Nome da etapa<input required maxLength={180} value={step.name} onChange={e => update(key, { name: e.target.value })}/></label>
        <label>O que deve ser feito<textarea required maxLength={10000} rows={4} value={step.instructions} onChange={e => update(key, { instructions: e.target.value })}/></label>
        <label>Tipo<select value={step.kind} onChange={e => { const kind = e.target.value as trails.Kind; update(key, { kind, assignment: kind === 'MANUAL' ? 'PARTICIPANT' : null, requirementId: null }) }}>
          {Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {step.kind === 'MANUAL' ? <label>Quem executa<select value={step.assignment ?? 'PARTICIPANT'} onChange={e => update(key, { assignment: e.target.value as trails.Step['assignment'] })}>
          <option value="PARTICIPANT">Participante da trilha</option><option value="CHURCH_DESTINATION">Pessoa ou equipe definida pela igreja</option>
        </select></label> : step.kind === 'QUESTIONNAIRE' && scope.kind === 'DENOMINATION' ? <p>A igreja escolherá seu questionário publicado ao disponibilizar este modelo.</p> :
          <TrailPicker key={`${key}:${step.kind}`} scopeKind={scope.kind} scopeId={scope.id} kind={step.kind} value={step.requirementId ?? ''} change={requirementId => update(key, { requirementId })} label={step.kind === 'QUESTIONNAIRE' ? 'Questionário da etapa' : 'Tipo de evento da etapa'}/>}
        <details><summary>Autorização de ingresso</summary><label className="trail-checkbox"><input type="checkbox" checked={step.requiresAdmissionAuthorization} onChange={e => update(key, { requiresAdmissionAuthorization: e.target.checked })}/>Exigir autorização de ingresso antes desta atividade</label></details>
        <div className="trail-actions">
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Subir etapa</button>
          <button type="button" disabled={index === steps.length - 1} onClick={() => move(index, 1)}>Descer etapa</button>
          <button type="button" disabled={steps.length === 1} onClick={() => setSteps(rows => rows.filter(v => v.key !== key))}>Remover etapa</button>
        </div>
      </details>)}
      <button type="button" disabled={steps.length >= 100} onClick={() => setSteps(rows => [...rows, blank()])}>Adicionar etapa</button>
      <button type="submit">Salvar rascunho</button>
    </fieldset></form>
    <button type="button" disabled={write.busy} onClick={() => { if (!dirty || window.confirm('Descartar alterações não salvas do modelo?')) cancel() }}>{write.blocked ? 'Fechar e conferir modelos' : 'Voltar aos modelos'}</button>
  </section>
}
