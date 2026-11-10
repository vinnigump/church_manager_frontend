import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { AuthContext } from '../auth'
import RegistrationPage from './RegistrationPage'

const church = '10000000-0000-0000-0000-000000000003'
const personId = '10000000-0000-0000-0000-000000000002'
const account = { id: '10000000-0000-0000-0000-000000000001', personId, login: 'test', status: 'ACTIVE' }
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
let post: () => Promise<Response>
let allowed: boolean
let fetcher: ReturnType<typeof vi.fn>
beforeEach(async () => {
  allowed = true
  post = async () => response({ personId, fullName: 'Nome confirmado', churchId: church }, 201)
  fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/accounts/me')) return response(account)
    if (url.endsWith('/csrf')) return response({ headerName: 'X-CSRF-TOKEN', token: 'test-token' })
    if (url.includes('/accounts/me/authorization?')) return response({ allowed })
    if (url.endsWith('/people/administrative-registrations')) return post()
    throw new Error('Operação não esperada')
  })
  vi.stubGlobal('fetch', fetcher)
  await api.login('test', 'test-password')
})
function tree(currentAccount = account) {
  return <AuthContext.Provider value={{ account: currentAccount, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>
    <MemoryRouter initialEntries={[`/pessoas/igrejas/${church}/cadastrar`]}><Routes>
      <Route path="pessoas/igrejas/:churchId/cadastrar" element={<RegistrationPage/>}/>
    </Routes></MemoryRouter>
  </AuthContext.Provider>
}
async function fill() {
  await screen.findByLabelText('Nome completo (obrigatório)')
  fireEvent.change(screen.getByLabelText('Nome completo (obrigatório)'), { target: { value: 'Nome digitado' } })
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '+55 (11) 99999-9999' } })
}
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Cadastrar pessoa' })) }
describe('cadastro administrativo integrado', () => {
  it.each(['CPF', 'CIN_CPF'])('envia %s com CSRF e associação e confirma sem consultar ficha', async documentType => {
    render(tree()); await fill()
    fireEvent.change(screen.getByLabelText('Tipo de documento'), { target: { value: documentType } })
    submit(); submit()
    expect(await screen.findByText('Cadastro confirmado.')).toBeInTheDocument()
    expect(screen.getByText('Nome confirmado')).toBeInTheDocument()
    expect(screen.queryByText('Ficha da pessoa')).not.toBeInTheDocument()
    const calls = fetcher.mock.calls.filter(([url]) => url.endsWith('/people/administrative-registrations'))
    expect(calls).toHaveLength(1)
    const options = (calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(options.body as string)).toEqual({ fullName: 'Nome digitado', documentType, documentNumber: '529.982.247-25', email: null, phone: '+55 (11) 99999-9999', birthDate: null, churchId: church })
    expect(new Headers(options.headers).get('X-CSRF-TOKEN')).toBe('test-token')
    expect(options.credentials).toBe('same-origin')
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/people/'))).toHaveLength(1)
  })
  it.each([200, 400, 409, 500])('preserva edição sem sucesso ou ficha após HTTP %s', async status => {
    post = async () => response({ personId, fullName: 'Nome confirmado', churchId: church }, status)
    render(tree()); await fill(); submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    fireEvent.change(screen.getByLabelText('Nome completo (obrigatório)'), { target: { value: 'Correção' } })
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toHaveValue('Correção')
    expect(screen.queryByText('Cadastro confirmado.')).not.toBeInTheDocument()
  })
  it('nega formulário sem concessão', async () => {
    allowed = false; render(tree())
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument()
  })
  it.each([400, 409, 500])('preserva edição e trava ao recuperar foco após HTTP %s', async status => {
    post = async () => response({}, status)
    render(tree()); await fill(); submit()
    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText('Nome completo (obrigatório)'), { target: { value: 'Correção preservada' } })
    let authorize!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { authorize = resolve }))
    fireEvent(window, new Event('focus'))
    expect(screen.getByRole('status')).toHaveTextContent('Verificando permissão')
    expect(screen.queryByRole('textbox', { name: 'CPF' })).not.toBeInTheDocument()
    const field = screen.getByLabelText('CPF')
    expect(field.closest('[hidden]')).toHaveAttribute('inert')
    await act(async () => authorize(response({ allowed: true })))
    expect(screen.getByLabelText('CPF')).toBe(field)
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toHaveValue('Correção preservada')
    expect(screen.getByRole('button', { name: 'Cadastrar pessoa' })).toBeDisabled()
    // Even a programmatic submit cannot bypass the preserved submission lock.
    fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar pessoa' }).closest('form')!)
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/people/administrative-registrations'))).toHaveLength(1)
  })
  it('preserva rascunho ainda não enviado ao revalidar com acesso mantido', async () => {
    render(tree()); await fill()
    fireEvent(window, new Event('focus'))
    await screen.findByRole('button', { name: 'Cadastrar pessoa' })
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toHaveValue('Nome digitado')
    expect(screen.getByRole('button', { name: 'Cadastrar pessoa' })).toBeEnabled()
  })
  it('descarta rascunho revogado mesmo se o acesso for concedido novamente', async () => {
    render(tree()); await fill()
    allowed = false
    fireEvent(window, new Event('focus'))
    await screen.findByRole('alert')
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument()
    allowed = true
    fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('CPF')).toHaveValue('')
  })
  it('descarta rascunho e resposta pendente quando a sessão muda', async () => {
    let finish!: (value: Response) => void
    post = () => new Promise(resolve => { finish = resolve })
    const view = render(tree()); await fill(); submit()
    view.rerender(tree({ ...account }))
    expect(await screen.findByLabelText('CPF')).toHaveValue('')
    await act(async () => finish(response({ personId, fullName: 'Nome confirmado', churchId: church }, 201)))
    expect(screen.queryByText('Cadastro confirmado.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('CPF')).toHaveValue('')
  })
  it.each([{}, { personId, fullName: 'Nome confirmado', churchId: null }, { personId: 'inválido', fullName: 'Nome confirmado', churchId: church }])('rejeita confirmação 201 inválida %j', async data => {
    post = async () => response(data, 201)
    render(tree()); await fill(); submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.queryByText('Cadastro confirmado.')).not.toBeInTheDocument()
  })
  it('descarta rascunho quando escrita detecta revogação', async () => {
    post = async () => response({}, 403)
    render(tree()); await fill(); submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('descartados')
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument()
  })
  it('descarta confirmação pendente ao revalidar contexto e perder acesso', async () => {
    let finish!: (value: Response) => void
    post = () => new Promise(resolve => { finish = resolve })
    render(tree()); await fill(); submit()
    allowed = false
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    await act(async () => finish(response({ personId, fullName: 'Nome confirmado', churchId: church }, 201)))
    expect(screen.queryByText('Cadastro confirmado.')).not.toBeInTheDocument()
    expect(screen.queryByText('Nome confirmado')).not.toBeInTheDocument()
  })
})
