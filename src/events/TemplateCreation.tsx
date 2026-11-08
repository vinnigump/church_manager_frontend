import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api'
import { createDenominationalType, type EventTypeView } from './catalog-api'

export function useTemplateCreation(denominationId: string) {
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [result, setResult] = useState<EventTypeView | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const request = useRef<AbortController | null>(null)
  const refreshRequired = useRef(false)
  const failureGeneration = useRef(0)
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; request.current?.abort() }
  }, [])
  async function create(name: string) {
    if (request.current || refreshRequired.current) return false
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setMessage(''); setFailed(false); setResult(null)
    try {
      const created = await createDenominationalType(denominationId, name, controller.signal)
      if (!active.current) return false
      setResult(created); setMessage('Template criado com rascunho inicial. Ainda não está disponível para as igrejas.'); setRevision(value => value + 1)
      return true
    } catch (error) {
      if (active.current) {
        refreshRequired.current = true
        failureGeneration.current++
        setBlocked(true); setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500
          ? `${error.message} Atualize o catálogo antes de tentar novamente.`
          : 'O resultado da criação não pôde ser confirmado. Atualize o catálogo antes de tentar novamente.')
      }
      return false
    } finally {
      request.current = null
      if (active.current) setBusy(false)
    }
  }
  const acknowledgeRead = useCallback((generation: number) => {
    if (request.current || !refreshRequired.current || generation !== failureGeneration.current) return
    refreshRequired.current = false
    setBlocked(false)
    setMessage(''); setFailed(false)
  }, [])
  return { busy, blocked, result, message, failed, revision, create, acknowledgeRead, failureGeneration, draftName, setDraftName }
}
export type TemplateCreation = ReturnType<typeof useTemplateCreation>

export function TemplateCreationForm({ creation }: { creation: TemplateCreation }) {
  const id = useId()
  const { draftName: name, setDraftName: setName } = creation
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 180) { setError('Informe um nome de até 180 caracteres.'); return }
    setError('')
    if (await creation.create(name)) setName('')
  }
  return <section className="events-panel" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`}>Criar template denominacional</h2>
    <p>O template começa como rascunho. As igrejas vinculadas poderão usá-lo após sua publicação.</p>
    <form onSubmit={submit} aria-busy={creation.busy}>
      <label htmlFor={`${id}-name`}>Nome do novo template</label>
      <input id={`${id}-name`} value={name} required maxLength={180} disabled={creation.busy || creation.blocked} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => setName(event.target.value)}/>
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
      <button disabled={creation.busy || creation.blocked}>{creation.busy ? 'Criando template…' : 'Criar template'}</button>
    </form>
  </section>
}

export function TemplateCreationResult({ denominationId, creation }: { denominationId: string; creation: TemplateCreation }) {
  return <>{creation.message && <p role={creation.failed ? 'alert' : 'status'}>{creation.message}</p>}
    {creation.result && <p><Link to={`/eventos/denominacoes/${denominationId}/templates/${creation.result.id}`}>Abrir template criado: {creation.result.name}</Link></p>}
  </>
}
