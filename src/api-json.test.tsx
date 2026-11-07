import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { ApiClient } from './api'
import { AuthProvider } from './auth'

const account = { id: 'a', personId: 'p', login: 'ana', status: 'ACTIVE' }
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'test' }
const json = (value: unknown) => new Response(JSON.stringify(value))
const invalidMessage = 'Não foi possível validar a resposta do servidor. Tente novamente.'

describe('falhas de leitura do corpo HTTP', () => {
  it.each(['dado-privado-na-resposta', '', '{"invalid":'])('normaliza JSON inválido sem refletir corpo %j', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    await expect(new ApiClient().request('/accounts/me')).rejects.toThrow(invalidMessage)
  })
  it('preserva respostas 204 sem tentar ler JSON', async () => {
    const response = new Response(null, { status: 204 })
    const read = vi.spyOn(response, 'json')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(new ApiClient().request('/accounts/me')).resolves.toBeUndefined()
    expect(read).not.toHaveBeenCalled()
  })
  it.each(['/accounts/me', '/csrf'])('login não mostra corpo inválido de %s e permanece desconectado', async brokenPath => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url.endsWith(brokenPath)
      ? new Response('dado-privado-na-resposta') : json(url.endsWith('/csrf') ? csrf : account)))
    render(<MemoryRouter initialEntries={['/entrar']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(invalidMessage)
    expect(screen.getByRole('alert')).not.toHaveTextContent('dado-privado')
    expect(screen.queryByText('Conectado como ana.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveValue('')
  })
  it('falha de parse no login limpa Basic e impede escrita sem CSRF', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('dado-privado')).mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await expect(client.login('ana', 'test-password')).rejects.toThrow(invalidMessage)
    await client.request('/accounts/me')
    expect(new Headers(fetcher.mock.calls[1][1].headers).has('Authorization')).toBe(false)
    await expect(client.request('/people', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('erro de corpo de uma escrita não repete a operação automaticamente', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => init?.method === 'POST'
      ? new Response('dado-privado') : json(url.endsWith('/csrf') ? csrf : account))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await client.login('ana', 'test-password')
    await expect(client.request('/people', { method: 'POST' })).rejects.toThrow(invalidMessage)
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
  it('corpo antigo malformado não limpa credenciais de login posterior', async () => {
    let started!: () => void
    const reading = new Promise<void>(resolve => { started = resolve })
    let fail!: (error: Error) => void
    const oldResponse = new Response('{}')
    vi.spyOn(oldResponse, 'json').mockImplementation(() => { started(); return new Promise((_, reject) => { fail = reject }) })
    const fetcher = vi.fn().mockResolvedValueOnce(oldResponse).mockImplementation(async (url: string) => json(url.endsWith('/csrf') ? csrf : account))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    const old = client.login('ana', 'old-password')
    const rejected = expect(old).rejects.toThrow('sessão encerrada')
    await reading
    await client.login('bia', 'new-password')
    fail(new SyntaxError('dado-privado'))
    await rejected
    await client.request('/people', { method: 'POST' })
    const headers = new Headers(fetcher.mock.calls[3][1].headers)
    expect(headers.get('Authorization')).toBe(`Basic ${btoa('bia:new-password')}`)
    expect(headers.get('X-CSRF-TOKEN')).toBe('test')
  })
})
