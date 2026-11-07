import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider } from '../auth'

const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
function History() { const navigate = useNavigate(); return <><button onClick={() => navigate(-1)}>Voltar no histórico</button><button onClick={() => navigate(1)}>Avançar no histórico</button></> }
function show(path = '/', history = false) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{history && <History/>}<App/></AuthContext.Provider></MemoryRouter>)
}
describe('shell RIO e navegação real', () => {
  it('mantém uma navegação com destinos reais e ícones decorativos', () => {
    show()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/', '/eventos', '/conta'])
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1)
    expect(within(nav).queryByRole('link', { name: /Membros|Administração|Igreja/ })).not.toBeInTheDocument()
    expect(nav.querySelectorAll('svg[aria-hidden="true"][focusable="false"]')).toHaveLength(3)
    expect(screen.getByRole('img', { name: 'RIO' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })
  it('estado ativo não marca Início em outras páginas e preserva foco/título', () => {
    show()
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('link', { name: 'Minha conta' }))
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Minha conta' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.title).toBe('Minha conta | Church Manager')
  })
  it('destino de conta permanece ativo na troca de senha', () => {
    show('/conta/senha')
    expect(screen.getByRole('link', { name: 'Minha conta' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Eventos' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('heading', { name: 'Alterar minha senha' })).toBeInTheDocument()
  })
  it('voltar e avançar preservam rota, estado ativo e foco', () => {
    show('/conta', true)
    fireEvent.click(screen.getByRole('link', { name: 'Eventos' }))
    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar no histórico' }))
    expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Avançar no histórico' }))
    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Eventos | Church Manager')
  })
  it('visitante acessa o login na Home sem navegação interna nem saída', () => {
    render(<MemoryRouter initialEntries={['/']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'Eventos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Minha conta' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
  })
  it('rota desconhecida não marca destino incorreto e preserva skip link', () => {
    show('/inexistente')
    expect(screen.getByRole('navigation', { name: 'Principal' }).querySelector('[aria-current]')).toBeNull()
    const skip = screen.getByRole('link', { name: 'Ir para o conteúdo' })
    expect(skip).toHaveAttribute('href', '#conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
    expect(document.title).toBe('Página não encontrada | Church Manager')
  })
  it('layout não concede gestão administrativa por autenticação', () => {
    show('/admin')
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso indisponível')
    expect(screen.queryByRole('link', { name: 'Administração' })).not.toBeInTheDocument()
  })
})
