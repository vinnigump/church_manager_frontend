import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { fieldsForRecord, changeOffset, recordInput } from './record-form'
import { listRecords, parseRecord, readRecord, saveRecord, type EventRecord, type RecordWrite } from './record-api'

const church = '00000000-0000-0000-0000-000000000001', id = '00000000-0000-0000-0000-000000000002'
const type = '00000000-0000-0000-0000-000000000003', other = '00000000-0000-0000-0000-000000000004'
const audience = { visibility: 'PUBLIC' as const, churchLinkRequired: false, activeMembershipRequired: false, minimumAge: null, maximumAge: null,
  functionIds: [], ministryIds: [], departmentIds: [] }
const input: RecordWrite = { eventTypeId: type, name: 'Encontro', location: 'Salão', startsAt: '2035-01-01T10:00:00.123456Z', endsAt: '2035-01-01T11:00:00Z',
  capacity: null, modality: 'IN_PERSON', participationMode: 'REGISTRATION_REQUIRED', checkInRequired: false, draft: false, audience }
const value: EventRecord = { ...input, id, churchId: church, recurrenceRuleId: null, eventTypeVersionId: null, revision: 1, status: 'AVAILABLE' }
function client(result: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(result); return { client, request } }
describe('event-records-v1 integrado', () => {
  it('cria disponível com público no mesmo POST, sem publicar e sem campos extras', async () => {
    const c = client({ ...value, privateUrl: 'https://private.invalid', participants: [other] })
    expect(await saveRecord(church, { ...input, privateUrl: 'secret' } as RecordWrite, null, undefined, c.client)).toEqual(value)
    expect(c.request).toHaveBeenCalledTimes(1)
    const [path, init] = c.request.mock.calls[0]
    expect(path).toBe(`/events/churches/${church}/records`)
    expect(init?.method).toBe('POST'); expect(JSON.parse(String(init?.body))).toEqual(input)
  })
  it('envia revisão no PUT e reconhece alteração combinada em uma revisão', async () => {
    const next = { ...input, name: 'Novo nome', audience: { ...audience, visibility: 'CHURCH' as const } }
    const c = client({ ...value, ...next, revision: 2 })
    await saveRecord(church, next, value, undefined, c.client)
    expect(c.request.mock.calls[0][1]?.headers).toMatchObject({ 'X-Expected-Revision': '1' })
  })
  it('aceita no-op e ciclo de horário sem falsos erros de gravação', async () => {
    const noop = client(value); await expect(saveRecord(church, input, value, undefined, noop.client)).resolves.toEqual(value)
    const ended = client({ ...value, status: 'COMPLETED', revision: 2 })
    await expect(saveRecord(church, input, null, undefined, ended.client)).resolves.toMatchObject({ status: 'COMPLETED' })
  })
  it.each([{ ...value, churchId: other }, { ...value, id: other }, { ...value, revision: 5 }, { ...value, name: 'Outro nome' }, { ...value, audience: { ...audience, visibility: 'CHURCH' } }])('rejeita confirmação divergente', async result => {
    const c = client(result)
    await expect(saveRecord(church, input, value, undefined, c.client)).rejects.toThrow()
  })
  it('não envia alteração inválida nem muda tipo/horário de série', async () => {
    const c = client(value)
    await expect(saveRecord(church, { ...input, audience: null } as unknown as RecordWrite, null, undefined, c.client)).rejects.toThrow()
    await expect(saveRecord(church, { ...input, eventTypeId: other }, { ...value, recurrenceRuleId: other }, undefined, c.client)).rejects.toThrow()
    expect(c.request).not.toHaveBeenCalled()
  })
  it('lista paginada e detalhe rejeitam troca de contexto e itens repetidos', async () => {
    const c = client({ items: [value], page: 0, size: 20, total: 1 })
    expect((await listRecords(church, 0, undefined, c.client)).items).toEqual([value])
    c.request.mockResolvedValue({ items: [value, value], page: 0, size: 20, total: 2 })
    await expect(listRecords(church, 0, undefined, c.client)).rejects.toThrow()
    c.request.mockResolvedValue({ ...value, id: other })
    await expect(readRecord(church, id, undefined, c.client)).rejects.toThrow()
  })
  it('preserva ausência de política/configuração em registros antigos e valida estado/rascunho', () => {
    expect(parseRecord({ ...value, status: 'OPEN', draft: false, location: null, audience: null, modality: null }, church)).toMatchObject({ audience: null, location: null })
    expect(() => parseRecord({ ...value, draft: true }, church)).toThrow()
  })
  it('fuso explícito converte corretamente e preserva microssegundos ao editar', () => {
    const fields = changeOffset(fieldsForRecord(value), '-03:00')
    expect(fields.startsAt).toBe('2035-01-01T07:00:00')
    expect(recordInput(fields, false, value)).toEqual(input)
    const create = { ...fields, startsAt: '2035-01-01T07:30:00' }
    expect(recordInput(create, true, null).startsAt).toBe('2035-01-01T07:30:00-03:00')
    expect(() => recordInput({ ...fields, offset: '' }, false, null)).toThrow()
  })
})
