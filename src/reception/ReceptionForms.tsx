import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import qrcode from 'qrcode-generator'
import { ApiError } from '../api'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { closeDelivery, createBadge, issueBadge, receptionBadges, receptionPeople, receptionUnits, scanBadge, type Badge, type Delivery, type Person, type Scan, type Unit } from './reception-api'

export interface Operations { church: string; onBusy: (busy: boolean) => void; onDone: (message: string, badge?: Badge) => void }
function useCommand(onBusy: Operations['onBusy']) {
  const pending = useRef<AbortController | null>(null), [blocked, setBlocked] = useState(false), [error, setError] = useState('')
  useEffect(() => () => pending.current?.abort(), [])
  async function run<T>(command: (signal: AbortSignal) => Promise<T>, done: (result: T) => void) {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBlocked(true); setError(''); onBusy(true)
    try { const result = await command(controller.signal); if (!controller.signal.aborted) done(result) }
    catch (cause) { if (!controller.signal.aborted) setError(`${cause instanceof ApiError ? cause.message : 'Não foi possível confirmar o resultado.'} Atualize a recepção e confira os dados antes de outra tentativa; a operação pode ter sido registrada.`) }
    finally { pending.current = null; if (!controller.signal.aborted) onBusy(false) }
  }
  return { blocked, error, run }
}
export function BadgeQr({ badge }: { badge: Badge }) {
  const url = useMemo(() => { const code = qrcode(0, 'M'); code.addData(badge.qrCode, 'Byte'); code.make(); return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.createSvgTag({ cellSize: 5, margin: 20, scalable: true }))}` }, [badge.qrCode])
  const filename = `cracha-${badge.label.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60)}.svg`
  return <figure className="reception-qr"><img src={url} width="220" height="220" alt={`QR Code do crachá ${badge.label}`}/><figcaption>Crachá {badge.label}</figcaption>
    <p><a href={url} download={filename}>Baixar QR para impressão</a></p><details><summary>Ver código do crachá</summary><code>{badge.qrCode}</code></details>
  </figure>
}
function People({ church, selected, onPick }: { church: string; selected: Person | null; onPick: (person: Person) => void }) {
  const [field, setField] = useState(''), [q, setQ] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => receptionPeople(church, q, page, signal), [church, q, page]), query = useRead(`${church}:${q}:${page}`, load)
  function find(e: FormEvent) { e.preventDefault(); setQ(field.trim()); setPage(0); query.refresh() }
  return <section><h3>1. Escolher a pessoa</h3><form onSubmit={find}><label>Nome<input maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar pessoa</button></form>
    {selected && <p className="reception-selected">Pessoa escolhida: <strong>{selected.displayName}</strong></p>}
    <ReadResult query={query} label="pessoas da igreja">{data => <>{data.items.length ? <ul>{data.items.map(person => <li key={person.id}><button onClick={() => onPick(person)}>{person.displayName}</button></li>)}</ul> : <p>Nenhuma pessoa encontrada.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das pessoas da recepção"/>
    </>}</ReadResult>
  </section>
}
function Units({ church, selected, onPick }: { church: string; selected: Unit | null; onPick: (unit: Unit) => void }) {
  const [page, setPage] = useState(0), load = useCallback((signal: AbortSignal) => receptionUnits(church, page, signal), [church, page]), query = useRead(`${church}:${page}`, load)
  return <section><h3>2. Escolher onde vai atuar</h3>{selected && <p className="reception-selected"><strong>{selected.ministryName}{selected.departmentName ? ` · ${selected.departmentName}` : ''}</strong></p>}
    <ReadResult query={query} label="ministérios e departamentos">{data => <>{data.items.length ? <ul>{data.items.map(unit => <li key={`${unit.ministryId}:${unit.departmentId}`}><button onClick={() => onPick(unit)}>{unit.ministryName}{unit.departmentName ? ` · ${unit.departmentName}` : ' · só ministério'}</button></li>)}</ul> : <p>Nenhum ministério ativo disponível.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos ministérios da recepção"/>
    </>}</ReadResult>
  </section>
}
function Scanner({ church, onScan, onBusy, onInvalidate }: { church: string; onScan: (scan: Scan) => void; onBusy: Operations['onBusy']; onInvalidate: () => void }) {
  const [code, setCode] = useState(''), [error, setError] = useState(''), pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function scan(e: FormEvent) {
    e.preventDefault(); if (pending.current) return
    const controller = new AbortController(); pending.current = controller; onInvalidate(); onBusy(true); setError('')
    try { const result = await scanBadge(church, code.trim().toLowerCase(), controller.signal); if (!controller.signal.aborted) onScan(result) }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'Não foi possível ler o crachá.') }
    finally { pending.current = null; if (!controller.signal.aborted) onBusy(false) }
  }
  return <form onSubmit={e => void scan(e)} aria-label="Ler crachá"><label>QR Code do crachá<input autoComplete="off" spellCheck={false} maxLength={36} value={code} onChange={e => { onInvalidate(); setCode(e.target.value) }} placeholder="Leia no leitor USB ou cole o código"/></label><button>Ler crachá</button>{error && <p role="alert">{error}</p>}</form>
}
export function DeliverForm({ church, onBusy, onDone }: Operations) {
  const [person, setPerson] = useState<Person | null>(null), [unit, setUnit] = useState<Unit | null>(null), [scan, setScan] = useState<Scan | null>(null), [review, setReview] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID()), command = useCommand(onBusy)
  return <section aria-label="Entregar crachá"><h2>Entregar crachá</h2>
    <div className="reception-choices"><People church={church} selected={person} onPick={value => { if (!command.blocked) { setPerson(value); setReview(false) } }}/><Units church={church} selected={unit} onPick={value => { if (!command.blocked) { setUnit(value); setReview(false) } }}/></div>
    <h3>3. Ler o crachá físico</h3><Scanner church={church} onBusy={onBusy} onInvalidate={() => { setScan(null); setReview(false) }} onScan={value => { if (!command.blocked) { setScan(value); setReview(false) } }}/>
    {scan && <p>Crachá <strong>{scan.badge.label}</strong>: {scan.badge.state === 'AVAILABLE' ? 'disponível para entrega.' : scan.badge.state === 'LOST' ? 'registrado como perdido; não pode ser entregue.' : 'já está entregue; precisa ser devolvido antes de nova entrega.'}</p>}
    <button disabled={!person || !unit || scan?.badge.state !== 'AVAILABLE' || command.blocked} onClick={() => setReview(true)}>Revisar entrega</button>
    {review && person && unit && scan?.badge.state === 'AVAILABLE' && <section className="reception-confirm" aria-label="Confirmar entrega"><h3>Confirmar entrega do crachá {scan.badge.label}</h3>
      <p><strong>{person.displayName}</strong> atuará em {unit.ministryName}{unit.departmentName ? ` · ${unit.departmentName}` : ''}.</p>
      <button disabled={command.blocked} onClick={() => void command.run(signal => issueBadge(church, { requestId, qrCode: scan.badge.id, personId: person.id, ministryId: unit.ministryId, departmentId: unit.departmentId }, signal), result => onDone(result.outcome ? 'Esta tentativa já foi registrada e encerrada. Nenhuma nova entrega foi criada.' : `Entrega do crachá ${result.badgeLabel} confirmada para ${result.personName}.`))}>Confirmar entrega</button>{' '}
      <button disabled={command.blocked} onClick={() => setReview(false)}>Voltar</button>
    </section>}{command.error && <p role="alert">{command.error}</p>}
  </section>
}
export function CloseForm({ church, onBusy, onDone, lost }: Operations & { lost: Delivery | null }) {
  const [scan, setScan] = useState<Scan | null>(null), [choice, setChoice] = useState<{ delivery: Delivery; outcome: 'RETURNED' | 'LOST' } | null>(() => lost ? { delivery: lost, outcome: 'LOST' } : null), command = useCommand(onBusy)
  return <section aria-label="Devolver ou registrar perda"><h2>Devolver crachá</h2><Scanner church={church} onBusy={onBusy} onInvalidate={() => { setScan(null); setChoice(null) }} onScan={value => { if (!command.blocked) { setScan(value); setChoice(null) } }}/>
    {scan && (scan.openDelivery ? <><p>Crachá <strong>{scan.badge.label}</strong> entregue para <strong>{scan.openDelivery.personName}</strong> · {scan.openDelivery.ministryName}{scan.openDelivery.departmentName ? ` · ${scan.openDelivery.departmentName}` : ''}.</p>
      <button disabled={command.blocked} onClick={() => setChoice({ delivery: scan.openDelivery!, outcome: 'RETURNED' })}>Revisar devolução</button>{' '}
      <button disabled={command.blocked} onClick={() => setChoice({ delivery: scan.openDelivery!, outcome: 'LOST' })}>Revisar perda</button></> : <p>{scan.badge.state === 'LOST' ? 'Este crachá já foi registrado como perdido.' : 'Este crachá não tem entrega aberta para devolver.'}</p>)}
    {choice && <section className="reception-confirm" aria-label="Confirmar encerramento da entrega"><h3>{choice.outcome === 'LOST' ? 'Registrar perda' : 'Confirmar devolução'} do crachá {choice.delivery.badgeLabel}</h3>
      <p>Pessoa: <strong>{choice.delivery.personName}</strong> · {choice.delivery.ministryName}{choice.delivery.departmentName ? ` · ${choice.delivery.departmentName}` : ''}.</p>
      <p>{choice.outcome === 'LOST' ? 'A perda encerra esta pendência e bloqueia o uso desse QR Code. O histórico será preservado.' : 'Confirme que o crachá físico foi recolhido. Ele ficará disponível para nova entrega.'}</p>
      <button disabled={command.blocked} onClick={() => void command.run(signal => closeDelivery(church, choice.delivery, choice.outcome, signal), result => onDone(result.outcome === 'LOST' ? `Perda do crachá ${result.badgeLabel} registrada. Pendência encerrada.` : `Devolução do crachá ${result.badgeLabel} confirmada.`))}>{choice.outcome === 'LOST' ? 'Confirmar registro de perda' : 'Confirmar crachá recolhido'}</button>{' '}
      <button disabled={command.blocked} onClick={() => setChoice(null)}>Voltar</button>
    </section>}{command.error && <p role="alert">{command.error}</p>}
  </section>
}
export function BadgesForm({ church, onBusy, onDone }: Operations) {
  const [label, setLabel] = useState(''), [q, setQ] = useState(''), [field, setField] = useState(''), [page, setPage] = useState(0), [shown, setShown] = useState<string | null>(null), command = useCommand(onBusy)
  const load = useCallback((signal: AbortSignal) => receptionBadges(church, q, page, signal), [church, q, page]), query = useRead(`${church}:${q}:${page}`, load)
  return <section><h2>Crachás e QR Codes</h2><form onSubmit={e => { e.preventDefault(); void command.run(signal => createBadge(church, label, signal), result => onDone(`Crachá ${result.label} cadastrado. Baixe o QR para preparar o crachá físico.`, result)) }}>
    <label>Identificação física do crachá<input required maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder="Exemplo: 001"/></label><button disabled={command.blocked}>Cadastrar crachá</button>
  </form>{command.error && <p role="alert">{command.error}</p>}
    <form onSubmit={e => { e.preventDefault(); setQ(field.trim()); setPage(0); query.refresh() }}><label>Buscar crachá<input maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar crachá</button></form>
    <ReadResult query={query} label="crachás">{data => <>{data.items.length ? <ul>{data.items.map(b => <li key={b.id}><p><strong>{b.label}</strong> · {{ AVAILABLE: 'Disponível', DISTRIBUTED: 'Entregue', LOST: 'Perdido' }[b.state]}</p><button onClick={() => setShown(shown === b.id ? null : b.id)}>{shown === b.id ? 'Ocultar QR' : `Ver QR do crachá ${b.label}`}</button>{shown === b.id && <BadgeQr badge={b}/>}</li>)}</ul> : <p>Nenhum crachá encontrado.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos crachás"/>
    </>}</ReadResult>
  </section>
}
