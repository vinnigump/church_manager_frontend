import { useId, useRef, useState } from 'react'
import './people.css'

// Presentation models only. These are not HTTP DTOs or authorization decisions.
export type PersonDraft = { fullName: string; cpf: string; email: string; phone: string; birthDate: string }
export type PersonSummary = { fullName: string; preferredName?: string | null }
export type PersonCreationResult =
  | { kind: 'confirmed'; person: PersonSummary }
  | { kind: 'error' }
  | { kind: 'conflict' }

export type PersonFormProps = {
  onSubmit: (draft: PersonDraft) => Promise<PersonCreationResult>
  // Supplied only after acceptance by the caller; no document catalog is inferred.
  acceptedAlternativeDocument?: { label: string }
  birthDateRequired?: boolean
  administrative?: boolean
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
export function PersonForm({ onSubmit, acceptedAlternativeDocument, birthDateRequired = false, administrative = false }: PersonFormProps) {
  const id = useId()
  const [draft, setDraft] = useState<PersonDraft>({ fullName: '', cpf: '', email: '', phone: '', birthDate: '' })
  const [result, setResult] = useState<PersonCreationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const locked = useRef(false)
  const [documentType, setDocumentType] = useState<'CPF' | 'CIN_CPF'>('CPF')
  const alternative = acceptedAlternativeDocument?.label.trim()
  async function submit() {
    if (locked.current) return
    if (!draft.fullName.trim() || (!draft.cpf.trim() && !alternative)
      || (!draft.email.trim() && !draft.phone.trim()) || (birthDateRequired && !draft.birthDate)) {
      setInvalid(true)
      return
    }
    locked.current = true
    setBusy(true)
    setInvalid(false)
    setResult(null)
    try { setResult(await onSubmit({ ...draft, fullName: draft.fullName.trim(), ...(administrative ? { documentType } : {}) })) }
    catch { setResult({ kind: 'error' }) }
    finally { setBusy(false) }
  }
  if (result?.kind === 'confirmed') return <><p role="status">Cadastro confirmado.</p>{administrative
    ? <section aria-label="Confirmação do cadastro"><h2>Cadastro realizado</h2><p>{result.person.fullName}</p><p>Esta confirmação não concede consulta à ficha. Convite e membresia são ações separadas.</p></section>
    : <PersonRecord person={result.person}/>}</>
  const blocked = busy || result?.kind === 'error' || result?.kind === 'conflict'
  return <section className="access-panel person-panel" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Cadastrar pessoa</h2>
    <form noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit() }}>
      <label htmlFor={`${id}-name`}>Nome completo (obrigatório)</label>
      <input id={`${id}-name`} required maxLength={200} autoComplete="off" disabled={busy}
        aria-invalid={invalid && !draft.fullName.trim()} aria-describedby={invalid ? `${id}-validation` : undefined}
        value={draft.fullName} onChange={event => setDraft({ ...draft, fullName: event.target.value })}/>
      {administrative && <label>Tipo de documento<select disabled={busy} value={documentType} onChange={e => setDocumentType(e.target.value as 'CPF' | 'CIN_CPF')}><option value="CPF">CPF</option><option value="CIN_CPF">CIN baseada em CPF</option></select></label>}
      <label htmlFor={`${id}-cpf`}>CPF{alternative ? ' (opcional)' : ''}</label>
      <input id={`${id}-cpf`} maxLength={20} autoComplete="off" disabled={busy}
        aria-invalid={invalid && !draft.cpf.trim() && !alternative}
        aria-describedby={`${id}-document${invalid ? ` ${id}-validation` : ''}`}
        value={draft.cpf} onChange={event => setDraft({ ...draft, cpf: event.target.value })}/>
      <p id={`${id}-document`}>{alternative ? `Documento alternativo aceito: ${alternative}.` : 'Informe CPF ou forneça um documento alternativo aceito pelo serviço responsável.'} A validação do documento cabe ao serviço responsável.</p>
      <p id={`${id}-contact`}>Informe pelo menos um contato, e-mail ou telefone.</p>
      <label htmlFor={`${id}-email`}>E-mail</label>
      <input id={`${id}-email`} type="email" autoComplete="off" disabled={busy}
        aria-invalid={invalid && !draft.email.trim() && !draft.phone.trim()}
        aria-describedby={`${id}-contact`}
        value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })}/>
      <label htmlFor={`${id}-phone`}>Telefone</label>
      <input id={`${id}-phone`} type="tel" autoComplete="off" disabled={busy}
        aria-invalid={invalid && !draft.email.trim() && !draft.phone.trim()}
        aria-describedby={`${id}-contact`}
        value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })}/>
      <label htmlFor={`${id}-birth`}>Nascimento{birthDateRequired ? ' (obrigatório)' : ' (opcional)'}</label>
      <input id={`${id}-birth`} type="date" required={birthDateRequired} autoComplete="off" disabled={busy}
        aria-invalid={invalid && birthDateRequired && !draft.birthDate}
        value={draft.birthDate} onChange={event => setDraft({ ...draft, birthDate: event.target.value })}/>
      {invalid && <p id={`${id}-validation`} role="alert">Informe nome completo, CPF ou documento alternativo aceito, pelo menos um contato e nascimento quando obrigatório.</p>}
      {busy && <p role="status">Aguardando confirmação do cadastro…</p>}
      {result?.kind === 'conflict' && <p role="alert">Não foi possível confirmar o cadastro por conflito. Confira os dados com o serviço responsável antes de nova tentativa.</p>}
      {result?.kind === 'error' && <p role="alert">Não foi possível confirmar o cadastro. Confira o resultado com o serviço responsável antes de nova tentativa.</p>}
      <button type="submit" disabled={blocked}>Cadastrar pessoa</button>
      {blocked && !busy && <p role="status">Novo envio bloqueado até reconciliação pelo chamador.</p>}
    </form>
    <p>Rascunho temporário mantido apenas em memória. Sair ou perder o contexto descarta os dados. A edição não cria uma pessoa.</p>
    <p>Cadastrar a pessoa não envia convite nem cria membresia.</p>
  </section>
}
