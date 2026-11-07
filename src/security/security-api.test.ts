import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { listProfiles, listProfileVersions, readPermissionCatalog, readProfile, readProfileVersion } from './security-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const profileId = '00000000-0000-0000-0000-000000000002'
const versionId = '00000000-0000-0000-0000-000000000003'
const profile = { id: profileId, code: 'READER', name: 'Consulta', scopeType: 'CHURCH', status: 'ENABLED', revision: 4, publishedVersionId: versionId }
const version = { id: versionId, versionNumber: 1, name: 'Consulta anterior', status: 'LEGACY_SNAPSHOT', revision: 0, createdAt: '2026-11-07T12:00:00Z', publishedAt: null }
const permission = { code: 'EVENT_VIEW', introducedIn: 'events-1', resourceType: 'CHURCH', scopeTypes: ['CHURCH'], available: true }
const catalog = { catalogVersion: 'sha256:test', permissions: [permission] }
function respond(value: unknown) {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(value)))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('contratos de leitura administrativa RBAC', () => {
  it('consulta catálogo real, preserva indisponíveis e descarta campos extras', async () => {
    const fetcher = respond({ ...catalog, permissions: [{ ...permission, available: false, privateUrl: 'privado' }] })
    expect(await readPermissionCatalog(denomination)).toEqual({ ...catalog, permissions: [{ ...permission, available: false }] })
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/security/denominations/${denomination}/permission-catalog`)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin' })
  })
  it('lista perfis e versões com paginação contratada, sem autores', async () => {
    const fetcher = respond({ items: [{ ...profile, createdBy: 'privado' }], page: 2, size: 20, total: 41 })
    expect((await listProfiles(denomination, 2)).items).toEqual([profile])
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/security/denominations/${denomination}/profiles?page=2&size=20`)
    respond({ items: [{ ...version, createdBy: 'privado' }], page: 0, size: 20, total: 1 })
    expect((await listProfileVersions(denomination, profileId)).items).toEqual([version])
  })
  it('detalhe de versão preserva permissões retiradas como snapshot, sem consultar catálogo atual', async () => {
    const detail = { ...version, permissionCodes: ['RETIRED_CODE', 'EVENT_VIEW'] }
    const fetcher = respond({ ...detail, userId: 'privado' })
    expect(await readProfileVersion(denomination, profileId, versionId)).toEqual(detail)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/security/denominations/${denomination}/profiles/${profileId}/versions/${versionId}`)
  })
  it('consulta perfil sem converter status/escopo legado em concessão', async () => {
    const legacy = { ...profile, scopeType: 'LEGACY_SCOPE', status: 'LEGACY_REVIEW' }
    respond(legacy)
    expect(await readProfile(denomination, profileId)).toEqual(legacy)
  })
  it('mantém Basic em memória e cookies na consulta', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/accounts/me')
      ? { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' } : url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : profile)))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await client.login('ana', 'test-password')
    await readProfile(denomination, profileId, undefined, client)
    expect(new Headers(fetcher.mock.calls[2][1].headers).get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
  })
  it.each([
    {}, { ...catalog, catalogVersion: '' }, { ...catalog, permissions: [permission, permission] },
    ...[{ resourceType: 'PERSON' }, { scopeTypes: ['GLOBAL'] }, { scopeTypes: ['CHURCH', 'CHURCH'] }, { available: 'true' }].map(change => ({ ...catalog, permissions: [{ ...permission, ...change }] })),
  ])('rejeita catálogo incompatível %j', async value => {
    respond(value)
    await expect(readPermissionCatalog(denomination)).rejects.toThrow('validar')
  })
  it.each([
    {}, { ...profile, id: denomination }, { ...profile, revision: -1 }, { ...profile, publishedVersionId: 'invalid' },
  ])('rejeita perfil incompatível ou de outro ID %j', async value => {
    respond(value)
    await expect(readProfile(denomination, profileId)).rejects.toThrow('validar')
  })
  it.each([
    { items: [profile], page: 1, size: 20, total: 1 }, { items: [profile], page: 0, size: 100, total: 1 },
    { items: [profile, profile], page: 0, size: 20, total: 2 }, { items: [], page: 0, size: 20, total: -1 },
  ])('rejeita paginação incompatível %j', async value => {
    respond(value)
    await expect(listProfiles(denomination)).rejects.toThrow('validar')
  })
  it.each([
    { ...version, id: denomination, permissionCodes: [] }, { ...version, status: 'ENABLED', permissionCodes: [] },
    { ...version, createdAt: '2026-02-30T12:00:00Z', permissionCodes: [] }, { ...version, permissionCodes: ['DUPLICATE', 'DUPLICATE'] },
    { ...version, permissionCodes: [123] },
  ])('rejeita detalhe incompatível %j', async value => {
    respond(value)
    await expect(readProfileVersion(denomination, profileId, versionId)).rejects.toThrow('validar')
  })
  it('bloqueia IDs e páginas inválidos antes de consultar', async () => {
    const fetcher = respond({})
    await expect(readPermissionCatalog('../private')).rejects.toThrow()
    await expect(readProfile(denomination, '')).rejects.toThrow()
    await expect(readProfileVersion(denomination, profileId, 'invalid')).rejects.toThrow()
    await expect(listProfileVersions(denomination, profileId, 100001)).rejects.toThrow()
    await expect(listProfiles(denomination, -1)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
