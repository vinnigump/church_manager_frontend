import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ParticipationNotices, type ParticipationSnapshot, type ParticipationState } from './ParticipationNotices'

// Fixtures de apresentação; nenhum contrato backend é simulado.
const church = { id: 'church-a', name: 'Igreja A' }
const snapshot: ParticipationSnapshot = { churchId: church.id, occurrenceId: 'occurrence-a', subjectId: 'subject-a', participation: 'registration', registration: 'confirmed', authorization: 'pending', checkIn: { enabled: true, attendance: 'notRecorded' } }
function show(state: ParticipationState = { kind: 'ready', snapshot }) {
  return render(<ParticipationNotices church={church} occurrenceId="occurrence-a" subjectId="subject-a" state={state}/> )
}
describe('avisos isolados de autorização e presença', () => {
  it('pendência bloqueia participação sem cancelar inscrição ou liberar vaga', () => {
    show()
    expect(screen.getByText('Inscrição confirmada.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('participação está bloqueada')
    expect(screen.getByRole('alert')).toHaveTextContent('não cancela uma inscrição confirmada nem libera sua vaga')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('revogação bloqueia participação sem mudar inscrição', () => {
    show({ kind: 'ready', snapshot: { ...snapshot, authorization: 'revoked' } })
    expect(screen.getByText('Inscrição confirmada.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('não cancela a inscrição automaticamente')
  })
  it.each([
    ['unknown', 'A participação não está liberada'],
    ['recorded', 'O servidor deve confirmar sua validade'],
    ['notRequired', 'Isso não concede permissão para participar'],
  ] as const)('não transforma autorização %s em permissão', (authorization, text) => {
    show({ kind: 'ready', snapshot: { ...snapshot, authorization } })
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it.each([
    ['waiting', 'Na lista de espera; sem vaga confirmada.'],
    ['cancelled', 'Inscrição cancelada.'],
    ['unknown', 'Situação da inscrição não confirmada.'],
  ] as const)('mantém situação de inscrição %s separada', (registration, text) => {
    show({ kind: 'ready', snapshot: { ...snapshot, registration } })
    expect(screen.getByText(text)).toBeInTheDocument()
  })
  it.each([
    ['notRecorded', 'Inscrição não comprova presença'],
    ['validated', 'atualização de tarefas de Trilhas depende do processamento no backend'],
    ['invalidated', 'revisão das evidências de Trilhas pertence ao backend'],
    ['noShow', 'Ausência informada pelo servidor'],
  ] as const)('apresenta presença %s sem executar reconciliação', (attendance, text) => {
    show({ kind: 'ready', snapshot: { ...snapshot, authorization: 'recorded', checkIn: { enabled: true, attendance } } })
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument()
    expect(screen.getByText('Check-in único por ocorrência, inclusive em eventos de múltiplos dias.')).toBeInTheDocument()
  })
  it('não calcula ausência quando check-in está desabilitado', () => {
    show({ kind: 'ready', snapshot: { ...snapshot, checkIn: { enabled: false } } })
    expect(screen.getByText('Check-in desabilitado nesta ocorrência. Nenhuma ausência é inferida.')).toBeInTheDocument()
    expect(screen.queryByText(/Ausência informada pelo servidor/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Check-in único/)).not.toBeInTheDocument()
  })
  it('evento aberto não apresenta inscrição nominal ou autorização', () => {
    show({ kind: 'ready', snapshot: { churchId: church.id, occurrenceId: 'occurrence-a', subjectId: 'subject-a', participation: 'open' } })
    expect(screen.getByText('Evento aberto: sem inscrição, check-in ou presença individual.')).toBeInTheDocument()
    expect(screen.queryByText('Inscrição confirmada.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each(['churchId', 'occurrenceId', 'subjectId'] as const)('oculta snapshot de outro contexto %s', field => {
    show({ kind: 'ready', snapshot: { ...snapshot, [field]: 'other' } })
    expect(screen.getByRole('status')).toHaveTextContent('não estão disponíveis')
    expect(screen.queryByText('Inscrição confirmada.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each(['unavailable', 'loading', 'error'] as const)('remove dados anteriores em %s', kind => {
    const view = show()
    view.rerender(<ParticipationNotices church={church} occurrenceId="occurrence-a" subjectId="subject-a" state={{ kind }}/>)
    expect(screen.queryByText('Inscrição confirmada.')).not.toBeInTheDocument()
    expect(screen.getByRole(kind === 'error' ? 'alert' : 'status')).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', String(kind === 'loading'))
  })
  it('não reflete dados privados, coleta evidências ou faz chamadas', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const privateSnapshot = { ...snapshot, name: 'Nome secreto', documentUrl: 'https://private.invalid/doc', qr: 'token-secreto', guardian: 'Responsável secreto' }
    const { container } = show({ kind: 'ready', snapshot: privateSnapshot })
    expect(container.innerHTML).not.toMatch(/Nome secreto|private.invalid|token-secreto|Responsável secreto/)
    expect(container.querySelector('input, canvas, video, img, a, button')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
    storage.mockRestore()
  })
})
