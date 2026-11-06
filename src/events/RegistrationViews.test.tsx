import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CapacitySummary, RegistrationOverview, type RegistrationSnapshot, type RegistrationViewState } from './RegistrationViews'

// Fixtures sintéticas de componentes; nenhuma API é simulada.
const church = { id: 'church-a', name: 'Igreja A' }
const snapshot: RegistrationSnapshot = {
  churchId: church.id, occurrenceId: 'occurrence-a', title: 'Encontro local', participation: 'registration',
  capacity: { kind: 'limited', total: 20, occupied: 19 }, waitlistEnabled: true, individual: { kind: 'confirmed' },
}
function show(state: RegistrationViewState = { kind: 'ready', snapshot }) {
  return render(<RegistrationOverview church={church} occurrenceId="occurrence-a" state={state}/> )
}

describe('resumo de capacidade isolado', () => {
  it('mostra capacidade, ocupação e vagas sem prometer confirmação', () => {
    render(<CapacitySummary capacity={{ kind: 'limited', total: 20, occupied: 19 }}/>)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('19')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/confirmação depende do servidor/)).toBeInTheDocument()
  })
  it.each([0, 20])('mostra lotação para capacidade %s', total => {
    render(<CapacitySummary capacity={{ kind: 'limited', total, occupied: total }}/>)
    expect(screen.getByRole('status')).toHaveTextContent('Sem vagas')
  })
  it.each([[20, 21], [-1, 0], [20, -1], [20, 1.5], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0]])('rejeita totais inconsistentes %s/%s', (total, occupied) => {
    render(<CapacitySummary capacity={{ kind: 'limited', total, occupied }}/>)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível validar as vagas')
    expect(screen.queryByText('Vagas disponíveis')).not.toBeInTheDocument()
  })
  it('não interpreta capacidade desconhecida como ilimitada', () => {
    render(<CapacitySummary capacity={{ kind: 'unknown' }}/>)
    expect(screen.getByText('Capacidade não informada.')).toBeInTheDocument()
    expect(screen.queryByText('Vagas disponíveis')).not.toBeInTheDocument()
  })
})

describe('inscrição individual isolada', () => {
  it('confirma inscrição sem afirmar presença ou conclusão da trilha', () => {
    show()
    expect(screen.getByRole('status')).toHaveTextContent('A inscrição não comprova presença nem conclusão de tarefas de Trilhas')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it.each([
    [{ kind: 'none' }, 'Nenhuma inscrição individual informada'],
    [{ kind: 'cancelled' }, 'Inscrição cancelada'],
    [{ kind: 'waiting', position: 3 }, 'Sua posição na lista de espera: 3'],
  ] as const)('apresenta situação %j', (individual, text) => {
    show({ kind: 'ready', snapshot: { ...snapshot, individual } })
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument()
  })
  it.each([0, -1, 1.5, Number.NaN])('não apresenta posição inválida %s como normal', position => {
    show({ kind: 'ready', snapshot: { ...snapshot, individual: { kind: 'waiting', position } } })
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível validar sua posição')
  })
  it('não mostra posição quando a lista está desabilitada', () => {
    show({ kind: 'ready', snapshot: { ...snapshot, waitlistEnabled: false, individual: { kind: 'waiting', position: 1 } } })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/Sua posição na lista/)).not.toBeInTheDocument()
  })
  it('evento aberto não mostra capacidade, inscrição nominal ou fila', () => {
    show({ kind: 'ready', snapshot: { churchId: church.id, occurrenceId: 'occurrence-a', title: 'Evento aberto', participation: 'open' } })
    expect(screen.getByText('Evento aberto: sem inscrições e sem presença individual.')).toBeInTheDocument()
    expect(screen.queryByText('Vagas disponíveis')).not.toBeInTheDocument()
    expect(screen.queryByText(/Lista de espera habilitada/)).not.toBeInTheDocument()
  })
  it.each(['churchId', 'occurrenceId'] as const)('não mostra snapshot de outro contexto: %s', field => {
    show({ kind: 'ready', snapshot: { ...snapshot, [field]: 'other' } })
    expect(screen.queryByText('Encontro local')).not.toBeInTheDocument()
    expect(screen.queryByText('Vagas disponíveis')).not.toBeInTheDocument()
  })
  it.each(['unavailable', 'loading', 'error', 'conflict'] as const)('remove dados anteriores no estado %s', kind => {
    const view = show()
    view.rerender(<RegistrationOverview church={church} occurrenceId="occurrence-a" state={{ kind }}/>)
    expect(screen.queryByText('Encontro local')).not.toBeInTheDocument()
    expect(screen.queryByText('Vagas disponíveis')).not.toBeInTheDocument()
    expect(screen.getByRole(kind === 'error' || kind === 'conflict' ? 'alert' : 'status')).toBeInTheDocument()
    if (kind === 'conflict') expect(screen.getByRole('alert')).toHaveTextContent('Nenhuma confirmação foi presumida')
  })
  it('não faz chamadas, não armazena dados e não reflete campos privados', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const privateSnapshot = { ...snapshot, privateOnlineUrl: 'https://private.invalid/secret', minorDocument: 'documento-secreto', personName: 'Nome secreto' }
    const { container } = show({ kind: 'ready', snapshot: privateSnapshot })
    expect(fetcher).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
    expect(container.innerHTML).not.toMatch(/private.invalid|documento-secreto|Nome secreto/)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    storage.mockRestore()
  })
})
