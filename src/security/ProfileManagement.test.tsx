import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext, AuthProvider } from '../auth'
import { copyProfileDraft, createProfile, publishProfile, replaceProfileDraft, setProfileActive } from './profile-management-api'
import { type ProfileVersionDetail, type SecurityProfile } from './security-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const profileId = '00000000-0000-0000-0000-000000000003'
const publishedId = '00000000-0000-0000-0000-000000000004'
const draftId = '00000000-0000-0000-0000-000000000005'
const profile: SecurityProfile = { id: profileId, code: 'READER', name: 'Consulta', scopeType: 'CHURCH', status: 'ACTIVE', revision: 7, publishedVersionId: publishedId }
const draft: ProfileVersionDetail = { id: draftId, versionNumber: 2, name: 'Consulta', status: 'DRAFT', revision: 2, createdAt: '2026-11-07T12:00:00Z', publishedAt: null, permissionCodes: ['EVENT_VIEW'] }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const createInput = { code: 'READER', scopeType: 'CHURCH' as const, name: 'Consulta', permissionCodes: ['EVENT_VIEW'] }
const root = `/seguranca/denominacoes/${denomination}/perfis`
const route = (id = denomination) => `/seguranca/denominacoes/${id}/perfis/${profileId}/gerenciar`
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
afterEach(() => api.clear())
function server({ initialProfile = profile, initialDraft = draft, allowed = true, write }: { initialProfile?: SecurityProfile; initialDraft?: ProfileVersionDetail | null; allowed?: boolean; write?: (url: string, init: RequestInit) => Promise<Response> } = {}) {
  let p = structuredClone(initialProfile)
  let d = initialDraft && structuredClone(initialDraft)
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.endsWith('/permission-catalog')) return json({ catalogVersion: 'sha256:test', permissions: [
      { code: 'EVENT_VIEW', introducedIn: 'events-1', resourceType: 'CHURCH', scopeTypes: ['CHURCH'], available: true },
      { code: 'security:profile:manage', introducedIn: 'rbac-1', resourceType: 'DENOMINATION', scopeTypes: ['DENOMINATION'], available: true },
      { code: 'RETIRED', introducedIn: 'events-1', resourceType: 'CHURCH', scopeTypes: ['CHURCH'], available: false },
    ] })
    if (['POST', 'PUT'].includes(init.method ?? '')) {
      if (write) return write(url, init)
      const body = init.body ? JSON.parse(String(init.body)) : undefined
      const expected = init.method === 'PUT' ? d?.revision : p.revision
      if (!url.endsWith('/profiles') && new Headers(init.headers).get('X-Expected-Revision') !== String(expected)) return json({ code: 'REVISION_CONFLICT' }, 409)
      if (url.endsWith('/profiles')) { p = { ...p, status: 'DRAFT', revision: 0, publishedVersionId: null, name: body.name, code: body.code, scopeType: body.scopeType }; d = { ...draft, name: body.name, permissionCodes: body.permissionCodes, revision: 0 } }
      else if (url.endsWith('/draft') && init.method === 'POST') { d = structuredClone(draft); p = { ...p, revision: p.revision + 1 } }
      else if (url.endsWith('/draft')) {
        if (!d || body.draftVersionId !== d.id) return json({}, 409)
        d = { ...d, name: body.name, permissionCodes: body.permissionCodes, revision: d.revision + 1 }
      } else if (url.endsWith('/publish')) {
        if (!d || body.draftVersionId !== d.id || body.expectedDraftRevision !== d.revision) return json({}, 409)
        p = { ...p, name: d.name, status: p.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE', revision: p.revision + 1, publishedVersionId: d.id }
        const result = { profileId: p.id, versionId: d.id, profileRevision: p.revision, versionRevision: d.revision + 1, status: p.status }
        d = null
        return json(result)
      } else if (url.endsWith('/deactivate') || url.endsWith('/reactivate')) p = { ...p, revision: p.revision + 1, status: url.endsWith('/deactivate') ? 'DISABLED' : 'ACTIVE' }
      return json({ profileId: p.id, versionId: url.endsWith('/deactivate') || url.endsWith('/reactivate') ? p.publishedVersionId : d?.id, profileRevision: p.revision, versionRevision: d?.revision ?? 1, status: p.status }, url.endsWith('/profiles') ? 201 : 200)
    }
    if (url.endsWith('/draft')) return d ? json(d) : new Response(null, { status: 404 })
    return json(p)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init.method ?? ''))
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra denominação</button> }
async function show(path = route(), controls = false) {
  await api.login('ana', 'test-password')
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <Switch/>}<App/></AuthContext.Provider></MemoryRouter>)
}
async function save(name = 'Nome revisado') {
  const input = await screen.findByLabelText('Nome do rascunho do perfil')
  fireEvent.change(input, { target: { value: name } })
  fireEvent.submit(input.closest('form')!)
}

