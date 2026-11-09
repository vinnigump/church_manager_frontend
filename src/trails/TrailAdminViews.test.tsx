import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrailHistory, TrailMigration, TrailVersions, type TrailMigrationResult } from './TrailAdminViews'

// Synthetic presentation data and isolated callbacks, never an API mock.
const results: readonly TrailMigrationResult[] = [
  { id: 'a', participantLabel: 'Participante A', sourceVersionLabel: 'v1', targetVersionLabel: 'v2', outcome: 'success', detail: 'Item preservado.' },
  { id: 'b', participantLabel: 'Participante B', sourceVersionLabel: 'v1', targetVersionLabel: 'v2', outcome: 'failure', detail: 'Revisão necessária.' },
  { id: 'c', participantLabel: 'Participante C', sourceVersionLabel: 'v1', targetVersionLabel: 'v2', outcome: 'pending', detail: 'Aguardando processamento.' },
]

describe('administração de trilhas isolada', () => {
  it('apresenta versões e histórico sem deduzir ações de seu estado', () => {
    render(<><TrailVersions state={{ kind: 'ready', items: [{ id: 'v1', label: 'Versão original', stateLabel: 'Substituída' }] }}/>
      <TrailHistory state={{ kind: 'ready', items: [{ id: 'h1', participantLabel: 'Participante A', versionLabel: 'v1', description: 'Dispensa registrada; evidência original preservada.' }] }}/></>)
    expect(screen.getByRole('region', { name: 'Versões da trilha' })).toHaveTextContent('Substituída')
    expect(screen.getByRole('region', { name: 'Histórico da trilha' })).toHaveTextContent('Dispensa registrada')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each(['ready', 'loading', 'error', 'denied'] as const)('mostra o estado %s nas três coleções', kind => {
    const state = kind === 'denied' ? { kind } : { kind, items: [] }
    render(<><TrailVersions state={state}/><TrailHistory state={state}/><TrailMigration state={state} stateLabel="Não consultada"/></>)
    for (const region of screen.getAllByRole('region')) {
      expect(within(region).getByRole(kind === 'error' ? 'alert' : 'status')).toBeInTheDocument()
      expect(region).toHaveAttribute('aria-busy', String(kind === 'loading'))
      expect(within(region).queryByRole('list')).not.toBeInTheDocument()
    }
  })

  it('apresenta resultados por participante e preserva sucessos diante de falha parcial e falha de atualização', () => {
    const view = render(<TrailMigration state={{ kind: 'ready', items: results }} stateLabel="Falha parcial"/>)
    const success = screen.getByRole('heading', { name: 'Participante A' }).closest('li')!
    expect(success).toHaveTextContent('Sucesso')
    expect(screen.getByText('Falha')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByText(/não concede automaticamente membresia/)).toBeInTheDocument()
    for (const kind of ['loading', 'error', 'ready'] as const) {
      view.rerender(<TrailMigration state={{ kind, items: results }} stateLabel="Falha parcial"/>)
      expect(screen.getByRole('heading', { name: 'Participante A' }).closest('li')).toBe(success)
      expect(success).toHaveTextContent('Item preservado.')
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    }
  })

  it('aciona somente o callback explicitamente autorizado para o participante selecionado', () => {
    const retry = vi.fn()
    const cancel = vi.fn()
    render(<TrailMigration state={{ kind: 'ready', items: [results[0], { ...results[1], action: { allowed: true, label: 'Reprocessar participante B', onAction: retry } }] }} stateLabel="Falha parcial" action={{ allowed: true, label: 'Solicitar cancelamento', onAction: cancel }}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Reprocessar participante B' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(cancel).not.toHaveBeenCalled()
    expect(screen.getByText('Sucesso')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar cancelamento' }))
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sucesso')).toBeInTheDocument()
    expect(screen.getByText('Falha')).toBeInTheDocument()
  })

  it('remove ações quando capacidade é negada e não presume permissão pelo callback', () => {
    const onAction = vi.fn()
    const allowed = { allowed: true, label: 'Consultar versão', onAction } as const
    const view = render(<TrailVersions state={{ kind: 'ready', items: [{ id: 'v', label: 'v1', stateLabel: 'Publicada', action: allowed }] }}/>)
    fireEvent.click(screen.getByRole('button'))
    expect(onAction).toHaveBeenCalledTimes(1)
    view.rerender(<TrailVersions state={{ kind: 'ready', items: [{ id: 'v', label: 'v1', stateLabel: 'Publicada', action: { ...allowed, allowed: false } }] }}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it.each(['loading', 'error', 'denied'] as const)('não oferece comandos no estado %s mesmo com capacidade explícita', kind => {
    const onAction = vi.fn()
    const action = { allowed: true, label: 'Comando autorizado', onAction } as const
    const items = [{ ...results[1], action }]
    render(<TrailMigration state={{ kind, items }} stateLabel="Estado reservado" action={action}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(onAction).not.toHaveBeenCalled()
    if (kind === 'denied') {
      expect(screen.queryByText('Participante B')).not.toBeInTheDocument()
      expect(screen.queryByText(/Estado reservado/)).not.toBeInTheDocument()
    }
  })

  it('desabilita comando pendente sem disparar o callback', () => {
    const onAction = vi.fn()
    render(<TrailVersions state={{ kind: 'ready', items: [{ id: 'v', label: 'v1', stateLabel: 'Estado fornecido', action: { allowed: true, pending: true, label: 'Processando', onAction } }] }}/>)
    expect(screen.getByRole('button')).toBeDisabled()
    fireEvent.click(screen.getByRole('button'))
    expect(onAction).not.toHaveBeenCalled()
  })

  it('nega comandos de migração com capacidade ausente ou explicitamente falsa', () => {
    const onAction = vi.fn()
    const denied = { allowed: false, label: 'Não oferecer', onAction } as const
    render(<TrailMigration state={{ kind: 'ready', items: [results[0], { ...results[1], action: denied }] }} stateLabel="Falha parcial" action={denied}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.getByText('Sucesso')).toBeInTheDocument()
  })

  it('retira dados anteriores de todas as coleções ao detectar negação', () => {
    const view = render(<>
      <TrailVersions state={{ kind: 'ready', items: [{ id: 'v', label: 'Versão reservada', stateLabel: 'Publicada' }] }}/>
      <TrailHistory state={{ kind: 'ready', items: [{ id: 'h', participantLabel: 'Histórico reservado', versionLabel: 'v1', description: 'Registro anterior' }] }}/>
      <TrailMigration state={{ kind: 'ready', items: results }} stateLabel="Estado reservado"/>
    </>)
    view.rerender(<><TrailVersions state={{ kind: 'denied' }}/><TrailHistory state={{ kind: 'denied' }}/><TrailMigration state={{ kind: 'denied' }} stateLabel="Estado reservado"/></>)
    expect(screen.getAllByText('Consulta não autorizada.')).toHaveLength(3)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.queryByText(/reservad|Participante/)).not.toBeInTheDocument()
  })

  it('não acessa rede, storage ou campos privados e não cria links', () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const items = [{ ...results[0], privateDocument: 'segredo', privateUrl: 'https://private.invalid' }]
    try {
      const { container } = render(<TrailMigration state={{ kind: 'ready', items }} stateLabel="Consulta"/>)
      expect(fetcher).not.toHaveBeenCalled()
      expect(storage).not.toHaveBeenCalled()
      expect(container).not.toHaveTextContent(/segredo|private.invalid/)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    } finally { fetcher.mockRestore(); storage.mockRestore() }
  })
})
