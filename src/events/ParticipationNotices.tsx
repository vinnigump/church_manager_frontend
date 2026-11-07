import { useId } from 'react'
import type { ChurchContext } from './presentation'
import './events.css'
import './participation-presentation.css'

// Projeção interna de apresentação. Não é contrato HTTP nem decisão de acesso.
export type AuthorizationNotice = 'notRequired' | 'unknown' | 'pending' | 'recorded' | 'rejected' | 'revoked'
export type AttendanceNotice = 'notRecorded' | 'validated' | 'invalidated' | 'noShow'
export type ParticipationSnapshot = {
  churchId: string
  occurrenceId: string
  subjectId: string
} & (
  | { participation: 'open' }
  | {
    participation: 'registration'
    registration: 'confirmed' | 'waiting' | 'cancelled' | 'unknown'
    authorization: AuthorizationNotice
    checkIn: { enabled: false } | { enabled: true; attendance: AttendanceNotice }
  }
)
export type ParticipationState =
  | { kind: 'unavailable' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; snapshot: ParticipationSnapshot }

function AuthorizationMessage({ authorization }: { authorization: AuthorizationNotice }) {
  switch (authorization) {
    case 'unknown': return <p className="participation-message participation-message--attention" role="alert">Não foi possível confirmar a autorização exigida. A participação não está liberada.</p>
    case 'pending': return <p className="participation-message participation-message--attention" role="alert">Autorização pendente: a participação está bloqueada. A pendência não cancela uma inscrição confirmada nem libera sua vaga.</p>
    case 'revoked': return <p className="participation-message participation-message--attention" role="alert">Autorização revogada: a participação está bloqueada. A revogação não cancela a inscrição automaticamente.</p>
    case 'rejected': return <p className="participation-message participation-message--attention" role="alert">Autorização rejeitada: a participação está bloqueada. Consulte as orientações da organização.</p>
    case 'recorded': return <p className="participation-message">Autorização registrada. O servidor deve confirmar sua validade e a permissão para participar em cada operação.</p>
    case 'notRequired': return <p className="participation-message">Autorização de responsável não exigida pela política informada. Isso não concede permissão para participar.</p>
  }
}

function AttendanceMessage({ attendance }: { attendance: AttendanceNotice }) {
  switch (attendance) {
    case 'notRecorded': return <p className="participation-message">Presença ainda não registrada. Inscrição não comprova presença.</p>
    case 'validated': return <p className="participation-message participation-message--recorded">Presença validada informada pelo servidor. A atualização de tarefas de Trilhas depende do processamento no backend.</p>
    case 'invalidated': return <p className="participation-message participation-message--attention">Presença invalidada informada pelo servidor. A revisão das evidências de Trilhas pertence ao backend.</p>
    case 'noShow': return <p className="participation-message">Ausência informada pelo servidor.</p>
  }
}

// Montar apenas após contrato validado, com projeção autorizada para o sujeito atual.
// Não receber nomes, documentos, URLs, QR, assinatura ou detalhes de responsáveis.
export function ParticipationNotices({ church, occurrenceId, subjectId, state }: {
  church: ChurchContext; occurrenceId: string; subjectId: string; state: ParticipationState
}) {
  const id = useId()
  let content
  switch (state.kind) {
    case 'unavailable': content = <p className="participation-message" role="status">As informações de autorização e presença ainda não estão disponíveis.</p>; break
    case 'loading': content = <p className="participation-message" role="status">Carregando informações de participação…</p>; break
    case 'error': content = <p className="participation-message participation-message--error" role="alert">Não foi possível carregar a participação. Nenhuma autorização ou presença foi presumida.</p>; break
    case 'ready': {
      const { snapshot } = state
      if (snapshot.churchId !== church.id || snapshot.occurrenceId !== occurrenceId || snapshot.subjectId !== subjectId) {
        content = <p className="participation-message" role="status">As informações deste participante não estão disponíveis.</p>
        break
      }
      if (snapshot.participation === 'open') {
        content = <p className="participation-message">Evento aberto: sem inscrição, check-in ou presença individual.</p>
        break
      }
      content = <>
        <p className="participation-registration">{{ confirmed: 'Inscrição confirmada.', waiting: 'Na lista de espera; sem vaga confirmada.', cancelled: 'Inscrição cancelada.', unknown: 'Situação da inscrição não confirmada.' }[snapshot.registration]}</p>
        <div className="participation-grid">
          <section className="participation-group" aria-labelledby={`${id}-authorization`}><h3 id={`${id}-authorization`}>Autorização</h3><AuthorizationMessage authorization={snapshot.authorization}/></section>
          <section className="participation-group" aria-labelledby={`${id}-attendance`}><h3 id={`${id}-attendance`}>Presença</h3>
            {snapshot.checkIn.enabled ? <><p>Check-in único por ocorrência, inclusive em eventos de múltiplos dias.</p><AttendanceMessage attendance={snapshot.checkIn.attendance}/></> : <p className="participation-message">Check-in desabilitado nesta ocorrência. Nenhuma ausência é inferida.</p>}
          </section>
        </div>
        <p className="participation-hint">Estes avisos não liberam participação nem validam presença. A decisão é do servidor.</p>
      </>
      break
    }
  }
  return <section className="events-panel participation-panel" aria-labelledby={`${id}-title`} aria-busy={state.kind === 'loading'}><h2 id={`${id}-title`}>Autorização e presença</h2>{content}</section>
}
