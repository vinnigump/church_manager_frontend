import { useId, type ReactNode } from 'react'

interface ContextOption {
  id: string
  label: string
}

type ContextSelectionState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'revoked'; options: readonly ContextOption[] }
  | { kind: 'ready'; options: readonly ContextOption[]; selectedId?: string }

interface ContextSelectionProps {
  state: ContextSelectionState
  onSelect: (id: string) => void
  onRetry?: () => void
  children?: (contextId: string) => ReactNode
}

// The caller supplies authorized options and remains responsible for access checks.
export function ContextSelection({ state, onSelect, onRetry, children }: ContextSelectionProps) {
  const labelId = useId()

  if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando contextos…</p>
  if (state.kind === 'error') return <>
    <p role="alert">Não foi possível carregar os contextos.</p>
    {onRetry && <button type="button" className="app-session-button" onClick={onRetry}>Verificar novamente</button>}
  </>

  const { options } = state
  const selected = state.kind === 'ready' ? options.find(option => option.id === state.selectedId) : undefined

  return <>
    {state.kind === 'revoked' && <p role="alert">Acesso ao contexto anterior não autorizado.</p>}
    {options.length > 0 ? <>
      <label htmlFor={labelId}>Contexto</label>{' '}
      <select id={labelId} value={selected?.id ?? ''} onChange={event => {
        const id = event.target.value
        if (options.some(option => option.id === id)) onSelect(id)
      }}>
        <option value="" disabled>Selecione um contexto autorizado</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </> : <p role="status">Nenhum contexto autorizado disponível.</p>}
    {selected && children && <div key={selected.id}>{children(selected.id)}</div>}
  </>
}
