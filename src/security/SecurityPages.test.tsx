import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider } from '../auth'

const denomination = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const profileId = '00000000-0000-0000-0000-000000000003'
const versionId = '00000000-0000-0000-0000-000000000004'
const root = (id = denomination) => `/seguranca/denominacoes/${id}`
const profileRoute = (id = denomination) => `${root(id)}/perfis/${profileId}`
const versionRoute = `${profileRoute()}/versoes/${versionId}`
const profile = { id: profileId, code: 'READER', name: 'Consulta autorizada', scopeType: 'CHURCH', status: 'ENABLED', revision: 4, publishedVersionId: versionId }
const version = { id: versionId, versionNumber: 1, name: 'Consulta original', status: 'LEGACY_SNAPSHOT', revision: 0, createdAt: '2026-11-07T12:00:00Z', publishedAt: null }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const json = (value: unknown) => new Response(JSON.stringify(value))
function server(allowed = true) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.endsWith('/permission-catalog')) return json({ catalogVersion: 'sha256:test', permissions: [true, false].map((available, index) => ({ code: `PERMISSION_${index}`, introducedIn: 'events-1', resourceType: 'CHURCH', scopeTypes: ['CHURCH'], available })) })
    if (url.includes('/versions?')) return json({ items: [version], page: 0, size: 20, total: 1 })
    if (url.endsWith(`/versions/${versionId}`)) return json({ ...version, permissionCodes: ['RETIRED_CODE'] })
    if (url.endsWith(`/profiles/${profileId}`)) return json(profile)
    return json({ items: [profile], page: 0, size: 20, total: 1 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function Switch({ detail }: { detail: boolean }) { const navigate = useNavigate(); return <button onClick={() => navigate(detail ? profileRoute(other) : `${root(other)}/perfis`)}>Outra denominação</button> }
function show(path = `${root()}/perfis`, controls = false) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <Switch detail={path.includes(`/perfis/${profileId}`)}/>}<App/></AuthContext.Provider></MemoryRouter>)
}

