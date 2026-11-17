import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination } from '../security/SecurityPages'
import { ownRosters, type OwnRoster } from './roster-api'
import './rosters.css'

export function RosterDates({ value }: { value: Pick<OwnRoster, 'startsAt' | 'endsAt' | 'timeZone'> }) {
  const format = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: value.timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
  return <p><time dateTime={value.startsAt}>{format(value.startsAt)}</time> até <time dateTime={value.endsAt}>{format(value.endsAt)}</time> ({value.timeZone})</p>
}
function OwnCard({ value }: { value: OwnRoster }) {
  return <li><h3>{value.departmentName ? `${value.departmentName} · ${value.ministryName}` : value.ministryName}</h3><p>{value.churchName}</p><RosterDates value={value}/>
    {value.eventLinked && <p className="roster-event"><strong>{value.eventName ? `Você está escalado para ${value.eventName}` : 'Atuação vinculada a um evento'}</strong></p>}
    <p>{value.present ? 'Presença registrada manualmente' : 'Presença ainda não registrada'}</p>
  </li>
}
export default function OwnServiceRosters({ full = false }: { full?: boolean }) {
  const { account } = useAuth(), [page, setPage] = useState(0), [epoch, setEpoch] = useState(0)
  const load = useCallback((_context: string, signal: AbortSignal) => ownRosters(full ? page : 0, signal, undefined, !full), [account, full, page])
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  if (!account) return null
  return <section className="rosters" aria-label="Minhas escalas"><h2>Minhas escalas</h2>
    {!full && <p>Atuações em andamento e futuras, pelo horário do servidor.</p>}
    <button type="button" onClick={() => setEpoch(v => v + 1)}>Atualizar minhas escalas</button>
    <ContextOperation contextId={`${page}:${epoch}`} operation={load}>{state => {
      if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando suas escalas…</p>
      if (state.kind === 'error') return <p role="alert">Não foi possível carregar suas escalas. Atualize a consulta.</p>
      const data = state.data, items = full ? data.items : data.items.slice(0, 5)
      return <>{items.length ? <ul className="event-list">{items.map(v => <OwnCard key={v.rosterId} value={v}/>)}</ul> : <p>{full ? 'Você ainda não tem escalas registradas.' : 'Você não tem atuações em andamento ou futuras.'}</p>}
        {full ? <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das minhas escalas"/> : <Link to="/minhas-escalas">Consultar todas as minhas escalas</Link>}
      </>
    }}</ContextOperation>
  </section>
}
