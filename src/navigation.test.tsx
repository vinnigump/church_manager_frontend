import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthContext, AuthProvider } from './auth'

const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'nome-privado', status: 'ACTIVE' }

describe('orientação após navegação', () => {
  it('usa título genérico em rota válida sem metadado, sem copiar URL ou dados da conta', () => {
    render(<MemoryRouter initialEntries={['/eventos/?contexto=privado']}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Eventos' })).toBeInTheDocument()
    expect(document.title).toBe('Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('orienta o foco e o título ao abrir a troca de senha e voltar à conta', () => {
    render(<MemoryRouter initialEntries={['/conta/']}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
    expect(document.title).toBe('Minha conta | Church Manager')
    const open = screen.getByRole('link', { name: 'Alterar minha senha' })
    open.focus()
    fireEvent.click(open)
    expect(document.title).toBe('Alterar minha senha | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    const back = screen.getByRole('link', { name: 'Voltar à minha conta' })
    back.focus()
    fireEvent.click(back)
    expect(document.title).toBe('Minha conta | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('atualiza foco e título ao navegar entre páginas autenticadas', () => {
    render(<MemoryRouter initialEntries={['/conta']}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
    expect(document.title).toBe('Minha conta | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    const link = screen.getByRole('link', { name: 'Eventos' })
    link.focus()
    fireEvent.click(link)
    expect(document.title).toBe('Eventos | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.title).not.toContain('nome-privado')
  })
  it('orienta para a tela de login após redirecionamento da guarda', () => {
    render(<MemoryRouter initialEntries={['/conta']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(document.title).toBe('Entrar | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
  })
  it('não usa caminho ou query desconhecidos no título e orienta o retorno', () => {
    render(<MemoryRouter initialEntries={['/private-token?secret=valor-privado']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(document.title).toBe('Página não encontrada | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.title).not.toMatch(/private-token|valor-privado/)
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao início' }))
    expect(document.title).toBe('Entrar | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
  })
  it('não rouba foco durante edição de formulário sem troca de rota', () => {
    render(<MemoryRouter initialEntries={['/entrar']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    const input = screen.getByLabelText('Login')
    input.focus()
    fireEvent.change(input, { target: { value: 'ana' } })
    expect(input).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })
})
