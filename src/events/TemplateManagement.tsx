import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api'
import { changeTemplate, type EventTemplate, type TemplateCommand } from './template-api'

const success = { createDraft: 'Rascunho criado.', editDraft: 'Rascunho salvo.', publish: 'Versão publicada. Ocorrências anteriores foram preservadas.', discontinue: 'Template descontinuado. Histórico e ocorrências existentes foram preservados.' }

// Permanece acima da guarda: reconsulta de foco não perde a trava da escrita.
export function useTemplateMutation(denominationId: string) {
  const [editor, setEditor] = useState<{ snapshot: EventTemplate; name: string } | null>(null)
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
      setEditor(null)
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
  function changeName(template: EventTemplate, name: string) {
    setEditor(value => value ? { ...value, name } : { snapshot: template, name })
  }
  function discardChanges() { if (!request.current) setEditor(null) }
  return { busy, blocked, message, failed, revision, run, refresh, editor, changeName, discardChanges }
}
export type TemplateMutation = ReturnType<typeof useTemplateMutation>

export function TemplateActions({ template, mutation, section = 'editing' }: { template: EventTemplate; mutation: TemplateMutation; section?: 'editing' | 'availability' }) {
  const id = useId()
  const name = mutation.editor?.name ?? template.draft?.name ?? ''
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'publish' | 'discontinue' | null>(null)
  const confirmationTrigger = useRef<HTMLButtonElement>(null)
  function cancelConfirmation() { setConfirm(null); confirmationTrigger.current?.focus() }
  if (template.status === 'DISCONTINUED' && section === 'editing') return null
  const snapshot = mutation.editor?.snapshot
  const stale = Boolean(snapshot && (snapshot.revision !== template.revision || snapshot.publishedVersionId !== template.publishedVersionId
    || snapshot.status !== template.status || snapshot.draft?.id !== template.draft?.id || snapshot.draft?.revision !== template.draft?.revision))
  const disabled = mutation.busy || mutation.blocked || stale
  const dirty = template.draft && name.trim() !== template.draft.name
  if (section === 'availability') return <section className="events-panel template-availability" aria-labelledby={`${id}-title`} aria-busy={mutation.busy}>
    <h2 id={`${id}-title`}>Disponibilidade para novas ocorrências</h2>
    {template.status === 'DISCONTINUED' ? <p>Este template não está disponível para novas ocorrências. Seu histórico foi preservado.</p> : template.status === 'PUBLISHED' ? <>
      <p>Descontinuar impede novas ocorrências deste template. Histórico e ocorrências existentes serão preservados. Esta ação não pode ser revertida.</p>
      <div className="event-actions"><button ref={confirmationTrigger} data-tone="attention" disabled={disabled} onClick={() => setConfirm('discontinue')}>Descontinuar template</button></div>
      {confirm === 'discontinue' && <div role="group" aria-label="Confirmar descontinuação">
        <p>Confirmar descontinuação deste template? Histórico e ocorrências existentes serão preservados. Esta ação não pode ser revertida.</p>
        <div className="event-actions"><button data-tone="attention" disabled={disabled} onClick={async () => { if (await mutation.run(template, 'discontinue')) setConfirm(null) }}>Confirmar descontinuação</button>
          <button data-tone="secondary" disabled={mutation.busy} onClick={cancelConfirmation}>Cancelar alteração</button></div>
      </div>}
    </> : <p>O template ainda não foi publicado. A publicação da versão é uma operação separada da publicação de ocorrências.</p>}
  </section>
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    if (!name.trim() || name.trim().length > 180) { setError('Informe um nome de até 180 caracteres.'); return }
    setError(''); setConfirm(null)
    await mutation.run(snapshot ?? template, 'editDraft', name)
  }
  return <section className="events-panel" aria-labelledby={`${id}-title`} aria-busy={mutation.busy}>
    <h2 id={`${id}-title`}>Gerenciar template</h2>
    {stale && <p role="alert">O template mudou durante a edição. Descarte as alterações locais e atualize antes de salvar ou publicar.</p>}
    {mutation.busy && <p role="status">Salvando alteração…</p>}
    {template.draft ? <>
      <form onSubmit={submit}>
        <label htmlFor={`${id}-name`}>Nome do rascunho</label>
        <input id={`${id}-name`} value={name} maxLength={180} required disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { mutation.changeName(template, event.target.value); setConfirm(null) }}/>
        {error && <p role="alert" id={`${id}-error`}>{error}</p>}
        <button disabled={disabled}>Salvar rascunho</button>
      </form>
      {dirty && <p>Salve as alterações do nome antes de publicar.</p>}
      <button ref={confirmationTrigger} disabled={disabled || Boolean(dirty)} onClick={() => setConfirm('publish')}>Publicar versão</button>
    </> : template.status === 'PUBLISHED' && <button disabled={disabled} onClick={() => { void mutation.run(template, 'createDraft') }}>Criar novo rascunho</button>}
    {confirm === 'publish' && <div role="group" aria-label="Confirmar publicação">
      <p>Publicar a versão {template.draft?.number}: {template.draft?.name}? A versão publicada será imutável; ocorrências anteriores não serão alteradas.</p>
      <div className="event-actions"><button disabled={disabled || Boolean(dirty)} onClick={async () => { if (await mutation.run(template, 'publish')) setConfirm(null) }}>Confirmar publicação</button>
        <button data-tone="secondary" disabled={mutation.busy} onClick={cancelConfirmation}>Cancelar alteração</button></div>
    </div>}
  </section>
}
