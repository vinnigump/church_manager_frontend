import EventAttendanceOptions from './EventAttendanceOptions'
import { DefaultChurchAccess } from '../church-context'
import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { discoverResources } from '../AuthorizedResources'
import { useAuth } from '../auth'
import { consultAuthorization } from '../authorization'
import { ContextOperation } from '../components/ContextOperation'

export default function EventAccess() {
  const { account } = useAuth()
  const [params] = useSearchParams(), action = params.get('acao'), selectedChurch = params.get('igreja')
  const permissions = action === 'tipos' ? ['EVENT_VIEW', 'EVENT_CREATE', 'EVENT_EDIT'] : action === 'criar' ? ['EVENT_CREATE'] : action === 'presencas' ? ['EVENT_VIEW', 'EVENT_ATTENDANCE_MANAGE'] : ['EVENT_VIEW']
  const permissionKey = permissions.join(':')
  const path = (church: string) => action === 'tipos' ? `/eventos/igrejas/${church}/catalogo` : action === 'criar' ? `/eventos/igrejas/${church}/cadastro/novo` : action === 'presencas' ? `/eventos?acao=presencas&igreja=${church}` : `/eventos/igrejas/${church}/cadastro`
  const [attempt, setAttempt] = useState(0)
  const titleId = useId()
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    if (!account) return []
    const contexts = await discoverResources(signal)
    if (signal.aborted) return []
    const churches = contexts.filter(context => context.resourceType === 'CHURCH')
    // Discovery does not grant EVENT_VIEW. Reject a partial/failed permission
    // snapshot, and let the destination/server reauthorize the actual operation.
    const decisions = await Promise.all(churches.map(async context => (await Promise.all(permissionKey.split(':').map(permissionCode => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: context.resourceId }, signal)))).some(Boolean)))
    return churches.filter((_context, index) => decisions[index])
  }, [account, permissionKey])
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  if (!account) return null
  return <section className="events-panel" aria-labelledby={titleId}>
    <h2 id={titleId}>Eventos das suas igrejas</h2>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>Atualizar acessos</button>
    <ContextOperation key={`${attempt}:${permissionKey}`} contextId={`event-access:${permissionKey}`} operation={load}>{state => {
      if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando seus acessos a eventos…</p>
      if (state.kind === 'error') return <p role="alert">Não foi possível carregar seus acessos a eventos. Tente atualizar os acessos.</p>
      if (action === 'presencas' && selectedChurch && state.data.some(v => v.resourceId === selectedChurch)) return <EventAttendanceOptions key={selectedChurch} church={selectedChurch}/>
      return state.data.length ? <DefaultChurchAccess  options={state.data.map(v => ({ churchId: v.resourceId, path: path(v.resourceId) }))}><ul className="event-list">{state.data.map(church => <li key={church.resourceId}>
        <h3>{church.label}</h3>
        <Link to={path(church.resourceId)}>{action === 'tipos' ? 'Consultar tipos de evento em' : action === 'criar' ? 'Criar evento em' : action === 'presencas' ? 'Conferir eventos de' : 'Consultar eventos de'} {church.label}</Link>
      </li>)}</ul></DefaultChurchAccess> : <p role="status">Você ainda não tem acesso à gestão de eventos de uma igreja.</p>
    }}</ContextOperation>
  </section>
}
