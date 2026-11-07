import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { createCalendar, setCalendarPublished, type AnnualCalendar } from './calendar-api'

const church = '00000000-0000-0000-0000-000000000001'
const calendar: AnnualCalendar = { id: '00000000-0000-0000-0000-000000000003', churchId: church, year: 2026,
  status: 'DRAFT', revision: 4, createdAt: '2026-11-07T12:00:00.123456Z', publishedAt: null }
const published: AnnualCalendar = { ...calendar, status: 'PUBLISHED', publishedAt: '2026-11-07T12:30:00.123456Z' }
function response(value: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(value); return { client, request } }

describe('confirmação de calendário segundo EventCalendarService integrado', () => {
  it.each([3, 4, 6])('não confirma publicação com revisão %s quando a transição exige 5', async revision => {
    const { client, request } = response({ ...published, revision })
    await expect(setCalendarPublished(calendar, true, undefined, client)).rejects.toThrow('confirmar')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('não confirma alteração da data de criação, mesmo quando só difere um microssegundo', async () => {
    const { client } = response({ ...published, revision: 5, createdAt: '2026-11-07T12:00:00.123457Z' })
    await expect(setCalendarPublished(calendar, true, undefined, client)).rejects.toThrow('confirmar')
  })
  it('confirma transição real e datas equivalentes com offset sem perder precisão', async () => {
    const { client, request } = response({ ...published, revision: 5, createdAt: '2026-11-07T09:00:00.123456-03:00' })
    expect((await setCalendarPublished(calendar, true, undefined, client)).revision).toBe(5)
    request.mockResolvedValue({ ...calendar, revision: 5 })
    expect((await setCalendarPublished(published, false, undefined, client)).revision).toBe(5)
  })
  it.each([false, true])('aceita no-op de publicação %s sem incremento', async target => {
    const before = target ? published : calendar
    const { client } = response(before)
    expect((await setCalendarPublished(before, target, undefined, client)).revision).toBe(4)
  })
  it.each([false, true])('rejeita incremento em no-op de publicação %s', async target => {
    const before = target ? published : calendar
    const { client } = response({ ...before, revision: 5 })
    await expect(setCalendarPublished(before, target, undefined, client)).rejects.toThrow('confirmar')
  })
  it('no-op publicado conserva a data de publicação com precisão submilissegundo', async () => {
    const { client } = response({ ...published, publishedAt: '2026-11-07T12:30:00.123457Z' })
    await expect(setCalendarPublished(published, true, undefined, client)).rejects.toThrow('confirmar')
  })
  it('no-op aceita outra representação do mesmo instante de publicação', async () => {
    const { client } = response({ ...published, publishedAt: '2026-11-07T09:30:00.123456-03:00' })
    expect((await setCalendarPublished(published, true, undefined, client)).revision).toBe(4)
  })
  it.each([1, 4])('não confirma criação com revisão inicial %s', async revision => {
    const { client } = response({ ...calendar, revision })
    await expect(createCalendar(church, 2026, undefined, client)).rejects.toThrow('confirmar')
  })
  it('confirma criação em revisão zero', async () => {
    const { client } = response({ ...calendar, revision: 0 })
    expect((await createCalendar(church, 2026, undefined, client)).revision).toBe(0)
  })
})