describe('consultas administrativas denominacionais', () => {
  it('verifica security:profile:manage no contexto e navega perfil/histórico/detalhe', async () => {
    const fetcher = server()
    show()
    const link = await screen.findByRole('link', { name: 'Consultar perfil Consulta autorizada' })
    expect(document.title).toBe('Perfis de acesso | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    const query = new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams
    expect(Object.fromEntries(query)).toEqual({ permissionCode: 'security:profile:manage', resourceType: 'DENOMINATION', resourceId: denomination })
    fireEvent.click(link)
    fireEvent.click(await screen.findByRole('link', { name: 'Consultar versão 1' }))
    expect(await screen.findByText('RETIRED_CODE')).toBeInTheDocument()
    expect(screen.getByText(/Não representa autorização efetiva da conta/)).toBeInTheDocument()
    expect(screen.getByText('Estado: Registro legado')).toBeInTheDocument()
    expect(document.title).toBe('Versão do perfil | Church Manager')
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao perfil' }))
    expect(await screen.findByRole('heading', { name: 'Consulta autorizada' })).toBeInTheDocument()
    expect(fetcher.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true)
  })
  it('distingue catálogo disponível de concessões e mostra indisponíveis', async () => {
    server()
    show(`${root()}/permissoes`)
    expect(await screen.findByText('PERMISSION_0')).toBeInTheDocument()
    expect(screen.getByText('PERMISSION_1')).toBeInTheDocument()
    expect(screen.getByText('Indisponível no catálogo')).toBeInTheDocument()
    expect(screen.getByText(/não concede permissão à sua conta/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /atribuir|criar|publicar/i })).not.toBeInTheDocument()
  })
  it.each([true, false])('acesso vindo do catálogo denominacional exige permissão própria %s', async allowed => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) {
        const code = new URL(url, 'https://example.test').searchParams.get('permissionCode')
        return json({ allowed: code === 'EVENT_TEMPLATE_MANAGE' || (allowed && code === 'security:profile:manage') })
      }
      if (url.includes('/types?')) return json({ items: [], page: 0, size: 20, total: 0 })
      return handler(url)
    })
    show(`/eventos/denominacoes/${denomination}/catalogo`)
    await screen.findByText('Nenhum template no catálogo.')
    if (allowed) expect(await screen.findByRole('link', { name: 'Perfis de acesso da denominação' })).toHaveAttribute('href', `${root()}/perfis`)
    else expect(screen.queryByRole('link', { name: 'Perfis de acesso da denominação' })).not.toBeInTheDocument()
  })
  it.each([`${root()}/perfis`, `${root()}/permissoes`, profileRoute(), versionRoute])('nega %s sem buscar dados', async path => {
    const fetcher = server(false)
    show(path)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('navigation', { name: 'Segurança da denominação' })).not.toBeInTheDocument()
  })
  it.each([`${root('invalid')}/perfis`, `${root()}/perfis/invalid`, `${profileRoute()}/versoes/invalid`])('rota inválida %s não consulta', path => {
    const fetcher = server()
    show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('acesso administrativo é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('visitante é enviado ao login e retorna ao recurso após autenticar', async () => {
    const fetcher = server()
    render(<MemoryRouter initialEntries={[versionRoute]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(await screen.findByText('RETIRED_CODE')).toBeInTheDocument()
  })
  it('perfis vazios não inventam opções e desabilitam paginação seguinte', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.includes('/profiles?') ? json({ items: [], page: 0, size: 20, total: 0 }) : handler(url))
    show()
    expect(await screen.findByText('Nenhum perfil nesta página.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })
  it('pagina ocultando os registros anteriores durante o carregamento', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let finish!: (value: Response) => void
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes('/profiles?page=1')) return new Promise<Response>(resolve => { finish = resolve })
      if (url.includes('/profiles?')) return json({ items: [profile], page: 0, size: 20, total: 21 })
      return handler(url)
    })
    show()
    await screen.findByRole('heading', { name: profile.name })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.queryByRole('heading', { name: profile.name })).not.toBeInTheDocument()
    await act(async () => { finish(json({ items: [{ ...profile, name: 'Outro perfil' }], page: 1, size: 20, total: 21 })) })
    expect(screen.getByRole('heading', { name: 'Outro perfil' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })
  it.each([403, 404, 409, 422, 500])('erro %s no perfil não expõe corpo ou histórico', async status => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.endsWith(`/profiles/${profileId}`) ? new Response('privado', { status }) : handler(url))
    show(profileRoute())
    expect(await screen.findByRole('alert')).not.toHaveTextContent('privado')
    expect(screen.queryByRole('region', { name: 'Histórico de versões' })).not.toBeInTheDocument()
  })
  it('reconsulta erro de rede sem simular dados', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let fail = true
    fetcher.mockImplementation(async (url: string) => { if (url.includes('/profiles?') && fail) { fail = false; throw new TypeError('network') } return handler(url) })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar perfis' }))
    expect(await screen.findByRole('heading', { name: profile.name })).toBeInTheDocument()
  })
  it('retira dados quando a permissão é revogada ao retomar foco', async () => {
    const fetcher = server()
    show()
    await screen.findByRole('heading', { name: profile.name })
    fetcher.mockImplementation(async () => json({ allowed: false }))
    fireEvent(window, new Event('focus'))
    expect(screen.queryByRole('heading', { name: profile.name })).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
  })
  it('descarta resposta de outra denominação mesmo se o transporte ignorar abort', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let finish!: (value: Response) => void
    fetcher.mockImplementation(async (url: string) => url.includes(`/denominations/${denomination}/profiles?`) ? new Promise<Response>(resolve => { finish = resolve }) : handler(url))
    show(`${root()}/perfis`, true)
    await screen.findByText('Carregando perfis…')
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    await screen.findByRole('heading', { name: profile.name })
    await act(async () => { finish(json({ items: [{ ...profile, name: 'Registro antigo' }], page: 0, size: 20, total: 1 })) })
    expect(screen.queryByText('Registro antigo')).not.toBeInTheDocument()
  })
  it('401 em consulta de versão encerra sessão', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.endsWith(`/versions/${versionId}`) ? new Response(null, { status: 401 }) : handler(url))
    render(<MemoryRouter initialEntries={[versionRoute]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
})
