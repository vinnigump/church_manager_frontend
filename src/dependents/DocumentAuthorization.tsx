import { useId } from 'react'
import '../events/events.css'
import '../events/participation-presentation.css'

// Modelos locais de apresentação; não são DTOs nem concedem acesso.
export type DependentContext = {
  churchId: string
  dependentId: string
  guardianId: string
}
export type DocumentSelection = DependentContext & { file: File }
export type DocumentAttachmentState = 'available' | 'unavailable' | 'loading' | 'error'

// Exclusivo do dependente autenticado. O integrador deverá validar contexto e upload no servidor.
export function DependentDocumentAttachment({ context, state, onSelect }: {
  context: DependentContext
  state: DocumentAttachmentState
  onSelect: (selection: DocumentSelection) => void
}) {
  const id = useId()
  return <section className="events-panel participation-panel" aria-labelledby={`${id}-title`} aria-busy={state === 'loading'}>
    <h2 id={`${id}-title`}>Documento de autorização</h2>
    <p id={`${id}-help`}>Selecione o documento associado a você e ao responsável. A seleção não confirma envio nem aprovação.</p>
    {state === 'available' ? <label>Selecionar documento
      <input key={JSON.stringify([context.churchId, context.dependentId, context.guardianId])} type="file" aria-describedby={`${id}-help`} onChange={event => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) onSelect({ churchId: context.churchId, dependentId: context.dependentId, guardianId: context.guardianId, file })
      }}/>
    </label> : <p className="participation-message" role={state === 'error' ? 'alert' : 'status'}>
      {{ unavailable: 'Seleção de documento indisponível.', loading: 'Aguarde a verificação do documento…', error: 'Não foi possível processar o documento. Nenhum envio foi confirmado.' }[state]}
    </p>}
  </section>
}

export type AuthorizedDependentProjection = {
  basicProfile: { displayName: string }
  links: readonly string[]
  progress: readonly string[]
}
export type DependentAuthorizationState =
  | { kind: 'unavailable' | 'loading' | 'error' }
  | { kind: 'ready'; context: DependentContext } & (
    | { authorization: 'PENDENTE' | 'REJEITADA' | 'REVOGADA' }
    | { authorization: 'APROVADA'; projection: AuthorizedDependentProjection }
  )

function sameContext(a: DependentContext, b: DependentContext) {
  return a.churchId === b.churchId && a.dependentId === b.dependentId && a.guardianId === b.guardianId
}

// Consulta do responsável: sem documento, cache local ou ações operacionais.
export function DependentAuthorizationView({ context, state }: {
  context: DependentContext
  state: DependentAuthorizationState
}) {
  const id = useId()
  let content
  if (state.kind !== 'ready') {
    content = <p className="participation-message" role={state.kind === 'error' ? 'alert' : 'status'}>
      {{ unavailable: 'Consulta indisponível.', loading: 'Carregando autorização…', error: 'Não foi possível consultar a autorização.' }[state.kind]}
    </p>
  } else if (!sameContext(context, state.context)) {
    content = <p role="status">Consulta indisponível para este contexto.</p>
  } else {
    content = <>
      <p role="status">Autorização: {state.authorization}</p>
      {state.authorization === 'APROVADA' && <div className="participation-grid">
        <section className="participation-group" aria-labelledby={`${id}-profile`}>
          <h3 id={`${id}-profile`}>Perfil básico</h3><p>{state.projection.basicProfile.displayName}</p>
        </section>
        <section className="participation-group" aria-labelledby={`${id}-links`}>
          <h3 id={`${id}-links`}>Vínculos</h3>
          {state.projection.links.length ? <ul>{state.projection.links.map((link, index) => <li key={index}>{link}</li>)}</ul> : <p>Nenhum vínculo autorizado para exibição.</p>}
        </section>
        <section className="participation-group" aria-labelledby={`${id}-progress`}>
          <h3 id={`${id}-progress`}>Progresso</h3>
          {state.projection.progress.length ? <ul>{state.projection.progress.map((progress, index) => <li key={index}>{progress}</li>)}</ul> : <p>Nenhum progresso autorizado para exibição.</p>}
        </section>
      </div>}
    </>
  }
  return <section className="events-panel participation-panel" aria-labelledby={`${id}-title`} aria-busy={state.kind === 'loading'}>
    <h2 id={`${id}-title`}>Consulta do dependente</h2>{content}
  </section>
}
