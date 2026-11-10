import { api } from '../api'
import { isUuid } from '../validation'
import type { PersonDraft } from './PersonViews'

export type RegistrationDraft = PersonDraft & { documentType?: 'CPF' | 'CIN_CPF' }
export async function registerPerson(draft: RegistrationDraft, churchId: string, signal: AbortSignal) {
  if (!isUuid(churchId)) throw new Error('Contexto inválido.')
  const data = await api.request<unknown>('/people/administrative-registrations', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: draft.fullName.trim(), documentType: draft.documentType ?? 'CPF', documentNumber: draft.cpf.trim(),
      email: draft.email.trim() || null, phone: draft.phone.trim() || null, birthDate: draft.birthDate || null, churchId }),
  }, 201)
  if (typeof data !== 'object' || data === null || !('personId' in data) || typeof data.personId !== 'string' || !isUuid(data.personId)
    || !('fullName' in data) || typeof data.fullName !== 'string' || !data.fullName.trim()
    || !('churchId' in data) || data.churchId !== churchId
    || Object.keys(data).some(key => !['personId', 'fullName', 'churchId'].includes(key))) throw new Error('Confirmação inválida.')
  return { fullName: data.fullName }
}
