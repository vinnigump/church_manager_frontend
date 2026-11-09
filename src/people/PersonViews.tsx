import { useId, useRef, useState } from 'react'
import './people.css'

// Presentation models only. These are not HTTP DTOs or authorization decisions.
export type PersonDraft = { fullName: string; cpf: string }
export type PersonSummary = { fullName: string; preferredName?: string | null }
export type PersonCreationResult =
  | { kind: 'confirmed'; person: PersonSummary }
  | { kind: 'error' }
  | { kind: 'conflict' }

export type PersonFormProps = {
  onSubmit: (draft: PersonDraft) => Promise<PersonCreationResult>
  // Supplied only after acceptance by the caller; no document catalog is inferred.
  acceptedAlternativeDocument?: { label: string }
}

export function PersonRecord({ person }: { person: PersonSummary }) {
  const titleId = useId()
  return <section aria-labelledby={titleId} className="access-panel person-panel">
    <h2 id={titleId}>Ficha da pessoa</h2>
    <dl><dt>Nome completo</dt><dd>{person.fullName}</dd>
      {person.preferredName && <><dt>Nome de preferência</dt><dd>{person.preferredName}</dd></>}
    </dl>
    <p>Convite de acesso e ingresso em membresia são ações separadas.</p>
  </section>
}

export type PersonViewState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; person: PersonSummary }

export function PersonView({ state }: { state: PersonViewState }) {
  if (state.kind === 'loading') return <p role="status" aria-busy="true">Carregando ficha…</p>
  if (state.kind === 'error') return <p role="alert">Não foi possível consultar a ficha.</p>
  if (state.kind === 'unavailable') return <p role="status">Ficha indisponível neste contexto.</p>
  return <PersonRecord person={state.person}/>
}

// Mount with a new key when context/access changes; unmount on loss of access.
// Caller owns authorization, persistence and reconciliation of uncertain results.
export function PersonForm({ onSubmit, acceptedAlternativeDocument }: PersonFormProps) {
  const id = useId()
  const [draft, setDraft] = useState<PersonDraft>({ fullName: '', cpf: '' })
  const [result, setResult] = useState<PersonCreationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const locked = useRef(false)
  const alternative = acceptedAlternativeDocument?.label.trim()
  async function submit() {
    if (locked.current) return
    if (!draft.fullName.trim() || (!draft.cpf.trim() && !alternative)) { setInvalid(true); return }
    locked.current = true
    setBusy(true)
    setInvalid(false)
    setResult(null)
    try { setResult(await onSubmit({ ...draft, fullName: draft.fullName.trim() })) }
    catch { setResult({ kind: 'error' }) }
    finally { setBusy(false) }
  }
  if (result?.kind === 'confirmed') return <><p role="status">Cadastro confirmado.</p><PersonRecord person={result.person}/></>
  const blocked = busy || result?.kind === 'error' || result?.kind === 'conflict'
  return <section className="access-panel person-panel" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Cadastrar pessoa</h2>
    <form noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit() }}>
      <label htmlFor={`${id}-name`}>Nome completo (obrigatório)</label>
      <input id={`${id}-name`} required maxLength={200} autoComplete="off" disabled={busy}
        aria-invalid={invalid && !draft.fullName.trim()} aria-describedby={invalid ? `${id}-validation` : undefined}
        value={draft.fullName} onChange={event => setDraft({ ...draft, fullName: event.target.value })}/>
      <label htmlFor={`${id}-cpf`}>CPF{alternative ? ' (opcional)' : ''}</label>
      <input id={`${id}-cpf`} maxLength={20} autoComplete="off" disabled={busy}
        aria-invalid={invalid && !draft.cpf.trim() && !alternative}
        aria-describedby={`${id}-document${invalid ? ` ${id}-validation` : ''}`}
        value={draft.cpf} onChange={event => setDraft({ ...draft, cpf: event.target.value })}/>
      <p id={`${id}-document`}>{alternative ? `Documento alternativo aceito: ${alternative}.` : 'Informe CPF ou forneça um documento alternativo aceito pelo serviço responsável.'} A validação do documento cabe ao serviço responsável.</p>
      {invalid && <p id={`${id}-validation`} role="alert">Informe nome completo e CPF, salvo documento alternativo aceito.</p>}
      {busy && <p role="status">Aguardando confirmação do cadastro…</p>}
      {result?.kind === 'conflict' && <p role="alert">Não foi possível confirmar o cadastro por conflito. Confira os dados com o serviço responsável antes de nova tentativa.</p>}
      {result?.kind === 'error' && <p role="alert">Não foi possível confirmar o cadastro. Confira o resultado com o serviço responsável antes de nova tentativa.</p>}
      <button type="submit" disabled={blocked}>Cadastrar pessoa</button>
      {blocked && !busy && <p role="status">Novo envio bloqueado até reconciliação pelo chamador.</p>}
    </form>
    <p>Cadastrar a pessoa não envia convite nem cria membresia.</p>
  </section>
}
