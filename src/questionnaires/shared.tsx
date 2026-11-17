import { type ReactNode } from 'react'
import { ReadResult, useRead } from '../security/SecurityPages'
export const managePermission = 'QUESTIONNAIRE_MANAGE'
export const readPermission = 'QUESTIONNAIRE_RESPONSE_READ'
export const gradePermission = 'QUESTIONNAIRE_GRADE'
export const exportPermission = 'QUESTIONNAIRE_EXPORT'
export const questionnaireStatus = (value: string) => ({ STARTED: 'Em preenchimento', SUBMITTED: 'Aguardando correção', GRADED: 'Corrigido', DRAFT: 'Rascunho', PUBLISHED: 'Disponível' }[value] ?? value)
export function ScopedRead<T>({ context, load, label, children, refresh = true }: { context: string; load: (signal: AbortSignal) => Promise<T>; label: string; children: (value: T) => ReactNode; refresh?: boolean }) {
  const query = useRead(context, load)
  if (refresh) return <ReadResult query={query} label={label}>{children}</ReadResult>
  return query.state.kind === 'loading' ? <p role="status">Carregando {label}…</p> : query.state.kind === 'error' ? <><p role="alert">{query.state.message}</p><button onClick={query.refresh}>Tentar consultar novamente</button></> : <>{children(query.state.data)}</>
}
