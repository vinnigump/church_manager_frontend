import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { listManagedUnits } from './managed-units-api'
const church = '00000000-0000-0000-0000-000000000001', unit = '00000000-0000-0000-0000-000000000002', other = '00000000-0000-0000-0000-000000000003'
const item = { id: unit, churchId: church, kind: 'MINISTRY', ministryId: unit, name: 'Acolhimento', ministryName: 'Acolhimento', active: true }
const page = { items: [item], page: 0, size: 20, total: 1 }
describe('diretório ministerial integrado', () => {
  it('pesquisa/pagina no servidor e projeta somente o contrato sem dados extras', async () => {
    const client = new ApiClient(), request = vi.spyOn(client, 'request').mockResolvedValue({ ...page, items: [{ ...item, participants: [other] }] })
    expect(await listManagedUnits(church, '  Acolhimento  ', 'MINISTRY', 0, undefined, client)).toEqual(page)
    const [path, init] = request.mock.calls[0]
    expect(path).toBe(`/membership/churches/${church}/managed-ministry-units?page=0&size=20&kind=MINISTRY&q=Acolhimento`)
    expect(init?.method).toBeUndefined()
  })
  it.each([{ ...item, churchId: other }, { ...item, kind: 'GROUP' }, { ...item, ministryId: other }, { ...item, active: undefined }])('rejeita resposta fora do contrato/contexto', async invalid => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...page, items: [invalid] })
    await expect(listManagedUnits(church, '', '', 0, undefined, client)).rejects.toThrow()
  })
  it('rejeita duplicados, tipo diferente do filtro e paginação divergente', async () => {
    const client = new ApiClient(), request = vi.spyOn(client, 'request').mockResolvedValue({ ...page, items: [item, item], total: 2 })
    await expect(listManagedUnits(church, '', '', 0, undefined, client)).rejects.toThrow()
    request.mockResolvedValue(page)
    await expect(listManagedUnits(church, '', 'DEPARTMENT', 0, undefined, client)).rejects.toThrow()
    request.mockResolvedValue({ ...page, page: 1 })
    await expect(listManagedUnits(church, '', '', 0, undefined, client)).rejects.toThrow()
  })
  it('entrada inválida não consulta rede', async () => {
    const client = new ApiClient(), request = vi.spyOn(client, 'request')
    await expect(listManagedUnits('invalid', '', '', 0, undefined, client)).rejects.toThrow()
    await expect(listManagedUnits(church, 'x'.repeat(121), '', 0, undefined, client)).rejects.toThrow()
    await expect(listManagedUnits(church, '', '', -1, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
