import { useId } from 'react'
import type { ChurchContext } from './presentation'
import './events.css'

// Projeção interna de apresentação. Não é contrato HTTP nem decisão de acesso.
export type AuthorizationNotice = 'notRequired' | 'unknown' | 'pending' | 'recorded' | 'revoked'
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
    case 'unknown': return <p role="alert">Não foi possível confirmar a autorização exigida. A participação não está liberada.</p>
    case 'pending': return <p role="alert">Autorização pendente: a participação está bloqueada. A pendência não cancela uma inscrição confirmada nem libera sua vaga.</p>
    case 'revoked': return <p role="alert">Autorização revogada: a participação está bloqueada. A revogação não cancela a inscrição automaticamente.</p>
    case 'recorded': return <p>Autorização registrada. O servidor deve confirmar sua validade e a permissão para participar em cada operação.</p>
    case 'notRequired': return <p>Autorização de responsável não exigida pela política informada. Isso não concede permissão para participar.</p>
  }
}

function AttendanceMessage({ attendance }: { attendance: AttendanceNotice }) {
  switch (attendance) {
    case 'notRecorded': return <p>Presença ainda não registrada. Inscrição não comprova presença.</p>
    case 'validated': return <p>Presença validada informada pelo servidor. A atualização de tarefas de Trilhas depende do processamento no backend.</p>
    case 'invalidated': return <p>Presença invalidada informada pelo servidor. A revisão das evidências de Trilhas pertence ao backend.</p>
    case 'noShow': return <p>Ausência informada pelo servidor.</p>
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
    case 'unavailable': content = <p role="status">As informações de autorização e presença ainda não estão disponíveis.</p>; break
    case 'loading': content = <p role="status">Carregando informações de participação…</p>; break
    case 'error': content = <p role="alert">Não foi possível carregar a participação. Nenhuma autorização ou presença foi presumida.</p>; break
    case 'ready': {
      const { snapshot } = state
      if (snapshot.churchId !== church.id || snapshot.occurrenceId !== occurrenceId || snapshot.subjectId !== subjectId) {
        content = <p role="status">As informações deste participante não estão disponíveis.</p>
        break
      }
      if (snapshot.participation === 'open') {
        content = <p>Evento aberto: sem inscrição, check-in ou presença individual.</p>
        break
      }
      content = <>
        <p>{{ confirmed: 'Inscrição confirmada.', waiting: 'Na lista de espera; sem vaga confirmada.', cancelled: 'Inscrição cancelada.', unknown: 'Situação da inscrição não confirmada.' }[snapshot.registration]}</p>
        <AuthorizationMessage authorization={snapshot.authorization}/>
        {snapshot.checkIn.enabled ? <><p>Check-in único por ocorrência, inclusive em eventos de múltiplos dias.</p><AttendanceMessage attendance={snapshot.checkIn.attendance}/></> : <p>Check-in desabilitado nesta ocorrência. Nenhuma ausência é inferida.</p>}
        <p>Estes avisos não liberam participação nem validam presença. A decisão é do servidor.</p>
      </>
      break
    }
  }
  return <section className="events-panel" aria-labelledby={`${id}-title`} aria-busy={state.kind === 'loading'}><h2 id={`${id}-title`}>Autorização e presença</h2>{content}</section>
}
