import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { parsePlanningPage, parseSpace, readOccurrenceSpace, readPlanningOverlaps } from './planning-api'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const candidate = '00000000-0000-0000-0000-000000000003'
const space = { churchId: church, occurrenceId: id, code: 'MAIN', name: 'Salão', revision: 7, defined: true, label: 'Salão' }
const item = { occurrenceId: candidate, startsAt: '2026-11-09T10:00:00.123456Z', endsAt: '2026-11-09T12:00:00Z', status: 'DRAFT', outcome: 'PREVENTIVE', overlap: 'PT1H59M59.876544S' }
const page = { occurrenceId: id, outcome: 'CRITICAL', hasUnresolvedSpaces: true, limitSeconds: 1800, items: [item], page: 0, size: 20, total: 21 }
function clientFor(response: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(response); return { client, request } }
describe('espaço e sobreposições 1.0.0', () => {
  it('usa contexto/paginação reais, descarta segredos e conserva o resumo global do servidor', async () => {
    const { client, request } = clientFor({ ...page, items: [{ ...item, person: 'private', privateUrl: 'private', spaceName: 'private' }] })
    expect(await readPlanningOverlaps(church, id, 0, undefined, client)).toEqual(page)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${id}/conflicts?page=0&size=20`, { signal: undefined })
    request.mockResolvedValue({ ...space, privateUrl: 'private' })
    expect(await readOccurrenceSpace(church, id, undefined, client)).toEqual(space)
    expect(request).toHaveBeenLastCalledWith(`/events/churches/${church}/occurrences/${id}/space`, { signal: undefined })
  })
  it('preserva código sensível a maiúsculas e espaço indefinido, sem normalizar nomes', () => {
    expect(parseSpace({ ...space, code: 'main' }, church, id).code).toBe('main')
    expect(parseSpace({ ...space, code: null, name: null, defined: false, label: 'A definir' }, church, id).defined).toBe(false)
    expect(parsePlanningPage({ ...page, outcome: 'UNDETERMINED', items: [], total: 0 }, id, 0).outcome).toBe('UNDETERMINED')
  })
  it.each([{}, { ...space, churchId: candidate }, { ...space, occurrenceId: candidate }, { ...space, revision: -1 },
    { ...space, code: ' MAIN' }, { ...space, code: null }, { ...space, defined: false }, { ...space, label: 'Inventado' },
    { ...space, name: '' }, { ...space, name: 'x'.repeat(181) }, { ...space, name: undefined },
  ])('rejeita espaço incompatível %j', v => { expect(() => parseSpace(v, church, id)).toThrow() })
  it.each([{}, { ...page, occurrenceId: candidate }, { ...page, outcome: 'AVAILABLE' }, { ...page, hasUnresolvedSpaces: 'false' },
    { ...page, page: 1 }, { ...page, size: 100 }, { ...page, total: -1 }, { ...page, limitSeconds: -1 },
    { ...page, items: [item, item] }, { ...page, items: [{ ...item, occurrenceId: id }] },
    { ...page, items: [{ ...item, startsAt: '2026-02-30T10:00:00Z' }] }, { ...page, items: [{ ...item, outcome: 'ALLOWED' }] },
    { ...page, items: [{ ...item, overlap: '30 minutos' }] }, { ...page, items: [{ ...item, overlap: 'PT' }] },
    { ...page, items: [{ ...item, overlap: 'PT-1S' }] }, { ...page, items: [{ ...item, overlap: undefined }] },
  ])('rejeita avaliação incompatível %j', v => { expect(() => parsePlanningPage(v, id, 0)).toThrow() })
  it('conserva estados legados e precisão de duração, sem recomputar gravidade', () => {
    const result = parsePlanningPage({ ...page, items: [{ ...item, status: 'OPEN', outcome: 'UNDETERMINED', overlap: null }] }, id, 0)
    expect(result.outcome).toBe('CRITICAL')
    expect(result.items[0]).toMatchObject({ status: 'OPEN', overlap: null, outcome: 'UNDETERMINED' })
  })
  it('rejeita parâmetros antes da rede', async () => {
    const { client, request } = clientFor(page)
    await expect(readOccurrenceSpace('../x', id, undefined, client)).rejects.toThrow()
    await expect(readPlanningOverlaps(church, 'bad', 0, undefined, client)).rejects.toThrow()
    await expect(readPlanningOverlaps(church, id, 100001, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
