import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api'
import { changeTemplate, type EventTemplate, type TemplateCommand } from './template-api'

const success = { createDraft: 'Rascunho criado.', editDraft: 'Rascunho salvo.', publish: 'Versão publicada. Ocorrências anteriores foram preservadas.', discontinue: 'Template descontinuado. Histórico e ocorrências existentes foram preservados.' }

// Permanece acima da guarda: reconsulta de foco não perde a trava da escrita.
export function useTemplateMutation(denominationId: string) {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const active = useRef(false)
  const request = useRef<AbortController | null>(null)
  const refreshRequired = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; request.current?.abort() }
  }, [])
  async function run(template: EventTemplate, command: TemplateCommand, name?: string) {
    if (request.current || refreshRequired.current) return false
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setMessage(''); setFailed(false)
    try {
      await changeTemplate(denominationId, template, command, name, controller.signal)
      if (!active.current) return false
      setMessage(success[command]); setRevision(value => value + 1)
      return true
    } catch (error) {
      if (active.current) {
        refreshRequired.current = true
        setBlocked(true); setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500
          ? `${error.message} Atualize o template antes de tentar novamente.`
          : 'O resultado da alteração não pôde ser confirmado. Atualize o template antes de tentar novamente.')
      }
      return false
    } finally {
      request.current = null
      if (active.current) setBusy(false)
    }
  }
  function refresh() {
    if (request.current) return
    refreshRequired.current = false
    setBlocked(false)
    if (failed) { setMessage(''); setFailed(false) }
  }
  return { busy, blocked, message, failed, revision, run, refresh }
}
export type TemplateMutation = ReturnType<typeof useTemplateMutation>

export function TemplateActions({ template, mutation }: { template: EventTemplate; mutation: TemplateMutation }) {
  const id = useId()
  const [name, setName] = useState(template.draft?.name ?? '')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'publish' | 'discontinue' | null>(null)
  if (template.status === 'DISCONTINUED') return null
  const disabled = mutation.busy || mutation.blocked
  const dirty = template.draft && name.trim() !== template.draft.name
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 180) { setError('Informe um nome de até 180 caracteres.'); return }
    setError(''); setConfirm(null)
    await mutation.run(template, 'editDraft', name)
  }
  return <section className="events-panel" aria-labelledby={`${id}-title`} aria-busy={mutation.busy}>
    <h2 id={`${id}-title`}>Gerenciar template</h2>
    {mutation.busy && <p role="status">Salvando alteração…</p>}
    {template.draft ? <>
      <form onSubmit={submit}>
        <label htmlFor={`${id}-name`}>Nome do rascunho</label>
        <input id={`${id}-name`} value={name} maxLength={180} required disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setName(event.target.value); setConfirm(null) }}/>
        {error && <p role="alert" id={`${id}-error`}>{error}</p>}
        <button disabled={disabled}>Salvar rascunho</button>
      </form>
      {dirty && <p>Salve as alterações do nome antes de publicar.</p>}
      <button disabled={disabled || Boolean(dirty)} onClick={() => setConfirm('publish')}>Publicar versão</button>
    </> : template.status === 'PUBLISHED' && <button disabled={disabled} onClick={() => { void mutation.run(template, 'createDraft') }}>Criar novo rascunho</button>}
    {template.status === 'PUBLISHED' && <button disabled={disabled} onClick={() => setConfirm('discontinue')}>Descontinuar template</button>}
    {confirm && <div role="group" aria-label={confirm === 'publish' ? 'Confirmar publicação' : 'Confirmar descontinuação'}>
      <p>{confirm === 'publish' ? `Publicar a versão ${template.draft?.number}: ${template.draft?.name}? A versão publicada será imutável; ocorrências anteriores não serão alteradas.`
        : 'Descontinuar impede novas ocorrências deste template. Histórico e ocorrências existentes serão preservados. Esta ação não pode ser revertida.'}</p>
      <button disabled={disabled || (confirm === 'publish' && Boolean(dirty))} onClick={async () => { if (await mutation.run(template, confirm)) setConfirm(null) }}>Confirmar {confirm === 'publish' ? 'publicação' : 'descontinuação'}</button>{' '}
      <button disabled={mutation.busy} onClick={() => setConfirm(null)}>Cancelar alteração</button>
    </div>}
  </section>
}
