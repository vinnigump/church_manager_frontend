import { useId } from 'react'
import '../events/events.css'

// Presentation models only. Labels and capabilities must come from an authorized
// caller; these types do not describe HTTP DTOs or backend lifecycle states.
export type TrailAction =
  | { allowed: false }
  | { allowed: true; label: string; pending?: boolean; onAction: () => void }

export type TrailCollection<T> =
  | { kind: 'denied' }
  | { kind: 'loading'; items: readonly T[] }
  | { kind: 'error'; items: readonly T[] }
  | { kind: 'ready'; items: readonly T[] }

export type TrailVersionItem = {
  id: string
  label: string
  stateLabel: string
  action?: TrailAction
}

export type TrailHistoryItem = {
  id: string
  participantLabel: string
  versionLabel: string
  description: string
}

export type TrailMigrationResult = {
  id: string
  participantLabel: string
  sourceVersionLabel: string
  targetVersionLabel: string
  outcome: 'pending' | 'success' | 'failure'
  detail: string
  action?: TrailAction
}

function Action({ action }: { action?: TrailAction }) {
  if (action?.allowed !== true) return null
  return <button type="button" disabled={action.pending === true} onClick={() => {
    if (action.allowed === true && action.pending !== true) action.onAction()
  }}>{action.label}</button>
}

function Collection<T>({ title, state, empty, children }: {
  title: string
  state: TrailCollection<T>
  empty: string
  children: (item: T) => React.ReactNode
}) {
  const id = useId()
  return <section className="events-panel" aria-labelledby={id} aria-busy={state.kind === 'loading'}>
    <h2 id={id}>{title}</h2>
    {state.kind === 'denied' ? <p role="status">Consulta não autorizada.</p> : <>
      {state.kind === 'loading' && <p role="status">Carregando {title.toLocaleLowerCase('pt-BR')}…</p>}
      {state.kind === 'error' && <p role="alert">Não foi possível atualizar {title.toLocaleLowerCase('pt-BR')}. Os registros disponíveis foram preservados.</p>}
      {state.kind === 'ready' && state.items.length === 0 && <p role="status">{empty}</p>}
      {state.items.length > 0 && <ul className="event-list">{state.items.map(children)}</ul>}
    </>}
  </section>
}

export function TrailVersions({ state }: { state: TrailCollection<TrailVersionItem> }) {
  return <Collection title="Versões da trilha" state={state} empty="Nenhuma versão disponível.">{item =>
    <li key={item.id}><h3>{item.label}</h3><p>{item.stateLabel}</p><Action action={state.kind === 'ready' ? item.action : undefined}/></li>
  }</Collection>
}

export function TrailHistory({ state }: { state: TrailCollection<TrailHistoryItem> }) {
  return <Collection title="Histórico da trilha" state={state} empty="Nenhum histórico disponível.">{item =>
    <li key={item.id}><h3>{item.participantLabel}</h3><p>Versão: {item.versionLabel}</p><p>{item.description}</p></li>
  }</Collection>
}

const outcomes = { pending: 'Pendente', success: 'Sucesso', failure: 'Falha' }

export function TrailMigration({ state, stateLabel, action }: {
  state: TrailCollection<TrailMigrationResult>
  stateLabel: string
  action?: TrailAction
}) {
  return <>
    {state.kind !== 'denied' && <p role="status">Estado da migração: {stateLabel}</p>}
    <Collection title="Resultados da migração" state={state} empty="Nenhum resultado disponível.">{item =>
      <li key={item.id}><h3>{item.participantLabel}</h3>
        <dl className="event-summary"><div><dt>Origem</dt><dd>{item.sourceVersionLabel}</dd></div><div><dt>Destino</dt><dd>{item.targetVersionLabel}</dd></div><div><dt>Resultado</dt><dd>{outcomes[item.outcome]}</dd></div></dl>
        <p>{item.detail}</p><Action action={state.kind === 'ready' ? item.action : undefined}/>
      </li>
    }</Collection>
    {state.kind !== 'denied' && <p>Migração não concede automaticamente membresia.</p>}
    {state.kind === 'ready' && <Action action={action}/>}
  </>
}
