import { useId } from 'react'
import '../events/events.css'

// Presentation models only, not HTTP DTOs. The caller supplies an authorized
// projection and invalidates it when access or context changes.
export type JourneyContext = {
  actorId: string
  subjectId: string
  churchId: string
  executionId: string
}

export type JourneyProjection = {
  context: JourneyContext
  title: string
  versionLabel: string
  stateLabel: string
  // Supplied by the authoritative service; never derived from visible tasks.
  progressLabel: string | null
  tasks: readonly { id: string; title: string; stateLabel: string }[]
}

export type JourneyViewState =
  | { kind: 'loading' | 'error' | 'denied' | 'empty' }
  | { kind: 'ready'; projection: JourneyProjection }

function sameContext(a: JourneyContext, b: JourneyContext) {
  return a.actorId === b.actorId && a.subjectId === b.subjectId
    && a.churchId === b.churchId && a.executionId === b.executionId
}

// No local snapshot/cache, writes, eligibility or membership decisions.
export function JourneyProgress({ context, state }: {
  context: JourneyContext
  state: JourneyViewState
}) {
  const id = useId()
  let content
  if (state.kind !== 'ready') {
    content = <p role={state.kind === 'error' ? 'alert' : 'status'}>{ {
      loading: 'Carregando Minha Jornada…',
      error: 'Não foi possível consultar Minha Jornada.',
      denied: 'Consulta da jornada não autorizada.',
      empty: 'Nenhuma jornada disponível neste contexto.',
    }[state.kind]}</p>
  } else if (!sameContext(context, state.projection.context)) {
    content = <p role="status">Jornada indisponível para este contexto.</p>
  } else {
    const { projection } = state
    content = <>
      <h3>{projection.title}</h3>
      <dl className="event-summary">
        <div><dt>Versão</dt><dd>{projection.versionLabel}</dd></div>
        <div><dt>Situação</dt><dd>{projection.stateLabel}</dd></div>
        <div><dt>Progresso</dt><dd>{projection.progressLabel ?? 'Progresso não informado.'}</dd></div>
      </dl>
      <h3 id={`${id}-tasks`}>Tarefas</h3>
      {projection.tasks.length > 0
        ? <ul className="event-list" aria-labelledby={`${id}-tasks`}>{projection.tasks.map(task =>
          <li key={task.id}><h4>{task.title}</h4><p>{task.stateLabel}</p></li>)}</ul>
        : <p role="status">Nenhuma tarefa autorizada para exibição.</p>}
    </>
  }
  return <section className="events-panel" aria-labelledby={id} aria-busy={state.kind === 'loading'}>
    <h2 id={id}>Minha Jornada</h2>{content}
  </section>
}
