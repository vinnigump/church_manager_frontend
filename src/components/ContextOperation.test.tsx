import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContextSelection } from './ContextSelection'
import { ContextOperation, type ContextOperationState } from './ContextOperation'

const options = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
function deferred() {
  let resolve!: (value: string) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function content(state: ContextOperationState<string>) {
  if (state.kind === 'success') return <p>{state.data}</p>
  if (state.kind === 'error') return <p role="alert">Falha atual</p>
  return <p role="status">Carregando operação</p>
}

describe('ContextOperation', () => {
  it.each(['success', 'error'] as const)('descarta %s tardio na troca A → B → A e conclui a nova operação', async outcome => {
    const pending = [deferred(), deferred(), deferred()]
    const signals: AbortSignal[] = []
    const operation = vi.fn((_id: string, signal: AbortSignal) => {
      signals.push(signal)
      return pending[signals.length - 1].promise
    })
    const view = (id: string) => <ContextSelection state={{ kind: 'ready', options, selectedId: id }} onSelect={vi.fn()}>
      {contextId => <ContextOperation contextId={contextId} operation={operation}>{content}</ContextOperation>}
    </ContextSelection>
    const { rerender } = render(view('a'))
    rerender(view('b'))
    expect(signals[0].aborted).toBe(true)
    rerender(view('a'))
    expect(signals[1].aborted).toBe(true)
    await act(async () => {
      if (outcome === 'success') pending[0].resolve('Dados antigos A')
      else pending[0].reject(new Error('Erro antigo A'))
      pending[1].resolve('Dados antigos B')
    })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando operação')
    expect(screen.queryByText(/Dados antigos/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => { pending[2].resolve('Dados novos A') })
    expect(screen.getByText('Dados novos A')).toBeInTheDocument()
    expect(signals[2].aborted).toBe(false)
  })

  it.each(['revoked', 'loading', 'error', 'removed', 'unmount'] as const)('cancela e oculta dados ao receber %s', async transition => {
    const pending = deferred()
    let signal!: AbortSignal
    const operation = vi.fn((_id: string, received: AbortSignal) => { signal = received; return pending.promise })
    const child = (contextId: string) => <ContextOperation contextId={contextId} operation={operation}>{content}</ContextOperation>
    const { rerender, unmount } = render(<ContextSelection state={{ kind: 'ready', options, selectedId: 'a' }} onSelect={vi.fn()}>{child}</ContextSelection>)
    await act(async () => { pending.resolve('Dados anteriores') })
    expect(screen.getByText('Dados anteriores')).toBeInTheDocument()
    if (transition === 'unmount') unmount()
    else {
      const state = transition === 'removed'
        ? { kind: 'ready' as const, options: [options[1]], selectedId: 'a' }
        : transition === 'revoked' ? { kind: transition, options } : { kind: transition }
      rerender(<ContextSelection state={state} onSelect={vi.fn()}>{child}</ContextSelection>)
    }
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('Dados anteriores')).not.toBeInTheDocument()
  })

  it.each(['success', 'error'] as const)('ignora %s pendente após revogação e permite B', async outcome => {
    const old = deferred()
    const operation = vi.fn<(id: string, signal: AbortSignal) => Promise<string>>(() => old.promise)
    const child = (contextId: string) => <ContextOperation contextId={contextId} operation={operation}>{content}</ContextOperation>
    const { rerender } = render(<ContextSelection state={{ kind: 'ready', options, selectedId: 'a' }} onSelect={vi.fn()}>{child}</ContextSelection>)
    rerender(<ContextSelection state={{ kind: 'revoked', options: [options[1]] }} onSelect={vi.fn()}>{child}</ContextSelection>)
    await act(async () => {
      if (outcome === 'success') old.resolve('Dados revogados')
      else old.reject(new Error('Erro revogado'))
    })
    expect(screen.queryByText('Dados revogados')).not.toBeInTheDocument()
    expect(screen.queryByText('Falha atual')).not.toBeInTheDocument()
    operation.mockImplementation(async () => 'Dados B')
    rerender(<ContextSelection state={{ kind: 'ready', options: [options[1]], selectedId: 'b' }} onSelect={vi.fn()}>{child}</ContextSelection>)
    expect(await screen.findByText('Dados B')).toBeInTheDocument()
  })

  it('descarta operação substituída e trata erro síncrono atual', async () => {
    const pending = deferred()
    let signal!: AbortSignal
    const operation = (_id: string, received: AbortSignal) => { signal = received; return pending.promise }
    const { rerender } = render(<ContextOperation contextId="a" operation={operation}>{content}</ContextOperation>)
    const failure = () => { throw new Error('Falha atual') }
    rerender(<ContextOperation contextId="a" operation={failure}>{content}</ContextOperation>)
    expect(signal.aborted).toBe(true)
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha atual')
    await act(async () => { pending.resolve('Resultado substituído') })
    expect(screen.queryByText('Resultado substituído')).not.toBeInTheDocument()
  })

  it('invalida a primeira execução no ciclo de efeitos do StrictMode', async () => {
    const pending = [deferred(), deferred()]
    const signals: AbortSignal[] = []
    const operation = (_id: string, signal: AbortSignal) => {
      signals.push(signal)
      return pending[signals.length - 1].promise
    }
    const { unmount } = render(<StrictMode><ContextOperation contextId="a" operation={operation}>{content}</ContextOperation></StrictMode>)
    expect(signals[0].aborted).toBe(true)
    await act(async () => { pending[1].resolve('Atual'); pending[0].resolve('Obsoleto') })
    expect(screen.getByText('Atual')).toBeInTheDocument()
    expect(screen.queryByText('Obsoleto')).not.toBeInTheDocument()
    unmount()
    expect(signals[1].aborted).toBe(true)
  })
})
