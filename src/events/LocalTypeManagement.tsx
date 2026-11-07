import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../api'
import { ResourceAccess } from '../authorization'
import { createLocalType, setLocalTypeEnabled, type EventTypeView } from './catalog-api'

export interface LocalTypeMutation {
  busy: boolean
  result: EventTypeView | null
  lastDisabled: EventTypeView | null
  message: string
  failed: boolean
  revision: number
  create: (name: string) => Promise<boolean>
  setEnabled: (item: EventTypeView, enabled: boolean) => Promise<boolean>
}

// Mantido acima das guardas de leitura/ação: reconsulta por foco não perde o
// resultado de uma escrita que já está em andamento nem permite outro envio.
export function useLocalTypeMutation(churchId: string): LocalTypeMutation {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EventTypeView | null>(null)
  const [lastDisabled, setLastDisabled] = useState<EventTypeView | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const request = useRef<AbortController | null>(null)
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; request.current?.abort() }
  }, [])

  async function run(operation: (signal: AbortSignal) => Promise<EventTypeView>, success: string) {
    if (request.current) return false
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setMessage(''); setResult(null); setFailed(false)
    try {
      const value = await operation(controller.signal)
      if (!active.current || request.current !== controller) return false
      setResult(value); setMessage(success); setRevision(value => value + 1)
      setLastDisabled(previous => !value.enabled ? value : previous?.id === value.id ? null : previous)
      return true
    } catch (error) {
      if (active.current && request.current === controller) {
        setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500 ? error.message : 'O resultado da alteração não pôde ser confirmado. Consulte o catálogo antes de enviar novamente.')
      }
      return false
    } finally {
      if (request.current === controller) {
        request.current = null
        if (active.current) setBusy(false)
      }
    }
  }
  return { busy, result, lastDisabled, message, failed, revision,
    create: name => run(signal => createLocalType(churchId, name, signal), 'Tipo local criado.'),
    setEnabled: (item, enabled) => run(signal => setLocalTypeEnabled(churchId, item, enabled, signal), enabled ? 'Tipo local habilitado.' : 'Tipo local desabilitado. Ocorrências e inscrições existentes foram preservadas.'),
  }
}

export function CreateLocalTypeForm({ mutation }: { mutation: LocalTypeMutation }) {
  const id = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 180) { setError('Informe um nome de até 180 caracteres.'); return }
    setError('')
    if (await mutation.create(name)) setName('')
  }
  return <section className="events-panel" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`}>Criar tipo local</h2>
    <form onSubmit={submit} aria-busy={mutation.busy}>
      <label htmlFor={`${id}-name`}>Nome do tipo de evento</label>
      <input id={`${id}-name`} value={name} maxLength={180} required disabled={mutation.busy} onChange={event => setName(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}/>
      {error && <p role="alert" id={`${id}-error`}>{error}</p>}
      <button disabled={mutation.busy}>{mutation.busy ? 'Salvando…' : 'Criar tipo local'}</button>
    </form>
  </section>
}

export function CatalogCards({ items, mutation }: { items: readonly EventTypeView[]; mutation?: LocalTypeMutation }) {
  return <ul className="event-list">{items.map(item => <li key={item.id}>
    <h2>{item.name}</h2><p>{item.scopeType === 'DENOMINATION' ? 'Origem denominacional' : 'Origem local'}</p>
    <p>{item.mandatory ? 'Obrigatório no catálogo' : 'Não obrigatório'}</p><p>{item.enabled ? 'Habilitado' : 'Desabilitado'}</p>
    {mutation && item.scopeType === 'CHURCH' && !item.mandatory && <LocalTypeToggle item={item} mutation={mutation}/>}
  </li>)}</ul>
}

export function LocalTypeToggle({ item, mutation }: { item: EventTypeView; mutation: LocalTypeMutation }) {
  const [confirming, setConfirming] = useState(false)
  return confirming ? <div role="group" aria-label={`Confirmar alteração de ${item.name}`}>
    <p>{item.enabled ? 'Desabilitar retira este tipo do catálogo de seleção, sem apagar ocorrências ou inscrições existentes.' : 'Habilitar torna este tipo local disponível novamente no catálogo.'}</p>
    <button disabled={mutation.busy} onClick={async () => { if (await mutation.setEnabled(item, !item.enabled)) setConfirming(false) }}>Confirmar {item.enabled ? 'desabilitação' : 'habilitação'}</button>{' '}
    <button disabled={mutation.busy} onClick={() => setConfirming(false)}>Cancelar alteração</button>
  </div> : <button disabled={mutation.busy} onClick={() => setConfirming(true)} aria-label={`${item.enabled ? 'Desabilitar' : 'Habilitar'} ${item.name}`}>{item.enabled ? 'Desabilitar tipo local' : 'Habilitar tipo local'}</button>
}

export function LocalMutationResult({ churchId, mutation }: { churchId: string; mutation: LocalTypeMutation }) {
  const { result, lastDisabled, message, failed } = mutation
  return <>{message && <p role={failed ? 'alert' : 'status'}>{message}{result ? ` ${result.name}` : ''}</p>}
    {lastDisabled && <section className="events-panel" aria-label="Último tipo desabilitado"><h2>Último tipo desabilitado</h2><p>{lastDisabled.name}</p>
      <p>Você pode reverter esta alteração enquanto permanecer nesta tela.</p>
      <ActionAccess churchId={churchId} permissionCode="EVENT_EDIT"><LocalTypeToggle key={lastDisabled.id} item={lastDisabled} mutation={mutation}/></ActionAccess>
    </section>}
  </>
}

export function ActionAccess({ churchId, permissionCode, children, fallback }: { churchId: string; permissionCode: 'EVENT_CREATE' | 'EVENT_EDIT'; children: ReactNode; fallback?: ReactNode }) {
  return <ResourceAccess permissionCode={permissionCode} resourceType="CHURCH" resourceId={churchId} optional fallback={fallback}>{children}</ResourceAccess>
}
