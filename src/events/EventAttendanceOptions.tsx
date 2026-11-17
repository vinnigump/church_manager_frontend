import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { ResourceAccess } from '../authorization'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { formatDateTime } from '../time'
import { isInstant, isUuid } from '../validation'
interface Option { id: string; name: string; startsAt: string; endsAt: string }
interface Page { items: Option[]; page: number; size: number; total: number }
export default function EventAttendanceOptions({ church }: { church: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback(async (signal: AbortSignal) => {
    const value = await api.request<Page>(`/events/churches/${church}/records/attendance-options?page=${page}&size=20`, { signal })
    if (!value || !Array.isArray(value.items) || value.page !== page || value.size !== 20 || !Number.isSafeInteger(value.total) || value.total < 0 || value.items.some(v => !v || !isUuid(v.id) || typeof v.name !== 'string' || !isInstant(v.startsAt) || !isInstant(v.endsAt))) throw new Error('Não foi possível validar os eventos para presença.')
    return value
  }, [church, page])
  const query = useRead(`${church}:${page}`, load)
  return <ReadResult query={query} label="eventos para presença">{value => <>
    <h2>Presenças nos eventos</h2><p>Eventos com inscrição e conferência nominal de presença.</p>
    {value.items.length ? <ul className="event-list">{value.items.map(v => <li key={v.id}><h3>{v.name}</h3><p>{formatDateTime(v.startsAt)} até {formatDateTime(v.endsAt)}</p><ResourceAccess permissionCode="EVENT_ATTENDANCE_MANAGE" resourceType="CHURCH" resourceId={church} optional fallback={<p>Seu acesso permite consultar os eventos; a conferência de presença exige autorização da equipe.</p>}><Link to={`/eventos/igrejas/${church}/ocorrencias/${v.id}/check-in`}>Conferir presença</Link></ResourceAccess></li>)}</ul> : <p>Nenhum evento com conferência de presença nesta igreja.</p>}
    <Pagination page={page} total={value.total} setPage={setPage} label="Páginas dos eventos para presença"/>
  </>}</ReadResult>
}
