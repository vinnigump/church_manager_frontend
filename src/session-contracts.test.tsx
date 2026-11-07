import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { ApiClient } from './api'
import { AuthProvider } from './auth'

const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'test-token' }
const message = 'Não foi possível validar os dados da sessão. Entre novamente.'
function server(accountValue: unknown = account, csrfValue: unknown = csrf) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/accounts/me') ? accountValue : url.endsWith('/csrf') ? csrfValue : {})))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('validação das respostas que estabelecem a sessão', () => {
  it('projeta somente campos da conta e mantém CSRF com nome retornado pelo servidor', async () => {
    const fetcher = server({ ...account, grants: ['inventado'], secret: 'privado' }, { headerName: 'X-Custom-CSRF', token: 'opaque-token', secret: 'privado' })
    const client = new ApiClient()
    expect(await client.login('ana', 'test-password')).toEqual(account)
    await client.request('/people', { method: 'POST' })
    const headers = new Headers(fetcher.mock.calls[2][1].headers)
    expect(headers.get('X-Custom-CSRF')).toBe('opaque-token')
    expect(headers.get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    expect(fetcher.mock.calls[2][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })
  it.each([
    null, [], {}, { ...account, id: 'invalid' }, { ...account, personId: 'invalid' },
    { ...account, login: 123 }, { ...account, login: 'a'.repeat(255) },
    { ...account, status: undefined }, { ...account, status: 'a'.repeat(21) },
  ])('não inicia sessão com conta incompatível %j', async value => {
    const fetcher = server(value)
    const client = new ApiClient()
    await expect(client.login('ana', 'test-password')).rejects.toThrow(message)
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/csrf'))).toBe(false)
    await client.request('/probe')
    expect(new Headers(fetcher.mock.calls[1][1].headers).has('Authorization')).toBe(false)
    await expect(client.request('/people', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
  })
  it.each([
    null, {}, { headerName: 'X-CSRF-TOKEN' }, { headerName: '', token: 'test' },
    { headerName: 'X-CSRF-TOKEN', token: '' }, { headerName: 'X-CSRF-TOKEN', token: ' private ' },
    { headerName: 'Invalid Header', token: 'test' }, { headerName: 'X-CSRF-TOKEN', token: 'line\r\nsecret' },
    { headerName: 'Authorization', token: 'private' }, { headerName: 'Cookie', token: 'private' },
  ])('rejeita CSRF incompatível sem persistir credenciais %j', async value => {
    const fetcher = server(account, value)
    const client = new ApiClient()
    await expect(client.login('ana', 'test-password')).rejects.toThrow(message)
    await expect(client.request('/people', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
    expect(fetcher).toHaveBeenCalledTimes(2)
    await client.request('/probe')
    expect(new Headers(fetcher.mock.calls[2][1].headers).has('Authorization')).toBe(false)
  })
  it('não converte status sem enum publicado em concessão de permissão', async () => {
    server({ ...account, status: 'FUTURE_STATE' })
    expect((await new ApiClient().login('ana', 'test-password')).status).toBe('FUTURE_STATE')
  })
  it.each([true, false])('interface não autentica com resposta inválida de conta=%s', async badAccount => {
    server(badAccount ? {} : account, badAccount ? csrf : {})
    render(<MemoryRouter initialEntries={['/conta']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Conectado como ana.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveValue('')
  })
})
