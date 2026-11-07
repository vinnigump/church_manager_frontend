import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { createLocalType, setLocalTypeEnabled } from './catalog-api'

const churchId = '00000000-0000-0000-0000-000000000001'
const local = { id: '00000000-0000-0000-0000-000000000002', scopeType: 'CHURCH' as const, name: 'Encontro local', mandatory: false, enabled: true }
const mandatory = { ...local, id: '00000000-0000-0000-0000-000000000003', scopeType: 'DENOMINATION' as const, name: 'Template obrigatório', mandatory: true }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
afterEach(() => api.clear())

function server({ create = true, edit = true, post }: { create?: boolean; edit?: boolean; post?: () => Promise<Response> } = {}) {
  let items = [{ ...local }, { ...mandatory }]
  const fetcher = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' })
    if (url.includes('/authorization?')) {
      const code = new URL(url, 'https://example.test').searchParams.get('permissionCode')
      return json({ allowed: code === 'EVENT_VIEW' || (code === 'EVENT_CREATE' && create) || (code === 'EVENT_EDIT' && edit) })
    }
    if (init?.method === 'POST') {
      if (post) return post()
      const created = { ...local, id: '00000000-0000-0000-0000-000000000004', name: JSON.parse(String(init.body)).name }
      items = [...items, created]
      return json(created, 201)
    }
    if (init?.method === 'PUT') {
      const enabled = JSON.parse(String(init.body)).enabled
      items = items.map(item => item.id === local.id ? { ...item, enabled } : item)
      return json({ ...local, enabled })
    }
    const visible = items.filter(item => item.enabled)
    return json({ items: visible, page: 0, size: 20, total: visible.length })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function SwitchChurch() { const navigate = useNavigate(); return <button onClick={() => navigate('/eventos/igrejas/00000000-0000-0000-0000-000000000005/catalogo')}>Outra igreja</button> }
async function show(controls = false) {
  await api.login('ana', 'test-password')
  return render(<MemoryRouter initialEntries={[`/eventos/igrejas/${churchId}/catalogo`]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <SwitchChurch/>}<App/></AuthContext.Provider></MemoryRouter>)
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(call => ['POST', 'PUT'].includes(call[1]?.method || ''))
async function submit(name: string) {
  const input = await screen.findByLabelText('Nome do tipo de evento')
  fireEvent.change(input, { target: { value: name } })
  fireEvent.submit(input.closest('form')!)
}

describe('contratos de escrita local', () => {
  it('cria com name somente e Basic/CSRF/cookie existentes', async () => {
    const fetcher = server()
    await api.login('ana', 'test-password')
    const created = await createLocalType(churchId, '  Novo encontro  ')
    expect(created.name).toBe('Novo encontro')
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/events/churches/${churchId}/types`)
    expect(JSON.parse(init.body)).toEqual({ name: 'Novo encontro' })
    expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('csrf-test')
    expect(new Headers(init.headers).get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(init.credentials).toBe('same-origin')
  })
  it('altera por igreja+tipo com enabled somente', async () => {
    const fetcher = server()
    await api.login('ana', 'test-password')
    expect((await setLocalTypeEnabled(churchId, local, false)).enabled).toBe(false)
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/events/churches/${churchId}/types/${local.id}/enabled`)
    expect(JSON.parse(init.body)).toEqual({ enabled: false })
  })
  it('não envia escrita sem CSRF', async () => {
    const fetcher = server()
    await expect(createLocalType(churchId, 'Teste', undefined, new ApiClient())).rejects.toMatchObject({ status: 403 })
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each(['', ' ', 'a'.repeat(181)])('rejeita nome inválido antes de escrever', async name => {
    const fetcher = server()
    await expect(createLocalType(churchId, name)).rejects.toThrow('180 caracteres')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('nega alteração de template obrigatório mesmo que chamada diretamente', async () => {
    const fetcher = server()
    await expect(setLocalTypeEnabled(churchId, mandatory, false)).rejects.toThrow('tipos locais')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('rejeita resposta de outro tipo em vez de confirmar sucesso', async () => {
    const fetcher = server()
    await api.login('ana', 'test-password')
    fetcher.mockImplementationOnce(async () => json({ ...local, id: mandatory.id, enabled: false }))
    await expect(setLocalTypeEnabled(churchId, local, false)).rejects.toThrow('confirmar a alteração')
  })
})

describe('gestão local na tela de catálogo', () => {
  it('EVENT_VIEW não revela ações CREATE/EDIT negadas', async () => {
    server({ create: false, edit: false })
    await show()
    await screen.findByText(local.name)
    expect(screen.queryByLabelText('Nome do tipo de evento')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Desabilitar ${local.name}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('valida formulário, cria somente após resposta e atualiza consulta', async () => {
    const fetcher = server()
    await show()
    await submit('   ')
    expect(screen.getByRole('alert')).toHaveTextContent('180 caracteres')
    expect(writes(fetcher)).toHaveLength(0)
    await submit('Novo encontro')
    expect(await screen.findByText(/Tipo local criado/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Novo encontro' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do tipo de evento')).toHaveValue('')
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('bloqueia duplo envio mesmo durante reconsulta de foco', async () => {
    let finish!: (response: Response) => void
    const fetcher = server({ post: () => new Promise<Response>(resolve => { finish = resolve }) })
    await show()
    const input = await screen.findByLabelText('Nome do tipo de evento')
    fireEvent.change(input, { target: { value: 'Novo encontro' } })
    fireEvent.submit(input.closest('form')!)
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => { finish(json({ ...local, name: 'Novo encontro' }, 201)) })
    expect(await screen.findByText(/Tipo local criado/)).toBeInTheDocument()
  })
  it('confirma desabilitação e permite reverter último tipo sem apagar ocorrências', async () => {
    const fetcher = server()
    await show()
    fireEvent.click(await screen.findByRole('button', { name: `Desabilitar ${local.name}` }))
    expect(writes(fetcher)).toHaveLength(0)
    expect(screen.getByText(/sem apagar ocorrências ou inscrições/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desabilitação' }))
    const last = await screen.findByRole('region', { name: 'Último tipo desabilitado' })
    expect(await within(last).findByRole('button', { name: `Habilitar ${local.name}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Desabilitar ${mandatory.name}` })).not.toBeInTheDocument()
    fireEvent.click(within(last).getByRole('button', { name: `Habilitar ${local.name}` }))
    fireEvent.click(within(last).getByRole('button', { name: 'Confirmar habilitação' }))
    expect(await screen.findByText(new RegExp(`Tipo local habilitado. ${local.name}`))).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Último tipo desabilitado' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(2)
  })
  it('cancelar confirmação não faz PUT', async () => {
    const fetcher = server()
    await show()
    fireEvent.click(await screen.findByRole('button', { name: `Desabilitar ${local.name}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alteração' }))
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([403, 404, 409, 422])('erro de escrita %s não gera sucesso nem expõe corpo privado', async status => {
    const fetcher = server({ post: async () => new Response('segredo privado', { status }) })
    await show()
    await submit('Novo encontro')
    expect(await screen.findByRole('alert')).not.toHaveTextContent('segredo privado')
    expect(screen.queryByText(/Tipo local criado/)).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('falha de rede em criação é resultado incerto, sem retry automático', async () => {
    const fetcher = server({ post: async () => { throw new TypeError('network') } })
    await show()
    await submit('Novo encontro')
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulte o catálogo antes de enviar novamente')
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    await screen.findByText(local.name)
    expect(writes(fetcher)).toHaveLength(1)
  })
  it.each([
    () => Promise.resolve(new Response('falha privada', { status: 500 })),
    () => Promise.resolve(json({ invalid: true }, 201)),
  ])('500 ou resposta inválida não são confirmação de criação', async post => {
    const fetcher = server({ post })
    await show()
    await submit('Novo encontro')
    expect(await screen.findByRole('alert')).toHaveTextContent('resultado da alteração não pôde ser confirmado')
    expect(screen.queryByText(/Tipo local criado/)).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('resposta de escrita antiga não aparece na igreja nova', async () => {
    let finish!: (response: Response) => void
    const fetcher = server({ post: () => new Promise<Response>(resolve => { finish = resolve }) })
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/churches/00000000-0000-0000-0000-000000000005/') && !init?.method) return json({ items: [{ ...local, name: 'Catálogo B' }], page: 0, size: 20, total: 1 })
      return handler(url, init)
    })
    await show(true)
    await submit('Segredo A')
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' }))
    await screen.findByRole('heading', { name: 'Catálogo B' })
    await act(async () => { finish(json({ ...local, name: 'Segredo A' }, 201)) })
    expect(screen.queryByText(/Segredo A|Tipo local criado/)).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
})
