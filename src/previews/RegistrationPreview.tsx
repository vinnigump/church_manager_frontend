import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Brand from '../components/Brand'
import { RegistrationOverview, type RegistrationViewState } from '../events/RegistrationViews'
import '../style.css'

// Entrada exclusiva da prévia documental; não é rota nem fonte de dados do aplicativo.
const church = { id: 'preview-church', name: 'Comunidade de demonstração' }
const base = { churchId: church.id, occurrenceId: 'preview-occurrence', title: 'Encontro de demonstração', participation: 'registration', capacity: { kind: 'limited', total: 20, occupied: 19 }, waitlistEnabled: true, individual: { kind: 'confirmed' } } as const
const scenarios: Record<string, { label: string; state: RegistrationViewState }> = {
  confirmed: { label: 'Inscrição confirmada', state: { kind: 'ready', snapshot: base } },
  waiting: { label: 'Espera e capacidade ocupada', state: { kind: 'ready', snapshot: { ...base, capacity: { kind: 'limited', total: 20, occupied: 20 }, individual: { kind: 'waiting', position: 3 } } } },
  cancelled: { label: 'Inscrição cancelada', state: { kind: 'ready', snapshot: { ...base, individual: { kind: 'cancelled' } } } },
  none: { label: 'Inscrição não informada', state: { kind: 'ready', snapshot: { ...base, individual: { kind: 'none' } } } },
  unknownCapacity: { label: 'Capacidade não informada', state: { kind: 'ready', snapshot: { ...base, capacity: { kind: 'unknown' } } } },
  invalidCapacity: { label: 'Dados de capacidade inconsistentes', state: { kind: 'ready', snapshot: { ...base, capacity: { kind: 'limited', total: 20, occupied: 21 } } } },
  long: { label: 'Textos longos', state: { kind: 'ready', snapshot: { ...base, title: 'Encontro de demonstração com título longo para revisar quebra de texto em telas estreitas e ampliação', capacity: { kind: 'limited', total: 9999999, occupied: 9999996 } } } },
  open: { label: 'Evento aberto', state: { kind: 'ready', snapshot: { churchId: church.id, occurrenceId: base.occurrenceId, title: 'Evento aberto de demonstração', participation: 'open' } } },
  loading: { label: 'Carregando', state: { kind: 'loading' } },
  error: { label: 'Erro', state: { kind: 'error' } },
  conflict: { label: 'Conflito', state: { kind: 'conflict' } },
  unavailable: { label: 'Indisponível', state: { kind: 'unavailable' } },
}
export function RegistrationPreview() {
  const [selected, setSelected] = useState('confirmed')
  const context = selected === 'long' ? { ...church, name: 'Comunidade de demonstração com nome longo para revisão de texto e disposição dos cartões' } : church
  return <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem' }}>
    <Brand/><h1>Prévia isolada de inscrições</h1>
    <p>Dados sintéticos para revisão de componentes. Sem API, vagas ou inscrições reais.</p>
    <label htmlFor="registration-scenario">Cenário de demonstração</label>{' '}
    <select id="registration-scenario" value={selected} onChange={event => setSelected(event.target.value)} style={{ font: 'inherit', minHeight: '44px', maxWidth: '100%' }}>
      {Object.entries(scenarios).map(([value, scenario]) => <option key={value} value={value}>{scenario.label}</option>)}
    </select>
    <RegistrationOverview church={context} occurrenceId={base.occurrenceId} state={(scenarios[selected] ?? scenarios.confirmed).state}/>
  </main>
}
const target = document.getElementById('registration-preview')
if (target) createRoot(target).render(<RegistrationPreview/>)
