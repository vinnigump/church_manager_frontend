import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext, AuthProvider } from '../auth'
import { changeTemplate, type EventTemplate, type TemplateCommand } from './template-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const typeId = '00000000-0000-0000-0000-000000000003'
const draft = { id: '00000000-0000-0000-0000-000000000004', number: 2, name: 'Nome salvo', status: 'DRAFT' as const, revision: 3, createdAt: '2026-11-07T12:00:00Z', publishedAt: null }
const published: EventTemplate = { id: typeId, status: 'PUBLISHED', revision: 7, publishedVersionId: other, draft: null }
const editing: EventTemplate = { ...published, draft }
const account = { id: 'a', personId: 'p', login: 'ana', status: 'ACTIVE' }
const route = (id = denomination) => `/eventos/denominacoes/${id}/templates/${typeId}`
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
afterEach(() => api.clear())

function server(initial: EventTemplate = editing, write?: (url: string, init: RequestInit) => Promise<Response>, allowed = true) {
  let current = structuredClone(initial)
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed })
    if (init.method === 'POST' || init.method === 'PUT') {
      if (write) return write(url, init)
      const body = init.body ? JSON.parse(String(init.body)) : undefined
      const expected = init.method === 'PUT' ? current.draft?.revision : current.revision
      if (new Headers(init.headers).get('X-Expected-Revision') !== String(expected)) return json({}, 409)
      if (url.endsWith('/draft')) current = init.method === 'POST'
        ? { ...current, revision: current.revision + 1, draft: structuredClone(draft) }
        : { ...current, draft: { ...current.draft!, name: body.name, revision: current.draft!.revision + 1 } }
      if (url.endsWith('/publish')) {
        const pending = current.draft
        if (!pending || body.draftVersionId !== pending.id || body.expectedDraftRevision !== pending.revision) return json({}, 409)
        current = { ...current, status: 'PUBLISHED', revision: current.revision + 1, publishedVersionId: pending.id, draft: null }
      }
      if (url.endsWith('/discontinue')) current = { ...current, status: 'DISCONTINUED', revision: current.revision + 1 }
      return json(current)
    }
    if (url.includes('/versions?')) return json({ items: [], page: 0, size: 20, total: 0 })
    return json(current)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init.method))
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra denominação</button> }
async function show(controls = false) {
  await api.login('ana', 'test-password')
  return render(<MemoryRouter initialEntries={[route()]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <Switch/>}<App/></AuthContext.Provider></MemoryRouter>)
}
async function edit(name: string) {
  const input = await screen.findByLabelText('Nome do rascunho')
  fireEvent.change(input, { target: { value: name } })
  fireEvent.submit(input.closest('form')!)
}

