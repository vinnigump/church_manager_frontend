import UiIcon from '../components/UiIcon'
import './reports.css'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { readReport, reportNames, reportPermission, type ReportKind } from './report-api'
function Access() {
  const load = useCallback(async (signal: AbortSignal) => { const resources = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH'); const allowed = await Promise.all(resources.map(v => consultAuthorization({ permissionCode: reportPermission, resourceType: 'CHURCH', resourceId: v.resourceId }, signal))); return resources.filter((_v, i) => allowed[i]) }, [])
  const query = useRead('essential-report-access', load)
  return <ReadResult query={query} label="acessos aos relatórios">{items => items.length ? <ul className="report-churches">{items.map(v => <li key={v.resourceId}><span className="report-church-icon"><UiIcon kind="church"/></span><Link to={`/relatorios/igrejas/${v.resourceId}`}>Relatórios de {v.label}</Link></li>)}</ul> : <p>Nenhuma igreja disponível para consultar relatórios.</p>}</ReadResult>
}
const statusName = (value: string) => ({ ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', NONE: 'Sem membresia ativa ou suspensa', SCHEDULED: 'Previsto, sem presença registrada', PRESENT: 'Presença manual registrada', OPEN: 'A recolher', RETURNED: 'Devolvido', LOST: 'Perda registrada' }[value] ?? value)
function Workspace({ church }: { church: string }) {
  const [kind, setKind] = useState<ReportKind>('PEOPLE'), [search, setSearch] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [page, setPage] = useState(0)
  const [applied, setApplied] = useState({ kind: 'PEOPLE' as ReportKind, q: '', from: '', to: '' })
  const load = useCallback((signal: AbortSignal) => readReport(church, applied.kind, applied.q, applied.from, applied.to, page, signal), [church, applied, page])
  const query = useRead(JSON.stringify([church, applied, page]), load)
  return <><form className="report-filters" onSubmit={e => { e.preventDefault(); setPage(0); setApplied({ kind, q: search.trim(), from, to }) }}>
    <label>Relatório<select value={kind} onChange={e => setKind(e.target.value as ReportKind)}>{Object.entries(reportNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Pesquisar pessoa, ministério ou crachá<input maxLength={120} value={search} onChange={e => setSearch(e.target.value)}/></label>
    {kind === 'SERVICE_ATTENDANCE' && <><label>De<input required type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Até<input required type="date" min={from} value={to} onChange={e => setTo(e.target.value)}/></label></>}
    <button>Consultar relatório</button>
  </form><ReadResult query={query} label="relatório">{data => {
    const when = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: data.timeZone }) : '—'
    return <section className="report-results"><header className="report-result-heading"><div><span className="report-eyebrow">Resultado da consulta</span><h2>{reportNames[data.kind]}</h2><p>Página {page + 1} · horários em {data.timeZone}</p></div><div className="report-total"><strong>{data.total}</strong><span>registros encontrados</span></div></header>
      {data.kind === 'SERVICE_ATTENDANCE' && <p>Período de {data.from} a {data.to}. Previsão, presença manual e atuação com crachá aparecem separadas; a mesma pessoa pode ter mais de uma linha.</p>}
      {data.kind === 'PENDING_BADGES' && <p>Inclui crachás ainda não recolhidos de dias anteriores.</p>}
      {data.items.length ? <div className="report-table-scroll" role="region" aria-label="Dados do relatório" tabIndex={0}><table><caption>{reportNames[data.kind]}</caption><thead><tr><th>Pessoa</th><th>{['PEOPLE', 'MEMBERS'].includes(data.kind) ? 'Membresia' : 'Situação'}</th>
        {!['PEOPLE', 'MEMBERS'].includes(data.kind) && <><th>Ministério / departamento</th>{data.kind === 'SERVICE_ATTENDANCE' && <><th>Origem</th><th>Previsto</th></>}<th>{data.kind === 'MINISTRY_MEMBERS' ? 'Incluído em' : 'Registro / entrega'}</th>{data.kind === 'SERVICE_ATTENDANCE' && <th>Encerramento</th>}{data.kind !== 'MINISTRY_MEMBERS' && <th>Crachá</th>}</>}
      </tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td>{row.person}</td><td><span className="report-status">{statusName(row.status)}</span></td>
        {!['PEOPLE', 'MEMBERS'].includes(data.kind) && <><td>{[row.ministry, row.department].filter(Boolean).join(' / ') || '—'}</td>{data.kind === 'SERVICE_ATTENDANCE' && <><td>{row.source === 'ROSTER_MANUAL' ? 'Escala' : 'Atuação com crachá'}</td><td>{when(row.planned_at)}</td></>}<td>{when(row.recorded_at)}</td>{data.kind === 'SERVICE_ATTENDANCE' && <td>{when(row.closed_at)}</td>}{data.kind !== 'MINISTRY_MEMBERS' && <td>{row.badge ?? '—'}</td>}</>}
      </tr>)}</tbody></table></div> : <p>Nenhum registro com estes filtros.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas do relatório"/>
    </section>
  }}</ReadResult></>
}
export default function ReportPages({ directory = false }: { directory?: boolean }) {
  const { churchId = '' } = useParams(), { account } = useAuth(), [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <section className="reports-page" key={`${scope.epoch}:${churchId}`}><header className="report-page-heading"><div><span className="report-eyebrow">Gestão da igreja</span><h1 data-page-title="Relatórios">Relatórios operacionais</h1><p>Consulte pessoas, ministérios, escalas e crachás da igreja.</p></div><Link to="/conta">Minha conta <UiIcon kind="arrow"/></Link></header>{directory && <p><Link to="/relatorios">Voltar às igrejas</Link></p>}
    {!directory ? <Access/> : !isUuid(churchId) ? <p role="alert">Igreja inválida.</p> : <ResourceAccess permissionCode={reportPermission} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><Workspace church={churchId}/></ResourceAccess>}
  </section>
}
