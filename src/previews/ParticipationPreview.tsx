import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Brand from '../components/Brand'
import { ParticipationNotices, type ParticipationState } from '../events/ParticipationNotices'
import '../style.css'

// Entrada exclusiva da prévia documental; nunca importada pelo aplicativo.
const church = { id: 'preview-church', name: 'Comunidade de demonstração' }
const base = { churchId: church.id, occurrenceId: 'preview-occurrence', subjectId: 'preview-subject', participation: 'registration', registration: 'confirmed', authorization: 'pending', checkIn: { enabled: true, attendance: 'notRecorded' } } as const
const scenarios: Record<string, { label: string; state: ParticipationState }> = {
  pending: { label: 'Inscrição confirmada, autorização pendente', state: { kind: 'ready', snapshot: base } },
  recorded: { label: 'Autorização registrada, presença não registrada', state: { kind: 'ready', snapshot: { ...base, authorization: 'recorded' } } },
  validated: { label: 'Presença validada informada', state: { kind: 'ready', snapshot: { ...base, authorization: 'recorded', checkIn: { enabled: true, attendance: 'validated' } } } },
  revoked: { label: 'Autorização revogada', state: { kind: 'ready', snapshot: { ...base, authorization: 'revoked' } } },
  rejected: { label: 'Autorização rejeitada', state: { kind: 'ready', snapshot: { ...base, authorization: 'rejected' } } },
  waiting: { label: 'Lista de espera', state: { kind: 'ready', snapshot: { ...base, registration: 'waiting', authorization: 'unknown' } } },
  noCheckIn: { label: 'Check-in desabilitado', state: { kind: 'ready', snapshot: { ...base, authorization: 'notRequired', checkIn: { enabled: false } } } },
  noShow: { label: 'Ausência informada', state: { kind: 'ready', snapshot: { ...base, authorization: 'recorded', checkIn: { enabled: true, attendance: 'noShow' } } } },
  open: { label: 'Evento aberto', state: { kind: 'ready', snapshot: { churchId: church.id, occurrenceId: base.occurrenceId, subjectId: base.subjectId, participation: 'open' } } },
  loading: { label: 'Carregando', state: { kind: 'loading' } },
  error: { label: 'Erro', state: { kind: 'error' } },
  unavailable: { label: 'Indisponível', state: { kind: 'unavailable' } },
}
export function ParticipationPreview() {
  const [selected, setSelected] = useState('pending')
  return <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem' }}>
    <Brand/><h1>Prévia isolada de participação</h1>
    <p>Dados sintéticos para revisão de componentes. Sem API, inscrições, autorização ou check-in reais.</p>
    <label htmlFor="participation-scenario">Cenário de demonstração</label>{' '}
    <select id="participation-scenario" value={selected} onChange={event => setSelected(event.target.value)} style={{ font: 'inherit', minHeight: '44px', maxWidth: '100%' }}>
      {Object.entries(scenarios).map(([value, scenario]) => <option key={value} value={value}>{scenario.label}</option>)}
    </select>
    <ParticipationNotices church={church} occurrenceId={base.occurrenceId} subjectId={base.subjectId} state={(scenarios[selected] ?? scenarios.pending).state}/>
  </main>
}
const target = document.getElementById('participation-preview')
if (target) createRoot(target).render(<ParticipationPreview/>)
