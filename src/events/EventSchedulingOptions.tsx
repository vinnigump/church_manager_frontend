import BrazilianDateTimeField from '../components/BrazilianDateTimeField'
export interface SchedulingFields {
  repeats: boolean; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; interval: string; through: string
  registrationWindow: boolean; opensAt: string; closesAt: string; visitorRegistration: boolean
}
export const defaultSchedulingFields = (): SchedulingFields => ({ repeats: false, frequency: 'WEEKLY', interval: '1', through: '', registrationWindow: false, opensAt: '', closesAt: '', visitorRegistration: false })
export default function EventSchedulingOptions({ value, change, registrationRequired, visitorCompatible, startsAt }: {
  value: SchedulingFields; change: (value: SchedulingFields) => void; registrationRequired: boolean; visitorCompatible: boolean; startsAt: string
}) {
  const set = <K extends keyof SchedulingFields>(key: K, next: SchedulingFields[K]) => change({ ...value, [key]: next })
  return <section className="record-form-section"><h2>Repetição e inscrições</h2>
    <label><input type="checkbox" checked={value.repeats} onChange={e => set('repeats', e.target.checked)}/>Este evento se repete</label>
    {value.repeats && <fieldset><legend>Repetição</legend><label>Frequência<select value={value.frequency} onChange={e => set('frequency', e.target.value as SchedulingFields['frequency'])}><option value="DAILY">Diária</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option></select></label><label>A cada quantos períodos<input required type="number" min="1" max="366" step="1" value={value.interval} onChange={e => set('interval', e.target.value)}/></label><label>Repetir até<input required type="date" min={startsAt.slice(0, 10)} max={startsAt ? `${startsAt.slice(0, 4)}-12-31` : undefined} value={value.through} onChange={e => set('through', e.target.value)}/></label><p>Todas as datas usam o horário de Brasília, a mesma duração e os mesmos dados. O término deve ficar no mesmo ano. Meses sem o dia escolhido seguem o ajuste de calendário do sistema.</p></fieldset>}
    {registrationRequired && <><label><input type="checkbox" checked={value.registrationWindow} onChange={e => set('registrationWindow', e.target.checked)}/>Definir período para inscrições</label>{value.registrationWindow && <fieldset><legend>Período de inscrições</legend><label>Abertura<BrazilianDateTimeField required value={value.opensAt} max={value.closesAt || startsAt} onChange={e => set('opensAt', e.target.value)}/></label><label>Fechamento<BrazilianDateTimeField required value={value.closesAt} min={value.opensAt} max={startsAt} onChange={e => set('closesAt', e.target.value)}/></label><p>O mesmo período vale para todas as repetições e deve terminar até o início do primeiro evento.</p></fieldset>}
      <label><input type="checkbox" disabled={!visitorCompatible} checked={visitorCompatible && value.visitorRegistration} onChange={e => set('visitorRegistration', e.target.checked)}/>Permitir inscrição pública sem cadastro</label>{!visitorCompatible && <p>Disponível para audiência pública sem exigência de vínculo, membresia, cargo ou grupo, e com idade máxima compatível com adultos.</p>}</>}
  </section>
}
