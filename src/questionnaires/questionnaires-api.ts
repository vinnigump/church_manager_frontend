import { api } from '../api'
import { isUuid } from '../validation'
export type Kind = 'MULTIPLE_CHOICE' | 'TEXT' | 'SCALE' | 'TRUE_FALSE'
export interface Option { id: string; label: string; correct: boolean | null }
export interface Question { id: string; statement: string; type: Kind; evaluated: boolean; options: Option[]; scaleMin: number | null; scaleMax: number | null; correctScale: number | null; correctBoolean: boolean | null }
export interface Version { id: string; questionnaireId: string; churchId: string; versionNumber: number; name: string; status: 'DRAFT' | 'PUBLISHED'; revision: number; attemptLimit: number | null; minimumScore: number | null; questions: Question[] }
export interface Answer { questionId: string; value: string | null; optionIds: string[]; score: number | null; feedback: string | null }
export interface Application { id: string; versionId: string; taskInstanceId: string | null; status: 'STARTED' | 'SUBMITTED' | 'GRADED'; revision: number; score: number | null; feedbackReady: boolean; answerKeyAvailable: boolean; questionnaire: Version; answers: Answer[] }
export interface Summary { id: string; name: string; publishedVersionId: string | null; draftVersionId: string | null }
export interface ApplicationSummary { id: string; versionId: string; taskInstanceId: string | null; status: Application['status']; revision: number; score: number | null; submittedAt: string | null }
export interface ResponseSummary extends ApplicationSummary { personId: string; displayName: string }
export interface VersionSummary { id: string; versionNumber: number; name: string; status: Version['status']; revision: number }
export interface Context { churchId: string; churchName: string; canRespond: boolean }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
export interface QuestionWrite { statement: string; type: Kind; evaluated: boolean; options: { label: string; correct: boolean | null }[]; scaleMin: number | null; scaleMax: number | null; correctScale: number | null; correctBoolean: boolean | null }
export interface Write { name: string; attemptLimit: number | null; unlimitedAttempts: boolean; minimumScore: number | null; questions: QuestionWrite[] }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const nullableUuid = (v: unknown) => v === null || uuid(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const score = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const flag = (v: unknown) => v === null || typeof v === 'boolean'
const optionalInteger = (v: unknown) => v === null || Number.isSafeInteger(v)
const invalid = () => new Error('Não foi possível validar os dados do questionário. Atualize a consulta.')
export const route = (church: string) => `/questionarios/igrejas/${church}`
function base(church: string) { if (!uuid(church)) throw invalid(); return `/questionnaires/churches/${church}` }
function id(v: string) { if (!uuid(v)) throw invalid(); return v }
function question(raw: unknown): Question {
  if (!object(raw) || !uuid(raw.id) || !text(raw.statement) || !['MULTIPLE_CHOICE', 'TEXT', 'SCALE', 'TRUE_FALSE'].includes(String(raw.type)) || typeof raw.evaluated !== 'boolean' || !Array.isArray(raw.options) || raw.options.length > 50 || !optionalInteger(raw.scaleMin) || !optionalInteger(raw.scaleMax) || !optionalInteger(raw.correctScale) || !flag(raw.correctBoolean)) throw invalid()
  const options = raw.options.map(v => { if (!object(v) || !uuid(v.id) || !text(v.label) || !flag(v.correct)) throw invalid(); return v as unknown as Option })
  return { ...raw, options } as unknown as Question
}
function version(raw: unknown, church: string): Version {
  if (!object(raw) || !uuid(raw.id) || !uuid(raw.questionnaireId) || raw.churchId !== church || !integer(raw.versionNumber) || !text(raw.name) || !['DRAFT', 'PUBLISHED'].includes(String(raw.status)) || !integer(raw.revision) || !(raw.attemptLimit === null || integer(raw.attemptLimit) && raw.attemptLimit > 0) || !score(raw.minimumScore) || !Array.isArray(raw.questions) || raw.questions.length > 100) throw invalid()
  return { ...raw, questions: raw.questions.map(question) } as unknown as Version
}
function application(raw: unknown, church: string): Application {
  if (!object(raw) || !uuid(raw.id) || !uuid(raw.versionId) || !nullableUuid(raw.taskInstanceId) || !['STARTED', 'SUBMITTED', 'GRADED'].includes(String(raw.status)) || !integer(raw.revision) || !score(raw.score) || typeof raw.feedbackReady !== 'boolean' || typeof raw.answerKeyAvailable !== 'boolean' || !Array.isArray(raw.answers)) throw invalid()
  const questionnaire = version(raw.questionnaire, church)
  if (questionnaire.id !== raw.versionId) throw invalid()
  const questions = new Map(questionnaire.questions.map(q => [q.id, q]))
  const answers = raw.answers.map(v => {
    if (!object(v) || !uuid(v.questionId) || !questions.has(v.questionId) || !(v.value === null || typeof v.value === 'string') || !Array.isArray(v.optionIds) || !v.optionIds.every(uuid) || !score(v.score) || !(v.feedback === null || typeof v.feedback === 'string')) throw invalid()
    const q = questions.get(v.questionId)!
    if (!v.optionIds.every(o => q.options.some(option => option.id === o))) throw invalid()
    return v as unknown as Answer
  })
  if (new Set(answers.map(a => a.questionId)).size !== answers.length) throw invalid()
  return { ...raw, questionnaire, answers } as unknown as Application
}
function summary(v: unknown): Summary { if (!object(v) || !uuid(v.id) || !text(v.name) || !nullableUuid(v.publishedVersionId) || !nullableUuid(v.draftVersionId)) throw invalid(); return v as unknown as Summary }
function applicationSummary(v: unknown): ApplicationSummary { if (!object(v) || !uuid(v.id) || !uuid(v.versionId) || !['STARTED', 'SUBMITTED', 'GRADED'].includes(String(v.status)) || !integer(v.revision) || !score(v.score) || !(v.submittedAt === null || typeof v.submittedAt === 'string' && Number.isFinite(Date.parse(v.submittedAt)))) throw invalid(); return v as unknown as ApplicationSummary }
function pageOf<T>(v: unknown, page: number, parse: (v: unknown) => T): Page<T> { if (!object(v) || v.page !== page || v.size !== 20 || !Array.isArray(v.items) || v.items.length > 20 || !integer(v.total) || v.total < v.items.length) throw invalid(); return { items: v.items.map(parse), page, size: 20, total: v.total } }
async function readPage<T>(path: string, page: number, parse: (v: unknown) => T, signal?: AbortSignal) { if (!integer(page) || page > 100000) throw invalid(); return pageOf(await api.request<unknown>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&size=20`, { signal }), page, parse) }
function command(body?: unknown, revision?: number, method = 'POST', signal?: AbortSignal): RequestInit { return { method, signal, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(revision === undefined ? {} : { 'X-Expected-Revision': String(revision) }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) } }
export async function contexts(signal?: AbortSignal): Promise<Context[]> { const raw = await api.request<unknown>('/questionnaires/my-contexts', { signal }); if (!Array.isArray(raw)) throw invalid(); return raw.map(v => { if (!object(v) || !uuid(v.churchId) || !text(v.churchName) || typeof v.canRespond !== 'boolean') throw invalid(); return v as unknown as Context }) }
export const catalog = (church: string, manage: boolean, page: number, signal?: AbortSignal) => readPage(`${base(church)}${manage ? '' : '/available'}`, page, summary, signal)
export const mine = (church: string, page: number, signal?: AbortSignal) => readPage(`${base(church)}/my-applications`, page, applicationSummary, signal)
export const responses = (church: string, page: number, signal?: AbortSignal) => readPage(`${base(church)}/responses`, page, v => { const a = applicationSummary(v); if (!object(v) || !uuid(v.personId) || !text(v.displayName)) throw invalid(); return { ...a, personId: v.personId, displayName: v.displayName } as ResponseSummary }, signal)
export const versions = (church: string, questionnaire: string, page: number, signal?: AbortSignal) => readPage(`${base(church)}/${id(questionnaire)}/versions`, page, v => { if (!object(v) || !uuid(v.id) || !integer(v.versionNumber) || !text(v.name) || !['DRAFT', 'PUBLISHED'].includes(String(v.status)) || !integer(v.revision)) throw invalid(); return v as unknown as VersionSummary }, signal)
export async function readVersion(church: string, versionId: string, signal?: AbortSignal) { const v = version(await api.request<unknown>(`${base(church)}/versions/${id(versionId)}`, { signal }), church); if (v.id !== versionId) throw invalid(); return v }
export async function readApplication(church: string, applicationId: string, staff = false, signal?: AbortSignal) { const v = application(await api.request<unknown>(`${base(church)}/${staff ? 'responses' : 'applications'}/${id(applicationId)}`, { signal }), church); if (v.id !== applicationId) throw invalid(); return v }
export async function start(church: string, versionId: string, taskInstanceId: string | null, signal?: AbortSignal) { if (!nullableUuid(taskInstanceId)) throw invalid(); const v = application(await api.request<unknown>(`${base(church)}/versions/${id(versionId)}/applications`, command({ taskInstanceId }, undefined, 'POST', signal)), church); if (v.versionId !== versionId || v.taskInstanceId !== taskInstanceId) throw invalid(); return v }
export async function saveApplication(church: string, before: Application, answers: Answer[], submit: boolean, signal?: AbortSignal) { const v = application(await api.request<unknown>(`${base(church)}/applications/${id(before.id)}/${submit ? 'submit' : 'answers'}`, command({ answers: answers.map(({ questionId, value, optionIds }) => ({ questionId, value, optionIds })) }, before.revision, submit ? 'POST' : 'PUT', signal)), church); if (v.id !== before.id || v.versionId !== before.versionId || v.taskInstanceId !== before.taskInstanceId) throw invalid(); return v }
export async function saveVersion(church: string, input: Write, before: Version | null, signal?: AbortSignal) { return version(await api.request<unknown>(`${base(church)}${before ? `/versions/${id(before.id)}` : ''}`, command(input, before?.revision, before ? 'PUT' : 'POST', signal)), church) }
export async function transition(church: string, before: Version, action: 'publish' | 'draft', signal?: AbortSignal) { return version(await api.request<unknown>(`${base(church)}/versions/${id(before.id)}/${action}`, command(undefined, action === 'publish' ? before.revision : undefined, 'POST', signal)), church) }
export async function grade(church: string, before: Application, questionId: string, value: number, feedback: string, signal?: AbortSignal) { const v = await api.request<unknown>(`${base(church)}/responses/${id(before.id)}/grade`, command({ questionId, score: value, feedback: feedback.trim() || null }, before.revision, 'POST', signal)); if (!object(v) || v.applicationId !== before.id || !integer(v.revision) || !score(v.score) || typeof v.graded !== 'boolean') throw invalid(); return v }
export const exportResults = (church: string, signal?: AbortSignal) => api.request<string>(`${base(church)}/responses/export`, { signal }, undefined, 'text')