describe('comandos publicados EVT-006', () => {
  it.each<TemplateCommand>(['createDraft', 'editDraft', 'publish', 'discontinue'])('envia revisões e payload exatos em %s', async command => {
    const before = command === 'createDraft' ? published : editing
    const fetcher = server(before)
    await api.login('ana', 'test-password')
    await changeTemplate(denomination, before, command, '  Novo nome  ')
    const [url, init] = writes(fetcher)[0]
    const suffix = { createDraft: 'draft', editDraft: 'draft', publish: 'publish', discontinue: 'discontinue' }[command]
    expect(url).toBe(`/api/v1/events/denominations/${denomination}/types/${typeId}/${suffix}`)
    expect(init.method).toBe(command === 'editDraft' ? 'PUT' : 'POST')
    const headers = new Headers(init.headers)
    expect(headers.get('X-Expected-Revision')).toBe(String(command === 'editDraft' ? draft.revision : published.revision))
    expect(headers.has('If-Match')).toBe(false)
    expect(headers.get('X-CSRF-TOKEN')).toBe('test')
    expect(headers.get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
    expect(init.body ? JSON.parse(String(init.body)) : undefined).toEqual(command === 'editDraft' ? { name: 'Novo nome' } : command === 'publish' ? { draftVersionId: draft.id, expectedDraftRevision: draft.revision } : undefined)
  })
  it('não envia comando sem CSRF', async () => {
    const fetcher = server()
    await expect(changeTemplate(denomination, editing, 'publish', undefined, undefined, new ApiClient())).rejects.toMatchObject({ status: 403 })
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each<TemplateCommand>(['createDraft', 'editDraft', 'publish', 'discontinue'])('rejeita %s em template descontinuado antes da rede', async command => {
    const fetcher = server()
    await expect(changeTemplate(denomination, { ...editing, status: 'DISCONTINUED' }, command, 'Nome')).rejects.toThrow('Atualize')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each(['', ' ', 'a'.repeat(181)])('rejeita nome inválido %j', async name => {
    const fetcher = server()
    await expect(changeTemplate(denomination, editing, 'editDraft', name)).rejects.toThrow('180 caracteres')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('rejeita criação duplicada e publicação sem rascunho', async () => {
    const fetcher = server()
    await expect(changeTemplate(denomination, editing, 'createDraft')).rejects.toThrow()
    await expect(changeTemplate(denomination, published, 'publish')).rejects.toThrow()
    await expect(changeTemplate(denomination, { ...editing, revision: -1 }, 'publish')).rejects.toThrow()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([
    { ...published, id: denomination },
    { ...published, publishedVersionId: other },
    { ...editing, status: 'PUBLISHED' },
  ])('não confirma publicação com resposta incompatível %j', async value => {
    server(editing, async () => json(value))
    await api.login('ana', 'test-password')
    await expect(changeTemplate(denomination, editing, 'publish')).rejects.toThrow()
  })
})

describe('gerência autorizada de versões', () => {
  it('cria rascunho, edita, confirma publicação e descontinuação', async () => {
    const fetcher = server(published)
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Criar novo rascunho' }))
    expect(await screen.findByText('Rascunho criado.')).toBeInTheDocument()
    await edit('Novo nome')
    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Nome do rascunho')).toHaveValue('Novo nome'))
    fireEvent.click(screen.getByRole('button', { name: 'Publicar versão' }))
    expect(writes(fetcher)).toHaveLength(2)
    expect(screen.getByRole('group', { name: 'Confirmar publicação' })).toHaveTextContent('versão 2: Novo nome')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
    expect(await screen.findByText(/Versão publicada. Ocorrências anteriores/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Descontinuar template' }))
    expect(screen.getByRole('group', { name: 'Confirmar descontinuação' })).toHaveTextContent('não pode ser revertida')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descontinuação' }))
    expect(await screen.findByText('Estado do template: Descontinuado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar novo rascunho' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(4)
  })
  it('não publica alterações de nome ainda não salvas', async () => {
    const fetcher = server()
    await show()
    fireEvent.change(await screen.findByLabelText('Nome do rascunho'), { target: { value: 'Não salvo' } })
    expect(screen.getByRole('button', { name: 'Publicar versão' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('cancela confirmação sem enviar comando', async () => {
    const fetcher = server()
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar versão' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alteração' }))
    expect(screen.queryByRole('group', { name: 'Confirmar publicação' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('nega acesso sem buscar template ou mostrar controles', async () => {
    const fetcher = server(editing, undefined, false)
    await show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('Nome do rascunho')).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('401 na escrita encerra a sessão sem anunciar sucesso', async () => {
    server(editing, async () => new Response(null, { status: 401 }))
    render(<MemoryRouter initialEntries={[route()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    await edit('Novo nome')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByText('Rascunho salvo.')).not.toBeInTheDocument()
  })
  it.each([400, 403, 404, 409, 422])('erro %s exige atualização antes de nova escrita e não expõe corpo', async status => {
    const fetcher = server(editing, async () => new Response('dado privado', { status }))
    await show()
    await edit('Novo nome')
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize o template')
    expect(screen.getByRole('alert')).not.toHaveTextContent('dado privado')
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar template' }))
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it.each([
    async () => { throw new TypeError('network') },
    async () => new Response(null, { status: 500 }),
    async () => json({ invalid: true }),
  ])('resultado incerto não vira sucesso nem retry automático', async failure => {
    const fetcher = server(editing, failure)
    await show()
    await edit('Novo nome')
    expect(await screen.findByRole('alert')).toHaveTextContent('resultado da alteração não pôde ser confirmado')
    expect(screen.queryByText('Rascunho salvo.')).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('impede duplo envio inclusive durante reconsulta por foco', async () => {
    let finish!: (value: Response) => void
    const fetcher = server(editing, () => new Promise<Response>(resolve => { finish = resolve }))
    await show()
    const input = await screen.findByLabelText('Nome do rascunho')
    fireEvent.change(input, { target: { value: 'Novo nome' } })
    fireEvent.submit(input.closest('form')!)
    fireEvent.submit(input.closest('form')!)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => { finish(json({ ...editing, draft: { ...draft, name: 'Novo nome', revision: 4 } })) })
    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument()
  })
  it('ignora escrita atrasada ao trocar denominação', async () => {
    let finish!: (value: Response) => void
    const fetcher = server(editing, () => new Promise<Response>(resolve => { finish = resolve }))
    await show(true)
    await edit('Novo nome')
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    await screen.findByLabelText('Nome do rascunho')
    await act(async () => { finish(json({ ...editing, draft: { ...draft, name: 'Novo nome', revision: 4 } })) })
    expect(screen.queryByText('Rascunho salvo.')).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
})
