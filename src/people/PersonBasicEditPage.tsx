import UnsavedChangesGuard from '../components/UnsavedChangesGuard'
import { formatDateTime } from '../time'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PeoplePageHeader from './PeoplePageHeader'
import { ApiError } from '../api'
import { ResourceAccess } from '../authorization'
import { useAuth } from '../auth'
import { useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { personEditPermission, readBasicPerson, readEditHistory, saveBasicPerson, type BasicDraft, type BasicPerson } from './person-edit-api'
function Form({ person, church, saved, onBusy }: { person: BasicPerson; church: string; saved: () => void; onBusy: (busy: boolean) => void }) {
  const [draft, setDraft] = useState<BasicDraft>({ fullName: person.fullName, preferredName: person.preferredName ?? '', birthDate: person.birthDate ?? '', email: person.email ?? '', phone: person.phone ?? '' })
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function submit() {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); onBusy(true); setBlocked(true); setMessage('')
    try { await saveBasicPerson(church, person.id, person.updatedAt, draft, controller.signal); if (!controller.signal.aborted) saved() }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof ApiError && error.status === 409 ? 'O cadastro mudou. Consulte novamente antes de editar.' : 'Não foi possível confirmar a gravação. Consulte novamente antes de outra tentativa.') }
    finally { pending.current = null; if (!controller.signal.aborted) { setBusy(false); onBusy(false) } }
  }
  return <form className="people-edit-form" onSubmit={e => { e.preventDefault(); void submit() }} aria-busy={busy}>
    <UnsavedChangesGuard dirty={Object.entries(draft).some(([key, value]) => value !== (person[key as keyof BasicPerson] ?? ''))}/><fieldset disabled={busy || blocked}><legend>Dados básicos</legend>
      <label>Nome completo<input required maxLength={200} value={draft.fullName} onChange={e => setDraft({ ...draft, fullName: e.target.value })}/></label>
      <label>Nome de preferência<input maxLength={150} value={draft.preferredName} onChange={e => setDraft({ ...draft, preferredName: e.target.value })}/></label>
      <label>Nascimento<input type="date" value={draft.birthDate} onChange={e => setDraft({ ...draft, birthDate: e.target.value })}/></label>
      <label>E-mail<input type="email" maxLength={254} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label>
      <label>Telefone<input type="tel" maxLength={30} value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/></label>
      <p role="note">Ao salvar, as alterações também serão aplicadas nas demais igrejas.</p><button>Salvar alterações</button>
    </fieldset>{message && <p role="alert">{message}</p>}
    <button type="button" disabled={busy} onClick={saved}>Consultar novamente e descartar edição</button>
  </form>
}
function Workspace({ church, person }: { church: string; person: string }) {
  const [epoch, setEpoch] = useState(0), [busy, setBusy] = useState(false)
  const load = useCallback(async (signal: AbortSignal) => { const [data, history] = await Promise.all([readBasicPerson(church, person, signal), readEditHistory(church, person, signal)]); return { data, history } }, [church, person])
  const query = useRead(JSON.stringify([church, person, epoch]), load)
  return <><p role="note">Este cadastro é compartilhado. Alterações de nome, nascimento e contatos valerão também nas demais igrejas.</p>
    {query.state.kind === 'error' && <button disabled={busy} onClick={() => setEpoch(v => v + 1)}>Tentar novamente</button>}
    {query.state.kind === 'loading' ? <p role="status">Carregando cadastro…</p> : query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : <>
      <Form key={`${query.state.data.data.updatedAt}:${epoch}`} person={query.state.data.data} church={church} onBusy={setBusy} saved={() => { setBusy(false); setEpoch(v => v + 1) }}/>
      <h2>Alterações nesta igreja</h2><p>Últimas 20 alterações. O histórico preserva o autor, a data e os campos alterados.</p>
      {query.state.data.history.length ? <ul>{query.state.data.history.map(v => <li key={v.id}><time dateTime={v.occurredAt}>{formatDateTime(v.occurredAt)}</time> · {v.changedFields.map(field => ({ fullName: 'nome', preferredName: 'nome de preferência', birthDate: 'nascimento', email: 'e-mail', phone: 'telefone' }[field] ?? field)).join(', ')} · {v.actorName}</li>)}</ul> : <p>Nenhuma alteração registrada nesta igreja.</p>}
    </>}</>
}
export default function PersonBasicEditPage() {
  const { churchId = '', personId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <div className="people-page people-edit-page"><PeoplePageHeader title="Editar pessoa" description="Consulte e atualize a identificação e os contatos do cadastro."/><Link className="people-back-link" to={`/pessoas/igrejas/${churchId}`}>← Voltar a Pessoas</Link>
    {!isUuid(churchId) || !isUuid(personId) ? <p role="alert">Cadastro inválido.</p> : <ResourceAccess permissionCode={personEditPermission} resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><Workspace key={`${scope.epoch}:${churchId}:${personId}`} church={churchId} person={personId}/></ResourceAccess>}
  </div>
}
