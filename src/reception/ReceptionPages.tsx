import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { discoverResources } from '../AuthorizedResources'
import { useAuth } from '../auth'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { receptionDeliveries, receptionSummary, type Badge, type Delivery } from './reception-api'
import { BadgeQr, BadgesForm, CloseForm, DeliverForm } from './ReceptionForms'
import './reception.css'

function Access() {
  const load = useCallback(async (_key: string, signal: AbortSignal) => {
    const contexts = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const decisions = await Promise.all(contexts.map(v => consultAuthorization({ permissionCode: 'BADGE_MANAGE', resourceType: 'CHURCH', resourceId: v.resourceId }, signal)))
    return contexts.filter((_v, i) => decisions[i])
  }, [])
  const [epoch, setEpoch] = useState(0)
  return <><p>Escolha a igreja para entregar ou recolher crachás.</p><button onClick={() => setEpoch(v => v + 1)}>Atualizar meus acessos</button>
    <ContextOperation key={epoch} contextId="reception-access" operation={load}>{state => state.kind === 'loading' ? <p role="status">Carregando igrejas…</p> : state.kind === 'error' ? <p role="alert">Não foi possível consultar seus acessos à recepção.</p>
      : state.data.length ? <ul>{state.data.map(v => <li key={v.resourceId}><Link to={`/recepcao/igrejas/${v.resourceId}`}>Recepção de {v.label}</Link></li>)}</ul> : <p>Você ainda não tem acesso à recepção de uma igreja.</p>}
    </ContextOperation>
  </>
}
function Pending({ church, onLoss }: { church: string; onLoss: (delivery: Delivery) => void }) {
  const [page, setPage] = useState(0)
  const load = useCallback(async (signal: AbortSignal) => {
    const [summary, deliveries] = await Promise.all([receptionSummary(church, signal), receptionDeliveries(church, page, signal)])
    return { summary, deliveries }
  }, [church, page]), query = useRead(`${church}:${page}`, load)
  return <ReadResult query={query} label="contagem e pendências">{({ summary: s, deliveries }) => {
    const date = (instant: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: s.timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant))
    return <>
      <section aria-label="Contagem de crachás"><h2>Faltam recolher {s.pendingTotal} crachás</h2>
        <p>Dia {s.day.split('-').reverse().join('/')} · {s.timeZone} · consulta do servidor às {date(s.referenceAt)}.</p>
        <dl className="reception-counters"><div><dt>Distribuídos hoje</dt><dd>{s.distributed}</dd></div><div><dt>Devolvidos das entregas de hoje</dt><dd>{s.returned}</dd></div>
          <div><dt>Perdidos das entregas de hoje</dt><dd>{s.lost}</dd></div><div><dt>Pendentes das entregas de hoje</dt><dd>{s.pending}</dd></div><div><dt>Pendentes de dias anteriores</dt><dd>{s.pendingFromEarlierDays}</dd></div>
        </dl><p>As entregas de outros dias continuam pendentes até devolução ou registro de perda.</p>
      </section>
      <section aria-label="Crachás a recolher"><h2>Crachás a recolher</h2><p>{deliveries.total} entregas abertas · página {page + 1}</p>
        {deliveries.items.length ? <ul className="reception-pending">{deliveries.items.map(v => <li key={v.id}><h3>Crachá {v.badgeLabel} · {v.personName}</h3>
          <p>{v.ministryName}{v.departmentName ? ` · ${v.departmentName}` : ''} · entregue em <time dateTime={v.issuedAt}>{date(v.issuedAt)}</time></p>
          <p>Para devolver, leia o QR do crachá físico.</p><button onClick={() => onLoss(v)}>Revisar perda do crachá {v.badgeLabel}</button>
        </li>)}</ul> : <p>Nenhum crachá pendente nesta página.</p>}
        <Pagination page={page} total={deliveries.total} setPage={setPage} label="Páginas dos crachás a recolher"/>
      </section>
    </>
  }}</ReadResult>
}
function Workspace({ church }: { church: string }) {
  const [mode, setMode] = useState<'issue' | 'close' | 'badges'>('issue'), [epoch, setEpoch] = useState(0), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [lastBadge, setLastBadge] = useState<Badge | null>(null), [lost, setLost] = useState<Delivery | null>(null), [lossEpoch, setLossEpoch] = useState(0)
  const loadName = useCallback(async (signal: AbortSignal) => (await discoverResources(signal)).find(v => v.resourceType === 'CHURCH' && v.resourceId === church)?.label ?? 'Igreja selecionada', [church])
  const name = useRead(church, loadName)
  const done = useCallback((text: string, badge?: Badge) => { setBusy(false); setMessage(text); setLastBadge(badge ?? null); setLost(null); setEpoch(v => v + 1) }, [])
  function reload() { if (busy) return; setMessage(''); setLastBadge(null); setLost(null); setEpoch(v => v + 1) }
  return <>
    {name.state.kind === 'ready' && <h2>{name.state.data}</h2>}
    <button disabled={busy} onClick={reload}>Atualizar recepção</button>{busy && <p role="status" aria-busy="true">Aguarde a confirmação do servidor…</p>}
    <ResourceAccess key={epoch} permissionCode="BADGE_MANAGE" resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
      {message && <p role="status" className="reception-message">{message}</p>}{lastBadge && <BadgeQr badge={lastBadge}/>}
      <fieldset disabled={busy} className="reception-workspace"><legend>Atendimento da recepção</legend>
        <nav aria-label="Operações de recepção"><button aria-pressed={mode === 'issue'} onClick={() => { setMode('issue'); setLost(null) }}>Entregar</button>{' '}
          <button aria-pressed={mode === 'close'} onClick={() => { setMode('close'); setLost(null) }}>Devolver ou registrar perda</button>{' '}
          <button aria-pressed={mode === 'badges'} onClick={() => { setMode('badges'); setLost(null) }}>Crachás e QR Codes</button>
        </nav>
        {mode === 'issue' ? <DeliverForm church={church} onBusy={setBusy} onDone={done}/> : mode === 'close' ? <CloseForm key={`${lost?.id ?? 'scan'}:${lossEpoch}`} church={church} onBusy={setBusy} onDone={done} lost={lost}/> : <BadgesForm church={church} onBusy={setBusy} onDone={done}/>}
        <Pending church={church} onLoss={value => { if (!busy) { setLost(value); setLossEpoch(v => v + 1); setMode('close') } }}/>
      </fieldset>
    </ResourceAccess>
  </>
}
export default function ReceptionPages() {
  const { churchId } = useParams(), { account } = useAuth(), [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <div className="reception"><h1 data-page-title="Recepção">Recepção</h1><p>Entregue e recolha os crachás de atuação da igreja.</p>
    {churchId === undefined ? <Access key={scope.epoch}/> : !isUuid(churchId) ? <p role="alert">Igreja inválida. Volte à recepção e selecione novamente.</p> : <>
      <p><Link to="/recepcao">Trocar igreja</Link></p><ResourceAccess permissionCode="BADGE_MANAGE" resourceType="CHURCH" resourceId={churchId}>
        <Workspace key={`${scope.epoch}:${churchId}`} church={churchId}/>
      </ResourceAccess>
    </>}
  </div>
}
