import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { civilDate, eventTouchesDate, readAgenda, readAgendaReference } from './agenda-api'
import type { EventRecord } from './record-api'

const church = '00000000-0000-0000-0000-000000000001'
const record = (i: number): EventRecord => ({ id: `00000000-0000-0000-0000-${String(i + 100).padStart(12, '0')}`, churchId: church,
  eventTypeId: '00000000-0000-0000-0000-000000000002', eventTypeVersionId: null, recurrenceRuleId: null, name: `Evento ${i}`, location: 'Salão',
  startsAt: '2035-01-01T10:00:00Z', endsAt: '2035-01-01T11:00:00Z', capacity: null, modality: 'IN_PERSON', participationMode: 'OPEN_EVENT',
  checkInRequired: false, draft: false, status: 'AVAILABLE', revision: 1, audience: null })
const page = { referenceAt: '2035-01-03T12:00:00Z', timeZone: 'America/Fortaleza', today: '2035-01-03', anchorDate: '2035-01-03',
  view: 'WEEK', startsOn: '2035-01-01', endsOnExclusive: '2035-01-08', from: '2035-01-01T03:00:00Z', to: '2035-01-08T03:00:00Z',
  page: 0, size: 100, total: 0, items: [] as EventRecord[] }
function fixture(...results: unknown[]) { const client = new ApiClient(), request = vi.spyOn(client, 'request'); results.forEach(v => request.mockResolvedValueOnce(v)); return { client, request } }
describe('agenda integrada com servidor', () => {
  it('fixa âncora autoritativa ao buscar todas as páginas mesmo na virada do dia', async () => {
    const first = { ...page, total: 101, items: Array.from({ length: 100 }, (_, i) => record(i)) }
    const c = fixture(first, { ...page, today: '2035-01-04', referenceAt: '2035-01-04T12:00:00Z', page: 1, total: 101, items: [record(100)] })
    const result = await readAgenda(church, 'WEEK', undefined, undefined, c.client)
    expect(result.items).toHaveLength(101)
    expect(c.request.mock.calls[1][0]).toContain('date=2035-01-03')
    expect(result.today).toBe('2035-01-03')
  })
  it.each([{ total: 102 }, { from: '2035-01-01T04:00:00Z' }, { items: [record(0)] }])('rejeita mudança entre páginas sem mostrar calendário parcial', async changed => {
    const c = fixture({ ...page, total: 101, items: Array.from({ length: 100 }, (_, i) => record(i)) }, { ...page, page: 1, total: 101, items: [record(100)], ...changed })
    await expect(readAgenda(church, 'WEEK', undefined, undefined, c.client)).rejects.toThrow(/agenda mudou/)
  })
  it('rejeita timezone/igreja divergentes e não transporta extras privados', async () => {
    const c = fixture({ ...page, timeZone: 'invalid' })
    await expect(readAgenda(church, 'WEEK', undefined, undefined, c.client)).rejects.toThrow()
    c.request.mockResolvedValueOnce({ ...page, total: 1, items: [{ ...record(0), churchId: '00000000-0000-0000-0000-000000000003' }] })
    await expect(readAgenda(church, 'WEEK', undefined, undefined, c.client)).rejects.toThrow()
    c.request.mockResolvedValueOnce({ ...page, total: 1, items: [{ ...record(0), privateUrl: 'secret' }] })
    expect((await readAgenda(church, 'WEEK', undefined, undefined, c.client)).items[0]).not.toHaveProperty('privateUrl')
  })
  it('não consulta com data/contexto inválido e respeita cancelamento', async () => {
    const c = fixture(page), abort = new AbortController(); abort.abort()
    await expect(readAgenda(church, 'WEEK', undefined, abort.signal, c.client)).rejects.toThrow()
    await expect(readAgenda('invalid', 'WEEK', undefined, undefined, c.client)).rejects.toThrow()
    await expect(readAgenda(church, 'WEEK', '2035-02-30', undefined, c.client)).rejects.toThrow()
    expect(c.request).not.toHaveBeenCalled()
  })
  it('consulta referência com uma linha e aceita limite final de ano9999', async () => {
    const c = fixture({ ...page, size: 1 })
    expect((await readAgendaReference(church, undefined, c.client)).timeZone).toBe('America/Fortaleza')
    c.request.mockResolvedValueOnce({ ...page, view: 'MONTH', anchorDate: '9998-12-03', startsOn: '9998-12-01', endsOnExclusive: '9999-01-01',
      from: '9998-12-01T03:00:00Z', to: '9999-01-01T03:00:00Z' })
    expect((await readAgenda(church, 'MONTH', '9998-12-03', undefined, c.client)).endsOnExclusive).toBe('9999-01-01')
    expect(civilDate('9999-01-01')).toBe(true)
  })
  it('evento que atravessa dias continua em cada dia, excluindo meia-noite final exata', () => {
    const event = { ...record(0), startsAt: '2035-01-02T02:00:00Z', endsAt: '2035-01-03T03:00:00Z' }
    expect(eventTouchesDate(event, '2035-01-01', 'America/Fortaleza')).toBe(true)
    expect(eventTouchesDate(event, '2035-01-02', 'America/Fortaleza')).toBe(true)
    expect(eventTouchesDate(event, '2035-01-03', 'America/Fortaleza')).toBe(false)
    expect(eventTouchesDate({ ...event, endsAt: '2035-01-03T03:00:00.000001Z' }, '2035-01-03', 'America/Fortaleza')).toBe(true)
  })
})