describe('comandos administrativos de perfis publicados', () => {
  it('cria somente com campos de contrato e retorna metadados projetados', async () => {
    const fetcher = server()
    await api.login('ana', 'test-password')
    const result = await createProfile(denomination, { ...createInput, name: '  Consulta  ' })
    expect(result.status).toBe('DRAFT')
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/security/denominations/${denomination}/profiles`)
    expect(JSON.parse(String(init.body))).toEqual(createInput)
    expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('test')
    expect(new Headers(init.headers).get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
  })
  it.each(['copy', 'edit', 'publish', 'deactivate', 'reactivate'])('%s envia revisão correta sem If-Match', async operation => {
    const before = { ...profile, status: operation === 'reactivate' ? 'DISABLED' : 'ACTIVE' }
    const fetcher = server({ initialProfile: before, initialDraft: operation === 'copy' ? null : draft })
    await api.login('ana', 'test-password')
    if (operation === 'copy') await copyProfileDraft(denomination, before)
    if (operation === 'edit') await replaceProfileDraft(denomination, before, draft, { name: 'Revisado', permissionCodes: [] })
    if (operation === 'publish') await publishProfile(denomination, before, draft)
    if (operation === 'deactivate' || operation === 'reactivate') await setProfileActive(denomination, before, operation === 'reactivate')
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/security/denominations/${denomination}/profiles/${profileId}/${operation === 'copy' || operation === 'edit' ? 'draft' : operation}`)
    expect(init.method).toBe(operation === 'edit' ? 'PUT' : 'POST')
    expect(new Headers(init.headers).get('X-Expected-Revision')).toBe(String(operation === 'edit' ? 2 : 7))
    expect(new Headers(init.headers).has('If-Match')).toBe(false)
    expect(init.body ? JSON.parse(String(init.body)) : undefined).toEqual(operation === 'edit' ? { draftVersionId: draftId, name: 'Revisado', permissionCodes: [] } : operation === 'publish' ? { draftVersionId: draftId, expectedDraftRevision: 2 } : undefined)
  })
  it('publicar desativado preserva DISABLED', async () => {
    const before = { ...profile, status: 'DISABLED' }
    server({ initialProfile: before })
    await api.login('ana', 'test-password')
    expect((await publishProfile(denomination, before, draft)).status).toBe('DISABLED')
  })
  it('sem CSRF não envia criação', async () => {
    const fetcher = server()
    await expect(createProfile(denomination, createInput, undefined, new ApiClient())).rejects.toMatchObject({ status: 403 })
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([
    { ...createInput, name: ' ' }, { ...createInput, code: 'a'.repeat(81) }, { ...createInput, name: 'a'.repeat(161) },
    { ...createInput, permissionCodes: ['EVENT_VIEW', 'EVENT_VIEW'] }, { ...createInput, permissionCodes: [''] },
  ])('rejeita criação inválida %j antes de enviar', async value => {
    const fetcher = server()
    await expect(createProfile(denomination, value)).rejects.toThrow()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('rejeita legado, draft publicado e revisão inválida', async () => {
    const fetcher = server()
    await expect(copyProfileDraft(denomination, { ...profile, status: 'LEGACY_REVIEW' })).rejects.toThrow()
    await expect(replaceProfileDraft(denomination, profile, { ...draft, status: 'PUBLISHED' }, createInput)).rejects.toThrow()
    await expect(setProfileActive(denomination, { ...profile, revision: -1 }, false)).rejects.toThrow()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([
    { profileId: other, versionId: draftId, profileRevision: 8, versionRevision: 3, status: 'ACTIVE' },
    { profileId, versionId: publishedId, profileRevision: 8, versionRevision: 3, status: 'ACTIVE' },
    { profileId, versionId: draftId, profileRevision: -1, versionRevision: 3, status: 'ACTIVE' },
  ])('não confirma publicação com resultado incompatível %j', async value => {
    server({ write: async () => json(value) })
    await api.login('ana', 'test-password')
    await expect(publishProfile(denomination, profile, draft)).rejects.toThrow('validar')
  })
})

describe('gestão de perfil com decisões atuais', () => {
  it('criação conserva código, escopo, nome e seleção de permissões durante foco', async () => {
    const fetcher = server(); await show(`${root}/novo`)
    fireEvent.change(await screen.findByLabelText('Código do perfil'), { target: { value: 'NEW' } })
    fireEvent.change(screen.getByLabelText('Escopo do perfil'), { target: { value: 'DENOMINATION' } })
    fireEvent.change(screen.getByLabelText('Nome do rascunho do perfil'), { target: { value: 'Nome não enviado' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'security:profile:manage' }))
    fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('Código do perfil')).toHaveValue('NEW')
    expect(screen.getByLabelText('Escopo do perfil')).toHaveValue('DENOMINATION')
    expect(screen.getByLabelText('Nome do rascunho do perfil')).toHaveValue('Nome não enviado')
    expect(screen.getByRole('checkbox', { name: 'security:profile:manage' })).toBeChecked()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('edição preserva alterações de nome/permissões e bloqueio de publicar após foco', async () => {
    const fetcher = server(); await show()
    fireEvent.change(await screen.findByLabelText('Nome do rascunho do perfil'), { target: { value: 'Nome local' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'EVENT_VIEW' }))
    fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('Nome do rascunho do perfil')).toHaveValue('Nome local')
    expect(screen.getByRole('checkbox', { name: 'EVENT_VIEW' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Publicar versão do perfil' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('nova leitura do catálogo não remove silenciosamente seleção que ficou indisponível', async () => {
    const fetcher = server({ initialDraft: { ...draft, permissionCodes: [] } })
    const handler = fetcher.getMockImplementation()!
    let retired = false
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => retired && url.endsWith('/permission-catalog')
      ? json({ catalogVersion: 'changed', permissions: [{ code: 'EVENT_VIEW', introducedIn: 'events-1', resourceType: 'CHURCH', scopeTypes: ['CHURCH'], available: false }] }) : handler(url, init))
    await show()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'EVENT_VIEW' }))
    retired = true; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('indisponíveis ou incompatíveis')
    const choice = screen.getByRole('checkbox', { name: /^EVENT_VIEW/ })
    expect(choice).toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeDisabled()
    fireEvent.click(choice)
    expect(screen.getByRole('button', { name: 'Publicar versão do perfil' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([
    { p: profile, d: { ...draft, revision: 3, name: 'Nome externo' } },
    { p: { ...profile, revision: 8, status: 'DISABLED' }, d: draft },
  ])('revisão concorrente não rebaseia campos locais para sobrescrever dados', async changed => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let current = { p: profile, d: draft }
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => !init?.method && url.endsWith(`/profiles/${profileId}/draft`)
      ? json(current.d) : !init?.method && url.endsWith(`/profiles/${profileId}`) ? json(current.p) : handler(url, init))
    await show()
    fireEvent.change(await screen.findByLabelText('Nome do rascunho do perfil'), { target: { value: 'Nome local' } })
    current = changed; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('perfil mudou')
    expect(screen.getByLabelText('Nome do rascunho do perfil')).toHaveValue('Nome local')
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publicar versão do perfil' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('Nome do rascunho do perfil').closest('form')!)
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações locais e atualizar gestão' }))
    expect(await screen.findByLabelText('Nome do rascunho do perfil')).toHaveValue(changed.d.name)
    expect(screen.getByRole('button', { name: 'Publicar versão do perfil' })).toBeEnabled()
  })
  it('campos preservados não são expostos enquanto a permissão estiver negada', async () => {
    const fetcher = server(); const handler = fetcher.getMockImplementation()!
    let allowed = true
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => url.includes('/authorization?') ? json({ allowed }) : handler(url, init))
    await show()
    fireEvent.change(await screen.findByLabelText('Nome do rascunho do perfil'), { target: { value: 'Nome local protegido' } })
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByDisplayValue('Nome local protegido')).not.toBeInTheDocument()
    allowed = true; fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('Nome do rascunho do perfil')).toHaveValue('Nome local protegido')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('nome e escolhas não salvos não passam para outra denominação', async () => {
    const fetcher = server(); await show(route(), true)
    fireEvent.change(await screen.findByLabelText('Nome do rascunho do perfil'), { target: { value: 'Nome A' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'EVENT_VIEW' }))
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    expect(await screen.findByLabelText('Nome do rascunho do perfil')).toHaveValue(draft.name)
    expect(screen.getByRole('checkbox', { name: 'EVENT_VIEW' })).toBeChecked()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('erro e foco não apagam campos nem liberam repetição sem leitura explícita', async () => {
    const fetcher = server({ write: async () => new Response(null, { status: 500 }) })
    await show(); await save('Nome não confirmado')
    await screen.findByRole('alert')
    fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('Nome do rascunho do perfil')).toHaveValue('Nome não confirmado')
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados de gestão' }))
    expect(await screen.findByLabelText('Nome do rascunho do perfil')).toHaveValue('Nome não confirmado')
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('copia, edita, publica, desativa e reativa com leituras de reconciliação', async () => {
    const fetcher = server({ initialDraft: null })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Criar novo rascunho do perfil' }))
    await screen.findByText('Novo rascunho criado. As permissões efetivas não foram alteradas.')
    await save()
    await screen.findByText('Rascunho salvo. As permissões efetivas não foram alteradas.')
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar versão do perfil' }))
    expect(screen.getByRole('group', { name: 'Confirmar alteração do perfil' })).toHaveTextContent('Nome revisado')
    expect(writes(fetcher)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação do perfil' }))
    await screen.findByText('Versão publicada. O servidor passa a usá-la nas novas decisões de acesso.')
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desativação do perfil' }))
    expect(await screen.findByText('Estado atual: Desativado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reativar perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação do perfil' }))
    expect(await screen.findByText('Estado atual: Ativo')).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(5)
  })
  it('publicação de desativado não reativa automaticamente', async () => {
    const fetcher = server({ initialProfile: { ...profile, status: 'DISABLED' } })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar versão do perfil' }))
    expect(screen.getByRole('group', { name: 'Confirmar alteração do perfil' })).toHaveTextContent('continuará desativado')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação do perfil' }))
    expect(await screen.findByText('Versão publicada. O perfil continua desativado.')).toBeInTheDocument()
    expect(await screen.findByText('Estado atual: Desativado')).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('não perde permissões silenciosamente ao mudar escopo na criação', async () => {
    const fetcher = server()
    await show(`${root}/novo`)
    fireEvent.change(await screen.findByLabelText('Código do perfil'), { target: { value: 'NEW' } })
    fireEvent.change(screen.getByLabelText('Nome do rascunho do perfil'), { target: { value: 'Novo' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'EVENT_VIEW' }))
    fireEvent.change(screen.getByLabelText('Escopo do perfil'), { target: { value: 'DENOMINATION' } })
    expect(screen.getByRole('checkbox', { name: /EVENT_VIEW/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Criar perfil em rascunho' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /EVENT_VIEW/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'security:profile:manage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar perfil em rascunho' }))
    expect(await screen.findByText('Perfil criado em rascunho. Nenhuma atribuição foi criada.')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Abrir perfil criado' })).toBeInTheDocument()
    expect(JSON.parse(String(writes(fetcher)[0][1].body)).permissionCodes).toEqual(['security:profile:manage'])
  })
  it('código retirado exige remoção explícita e nome não salvo bloqueia publicação', async () => {
    server({ initialDraft: { ...draft, permissionCodes: ['EVENT_VIEW', 'RETIRED'] } })
    await show()
    expect(await screen.findByRole('checkbox', { name: /RETIRED/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /RETIRED/ }))
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Publicar versão do perfil' })).toBeDisabled()
  })
  it('nega sem buscar perfil/rascunho ou mostrar controles', async () => {
    const fetcher = server({ allowed: false })
    await show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/security/denominations/'))).toBe(false)
  })
  it('legado em revisão permanece sem comandos', async () => {
    server({ initialProfile: { ...profile, status: 'LEGACY_REVIEW' } })
    await show()
    expect(await screen.findByText(/exige tratamento administrativo específico/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar versão do perfil' })).not.toBeInTheDocument()
  })
  it.each([403, 404, 409, 422])('erro %s bloqueia repetição até atualizar e não reflete corpo', async status => {
    const fetcher = server({ write: async () => new Response('privado', { status }) })
    await show()
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize os dados')
    expect(screen.getByRole('alert')).not.toHaveTextContent('privado')
    expect(screen.getByRole('button', { name: 'Salvar rascunho do perfil' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados de gestão' }))
    expect(await screen.findByRole('button', { name: 'Salvar rascunho do perfil' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('rejeição do último acesso de recuperação não desativa o perfil na interface', async () => {
    const fetcher = server({ write: async () => json({ code: 'LAST_RECOVERY_ACCESS' }, 422) })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desativação do perfil' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('último acesso administrativo')
    expect(screen.getByText('Estado atual: Ativo')).toBeInTheDocument()
    expect(screen.queryByText('Perfil desativado. Versões e atribuições foram preservadas.')).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it.each([
    async () => { throw new TypeError('network') },
    async () => new Response(null, { status: 500 }),
    async () => json({ invalid: true }),
  ])('resultado incerto não produz sucesso nem retry', async write => {
    const fetcher = server({ write })
    await show()
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('resultado da alteração não pôde ser confirmado')
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('mantém trava de escrita quando o foco reconsulta permissão', async () => {
    let finish!: (value: Response) => void
    const fetcher = server({ write: () => new Promise<Response>(resolve => { finish = resolve }) })
    await show()
    const input = await screen.findByLabelText('Nome do rascunho do perfil')
    fireEvent.change(input, { target: { value: 'Revisado' } })
    fireEvent.submit(input.closest('form')!); fireEvent.submit(input.closest('form')!)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Salvar rascunho do perfil' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => { finish(json({ profileId, versionId: draftId, profileRevision: 7, versionRevision: 3, status: 'ACTIVE' })) })
    expect(await screen.findByText('Rascunho salvo. As permissões efetivas não foram alteradas.')).toBeInTheDocument()
  })
  it('resposta tardia de outra denominação não aparece', async () => {
    let finish!: (value: Response) => void
    const fetcher = server({ write: () => new Promise<Response>(resolve => { finish = resolve }) })
    await show(route(), true)
    await save()
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    await screen.findByLabelText('Nome do rascunho do perfil')
    await act(async () => { finish(json({ profileId, versionId: draftId, profileRevision: 7, versionRevision: 3, status: 'ACTIVE' })) })
    expect(screen.queryByText('Rascunho salvo. As permissões efetivas não foram alteradas.')).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('reconsulta autorização após comando e retira acesso perdido', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let revoked = false
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/authorization?') && revoked) return json({ allowed: false })
      const value = await handler(url, init)
      if (init?.method === 'POST' && url.endsWith('/deactivate')) revoked = true
      return value
    })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desativação do perfil' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('Nome do rascunho do perfil')).not.toBeInTheDocument()
  })
  it('401 na escrita encerra sessão real', async () => {
    server({ write: async () => new Response(null, { status: 401 }) })
    render(<MemoryRouter initialEntries={[route()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    await save()
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument()
  })
})
