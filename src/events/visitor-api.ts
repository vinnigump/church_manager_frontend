import { api } from '../api'
import { publicCommand, publicRead } from '../public-api'
import { isInstant, isUuid } from '../validation'
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = () => new Error('Não foi possível validar a inscrição pública.')
function ids(church: string, event: string) { if (!isUuid(church) || !isUuid(event)) throw invalid(); return `/churches/${church}/events/${event}/registration` }
export interface VisitorEvent { id: string; churchId: string; name: string; startsAt: string; endsAt: string }
export interface VisitorInput { requestId: string; person: { fullName: string; birthDate: string; cpf: string | null; email: string | null; phone: string | null } }
export interface VisitorConfirmation { status: 'CONFIRMED'; firstAccess: { relativeUrl: string; expiresAt: string } | null }
export async function visitorOption(church: string, event: string, signal: AbortSignal): Promise<VisitorEvent> {
 const v = await publicRead('/public' + ids(church,event), signal)
 if (!object(v) || v.id !== event || v.churchId !== church || typeof v.name !== 'string' || !v.name.trim() || !isInstant(v.startsAt) || !isInstant(v.endsAt) || v.visibility !== 'PUBLIC') throw invalid()
 return { id:event, churchId:church, name:v.name, startsAt:v.startsAt, endsAt:v.endsAt }
}
export async function registerVisitor(church: string, event: string, input: VisitorInput, signal: AbortSignal): Promise<VisitorConfirmation> {
 const v = await publicCommand('/public' + ids(church,event), input, signal, 200)
 if (!object(v) || v.status !== 'CONFIRMED') throw invalid()
 const link = v.firstAccess
 if (link !== null && (!object(link) || typeof link.relativeUrl !== 'string' || !/^\/primeiro-acesso#token=[A-Za-z0-9_-]{43}$/.test(link.relativeUrl) || !isInstant(link.expiresAt))) throw invalid()
 return { status:'CONFIRMED', firstAccess:link as VisitorConfirmation['firstAccess'] }
}
export interface PublicSetting { id: string; churchId: string; revision: number; enabled: boolean; compatible: boolean }
async function setting(church: string, event: string, signal: AbortSignal, before?: PublicSetting): Promise<PublicSetting> {
 ids(church,event)
 const v = await api.request<unknown>(`/events/churches/${church}/occurrences/${event}/public-registration`, before ? { method:'PUT', headers:{'X-Expected-Revision':String(before.revision),'Content-Type':'application/json'}, body:JSON.stringify({ enabled:!before.enabled }), signal } : {signal})
 if(!object(v) || v.id!==event || v.churchId!==church || !Number.isSafeInteger(v.revision) || (v.revision as number)<0 || typeof v.enabled!=='boolean' || typeof v.compatible!=='boolean') throw invalid()
 return v as unknown as PublicSetting
}
export const readPublicSetting = (church: string,event: string,signal: AbortSignal) => setting(church,event,signal)
export const togglePublicSetting = (church: string,event: string,before: PublicSetting,signal: AbortSignal) => setting(church,event,signal,before)

