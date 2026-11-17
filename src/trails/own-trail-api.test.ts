import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { listOwnTrails, listOwnTrailTasks, parseOwnTrail, parseOwnTrailTask, readOwnTrail } from './own-trail-api'

const id = '00000000-0000-0000-0000-000000000001', other = '00000000-0000-0000-0000-000000000002'
const trail = { id, churchId: other, churchName: 'Igreja sintética', templateId: id, name: 'Membresia', versionId: other, versionNumber: 1,
  status: 'IN_PROGRESS', startedAt: '2035-01-01T10:00:00Z', completedAt: null, taskCount: 2, completedTaskCount: 1 }
const task = { id, position: 1, name: 'Acolhimento', type: 'MANUAL', required: true, status: 'AVAILABLE', completedAt: null }
const page = (items: unknown[]) => ({ items, page: 0, size: 20, total: items.length })
function client(value: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(value); return { client, request } }
describe('own-trails-v1', () => {
  it('usa somente caminhos self, sem identidade ou igreja informada pelo cliente', async () => {
    const c = client(page([trail])); expect((await listOwnTrails(0, undefined, c.client)).items).toEqual([trail])
    expect(c.request.mock.calls[0]).toEqual(['/accounts/me/trails?page=0&size=20', { signal: undefined, cache: 'no-store' }])
    c.request.mockResolvedValue(trail); await expect(readOwnTrail(id, undefined, c.client)).resolves.toEqual(trail)
    c.request.mockResolvedValue(page([task])); await expect(listOwnTrailTasks(id, 0, undefined, c.client)).resolves.toEqual(page([task]))
  })
  it('projeta somente campos aprovados, sem propagar respostas/config/terceiros', () => {
    expect(parseOwnTrail({ ...trail, personId: other, answers: ['private'] })).toEqual(trail)
    expect(parseOwnTrailTask({ ...task, config: { private: true }, description: 'private', actorUserId: other })).toEqual(task)
  })
  it.each([{ ...trail, completedTaskCount: 3 }, { ...trail, status: 'UNKNOWN' }, { ...trail, startedAt: 'not-a-date' }])('rejeita resumo inválido', value => {
    expect(() => parseOwnTrail(value)).toThrow()
  })
  it('rejeita resposta de outro id, ids repetidos e etapas fora de ordem', async () => {
    const c = client({ ...trail, id: other }); await expect(readOwnTrail(id, undefined, c.client)).rejects.toThrow()
    c.request.mockResolvedValue(page([trail, trail])); await expect(listOwnTrails(0, undefined, c.client)).rejects.toThrow()
    c.request.mockResolvedValue(page([{ ...task, position: 2 }, { ...task, id: other, position: 1 }]))
    await expect(listOwnTrailTasks(id, 0, undefined, c.client)).rejects.toThrow()
  })
  it('paginação e id inválidos falham antes da rede', async () => {
    const c = client(page([]))
    await expect(listOwnTrails(-1, undefined, c.client)).rejects.toThrow()
    await expect(listOwnTrailTasks('invalid', 0, undefined, c.client)).rejects.toThrow()
    expect(c.request).not.toHaveBeenCalled()
  })
})
