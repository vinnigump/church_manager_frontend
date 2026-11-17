import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { discoverResources } from '../AuthorizedResources'
import { useAuth } from '../auth'
import { consultAuthorization } from '../authorization'
import { ContextOperation } from '../components/ContextOperation'

export default function EventAccess() {
  const { account } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const titleId = useId()
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    if (!account) return []
    const contexts = await discoverResources(signal)
    if (signal.aborted) return []
    const churches = contexts.filter(context => context.resourceType === 'CHURCH')
    // Discovery does not grant EVENT_VIEW. Reject a partial/failed permission
    // snapshot, and let the destination/server reauthorize the actual operation.
    const decisions = await Promise.all(churches.map(context => consultAuthorization({
      permissionCode: 'EVENT_VIEW', resourceType: 'CHURCH', resourceId: context.resourceId,
    }, signal)))
    return churches.filter((_context, index) => decisions[index])
  }, [account])
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  if (!account) return null
  return <section className="events-panel" aria-labelledby={titleId}>
    <h2 id={titleId}>Eventos das suas igrejas</h2>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>Atualizar acessos</button>
    <ContextOperation key={attempt} contextId="event-access" operation={load}>{state => {
      if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando seus acessos a eventos…</p>
      if (state.kind === 'error') return <p role="alert">Não foi possível carregar seus acessos a eventos. Tente atualizar os acessos.</p>
      return state.data.length ? <ul className="event-list">{state.data.map(church => <li key={church.resourceId}>
        <h3>{church.label}</h3>
        <Link to={`/eventos/igrejas/${church.resourceId}/cadastro`}>Consultar eventos de {church.label}</Link>
      </li>)}</ul> : <p role="status">Você ainda não tem acesso à gestão de eventos de uma igreja.</p>
    }}</ContextOperation>
  </section>
}
