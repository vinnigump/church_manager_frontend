import { useId } from 'react'
import type { ChurchContext } from './presentation'
import './events.css'
import './registration-presentation.css'

// Modelos de apresentação isolados; não são contratos HTTP ou permissões.
export type IndividualRegistration =
  | { kind: 'none' }
  | { kind: 'confirmed' }
  | { kind: 'cancelled' }
  | { kind: 'waiting'; position: number }

export type RegistrationSnapshot = {
  churchId: string
  occurrenceId: string
  title: string
} & (
  | { participation: 'open' }
  | {
    participation: 'registration'
    capacity: { kind: 'unknown' } | { kind: 'limited'; total: number; occupied: number }
    waitlistEnabled: boolean
    individual: IndividualRegistration
  }
)

export type RegistrationViewState =
  | { kind: 'unavailable' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'conflict' }
  | { kind: 'ready'; snapshot: RegistrationSnapshot }

export function CapacitySummary({ capacity }: { capacity: { kind: 'unknown' } | { kind: 'limited'; total: number; occupied: number } }) {
  if (capacity.kind === 'unknown') return <p className="registration-notice">Capacidade não informada.</p>
  const { total, occupied } = capacity
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(occupied) || total < 0 || occupied < 0 || occupied > total) {
    return <p className="registration-notice registration-notice--error" role="alert">Não foi possível validar as vagas. Atualize os dados antes de continuar.</p>
  }
  return <div><dl className="event-summary registration-capacity"><div><dt>Capacidade</dt><dd>{total}</dd></div><div><dt>Vagas ocupadas</dt><dd>{occupied}</dd></div><div><dt>Vagas disponíveis</dt><dd>{total - occupied}</dd></div></dl>
    {occupied === total && <p className="registration-notice registration-notice--attention" role="status">Sem vagas disponíveis.</p>}
    <p className="registration-hint">As vagas podem mudar. A confirmação depende do servidor.</p>
  </div>
}

function IndividualSummary({ individual, waitlistEnabled }: { individual: IndividualRegistration; waitlistEnabled: boolean }) {
  switch (individual.kind) {
    case 'none': return <p className="registration-notice">Nenhuma inscrição individual informada.</p>
    case 'confirmed': return <p className="registration-notice registration-notice--confirmed" role="status">Inscrição confirmada. A inscrição não comprova presença nem conclusão de tarefas de Trilhas.</p>
    case 'cancelled': return <p className="registration-notice" role="status">Inscrição cancelada.</p>
    case 'waiting':
      if (!waitlistEnabled || !Number.isSafeInteger(individual.position) || individual.position < 1) {
        return <p className="registration-notice registration-notice--error" role="alert">Não foi possível validar sua posição na espera. Atualize os dados.</p>
      }
      return <p className="registration-notice registration-notice--attention" role="status">Sua posição na lista de espera: {individual.position}. Estar na fila não confirma uma vaga.</p>
  }
}

// Receber somente a projeção do sujeito autorizado pelo backend. Nenhuma lista nominal,
// link privado, documento ou capacidade de escrita é aceita por este componente.
export function RegistrationOverview({ church, occurrenceId, state }: { church: ChurchContext; occurrenceId: string; state: RegistrationViewState }) {
  const id = useId()
  let content
  switch (state.kind) {
    case 'unavailable': content = <p className="registration-notice" role="status">As inscrições ainda não estão disponíveis.</p>; break
    case 'loading': content = <p className="registration-notice" role="status">Carregando inscrições…</p>; break
    case 'error': content = <p className="registration-notice registration-notice--error" role="alert">Não foi possível carregar as inscrições. Tente novamente mais tarde.</p>; break
    case 'conflict': content = <p className="registration-notice registration-notice--attention" role="alert">Os dados de inscrição ou vagas mudaram. Atualize os dados antes de tentar novamente. Nenhuma confirmação foi presumida.</p>; break
    case 'ready': {
      const { snapshot } = state
      if (snapshot.churchId !== church.id || snapshot.occurrenceId !== occurrenceId) {
        content = <p className="registration-notice" role="status">Os dados desta ocorrência não estão disponíveis.</p>
        break
      }
      content = <><h3>{snapshot.title}</h3>{snapshot.participation === 'open'
        ? <p className="registration-notice">Evento aberto: sem inscrições e sem presença individual.</p>
        : <><CapacitySummary capacity={snapshot.capacity}/><p>{snapshot.waitlistEnabled ? 'Lista de espera habilitada.' : 'Este evento não utiliza lista de espera.'}</p><IndividualSummary individual={snapshot.individual} waitlistEnabled={snapshot.waitlistEnabled}/></>}</>
      break
    }
  }
  return <section className="events-panel registration-panel" aria-labelledby={`${id}-title`} aria-busy={state.kind === 'loading'}><h2 id={`${id}-title`}>Inscrição individual</h2><p className="registration-context">Igreja: {church.name}</p>{content}</section>
}
