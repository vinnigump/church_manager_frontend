import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { discoverResources } from '../AuthorizedResources'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { Pagination, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { firstAccessCandidates, firstAccessPermission, issueFirstAccess, type FirstAccessCandidate, type IssuedLink } from './first-access-api'
function Access() {
  const load = useCallback(async (signal: AbortSignal) => { const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH'); const allowed = await Promise.all(churches.map(v => consultAuthorization({ permissionCode: firstAccessPermission, resourceType: 'CHURCH', resourceId: v.resourceId }, signal))); return churches.filter((_v, i) => allowed[i]) }, [])
  const query = useRead('first-access-churches', load)
  return query.state.kind === 'loading' ? <p role="status">Consultando acessos…</p> : query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : query.state.data.length ? <ul>{query.state.data.map(v => <li key={v.resourceId}><Link to={`/pessoas/primeiro-acesso/igrejas/${v.resourceId}`}>Primeiro acesso em {v.label}</Link></li>)}</ul> : <p>Nenhuma igreja disponível para gerar links de primeiro acesso.</p>
}
function Workspace({ church }: { church: string }) {
  const [field, setField] = useState(''), [q, setQ] = useState(''), [page, setPage] = useState(0), [epoch, setEpoch] = useState(0)
  const [selected, setSelected] = useState<FirstAccessCandidate | null>(null), [issued, setIssued] = useState<IssuedLink | null>(null)
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback((signal: AbortSignal) => firstAccessCandidates(church, q, page, signal), [church, q, page]), query = useRead(JSON.stringify([church,q,page,epoch]), load)
  async function issue() {
    if (!selected || pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { const result = await issueFirstAccess(church, selected.personId, controller.signal); if (!controller.signal.aborted) setIssued(result) }
    catch { if (!controller.signal.aborted) { setBlocked(true); setMessage('Não foi possível confirmar a geração. Consulte novamente antes de gerar outro link. Um novo link invalida o anterior ainda não utilizado.') } }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function refresh() { if (pending.current) return; setIssued(null); setSelected(null); setBlocked(false); setMessage(''); setEpoch(v => v + 1) }
  return <><p>O titular escolherá seu login e sua senha. O link não cria membresia nem concede permissões administrativas.</p>
    <button disabled={busy} onClick={refresh}>{issued ? 'Concluir e consultar outras pessoas' : 'Consultar novamente'}</button>
    {message && <p role="alert">{message}</p>}{busy && <p role="status">Gerando link individual…</p>}
    {issued ? <section><h2>Link de {selected?.displayName}</h2><label>Link individual<input readOnly value={new URL(issued.relativeUrl, window.location.origin).href} onFocus={e => e.target.select()}/></label>
      <p>Copie e entregue somente ao titular. Válido até {new Date(issued.expiresAt).toLocaleString('pt-BR')} (horário deste dispositivo).</p>
      <p>O link só pode ser utilizado uma vez. O login e a senha serão escolhidos pela pessoa.</p>
    </section> : <fieldset disabled={busy || blocked}><legend>Pessoas sem conta</legend>
      <form onSubmit={e => { e.preventDefault(); setQ(field.trim()); setPage(0); setSelected(null) }}><label>Pesquisar pelo nome<input maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar</button></form>
      {query.state.kind === 'loading' ? <p role="status">Carregando pessoas…</p> : query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : <>
        {query.state.data.items.length ? <ul>{query.state.data.items.map(v => <li key={v.personId}>{v.displayName} <button onClick={() => setSelected(v)}>Selecionar {v.displayName}</button></li>)}</ul> : <p>Nenhuma pessoa sem conta encontrada.</p>}
        <Pagination page={page} total={query.state.data.total} setPage={v => { setSelected(null); setPage(v) }} label="Páginas das pessoas sem conta"/>
        {selected && query.state.data.items.some(v => v.personId === selected.personId) && <section><h2>Gerar link para {selected.displayName}?</h2><p>O link anterior ainda não utilizado deixará de funcionar.</p><button onClick={() => void issue()}>Gerar link individual</button></section>}
      </>}
    </fieldset>}
  </>
}
export default function FirstAccessStaffPages({ directory = false }: { directory?: boolean }) {
  const { churchId = '' } = useParams(), { account } = useAuth(), [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <section key={`${scope.epoch}:${churchId}`}><h1 data-page-title="Primeiro acesso">Links de primeiro acesso</h1><Link to="/pessoas">Voltar a Pessoas</Link>
    {!directory ? <Access/> : !isUuid(churchId) ? <p role="alert">Igreja inválida.</p> : <ResourceAccess permissionCode={firstAccessPermission} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><Workspace church={churchId}/></ResourceAccess>}
  </section>
}
