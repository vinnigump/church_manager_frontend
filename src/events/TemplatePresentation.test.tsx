import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext } from '../auth'

const denomination = '00000000-0000-0000-0000-000000000001', id = '00000000-0000-0000-0000-000000000002', publishedId = '00000000-0000-0000-0000-000000000003'
const account = { id, personId: id, login: 'ana', status: 'ACTIVE' }
const draft = { id: '00000000-0000-0000-0000-000000000004', number: 2, name: 'N'.repeat(180), status: 'DRAFT', revision: 1, createdAt: '2032-01-01T12:00:00Z', publishedAt: null }
function show(status = 'PUBLISHED', hasDraft = true, reference: string | null = publishedId) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('/authorization?') ? { allowed: true } : url.includes('/versions?') ? { items: [], page: 0, size: 20, total: 0 } : { id, status, revision: 7, publishedVersionId: reference, draft: hasDraft ? draft : null })))
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={[`/eventos/denominacoes/${denomination}/templates/${id}`]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
  return fetcher
}
describe('D1/D2/D4 - estrutura acessível dos templates', () => {
  it('ordena identificação, rascunho, histórico e disponibilidade; referência não depende da página de histórico', async () => {
    show(); const identification = await screen.findByRole('region', { name: 'Identificação do template' })
    expect(within(identification).getByText(publishedId)).toBeInTheDocument()
    const pending = screen.getByRole('region', { name: 'Rascunho atual' }), history = screen.getByRole('region', { name: 'Histórico de versões' }), availability = screen.getByRole('region', { name: 'Disponibilidade para novas ocorrências' })
    for (const [a, b] of [[identification, pending], [pending, history], [history, availability]]) expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(pending).getByRole('heading', { name: `Versão 2 · ${draft.name}` })).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma versão no histórico.')).toBeInTheDocument()
    expect(within(availability).getByText(/não pode ser revertida/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Gerenciar template' })).queryByRole('button', { name: 'Descontinuar template' })).not.toBeInTheDocument()
  })
  it.each([
    ['DRAFT', true, null, 'Estado do template: Rascunho'],
    ['PUBLISHED', false, publishedId, 'Estado do template: Publicado'],
    ['PUBLISHED', true, publishedId, 'Estado do template: Publicado'],
    ['DISCONTINUED', false, publishedId, 'Estado do template: Descontinuado'],
  ] as const)('estado %s com draft=%s preserva regras reais', async (status, hasDraft, reference, label) => {
    show(status, hasDraft, reference); expect(await screen.findByText(label)).toBeInTheDocument()
    if (reference === null) expect(screen.getByText('Sem versão publicada de referência.')).toBeInTheDocument()
    if (status === 'DISCONTINUED') {
      expect(screen.getByText(/não está disponível para novas ocorrências/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Descontinuar template|Publicar versão|Criar novo rascunho|Reativar/ })).not.toBeInTheDocument()
    } else if (!hasDraft) expect(screen.getByRole('button', { name: 'Criar novo rascunho' })).toBeEnabled()
  })
  it.each(['Publicar versão', 'Descontinuar template'])('cancelar %s devolve foco sem escrita e preserva edição', async action => {
    const fetcher = show(); const trigger = await screen.findByRole('button', { name: action }); trigger.focus(); fireEvent.click(trigger)
    const cancellation = screen.getByRole('button', { name: 'Cancelar alteração' }); cancellation.focus(); fireEvent.click(cancellation)
    expect(trigger).toHaveFocus(); expect(screen.queryByRole('button', { name: 'Cancelar alteração' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome do rascunho')).toHaveValue(draft.name)
    expect(fetcher.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true)
  })
  it('perda de permissão oculta identificação, referência e comandos da disponibilidade', async () => {
    const fetcher = show(); await screen.findByText(publishedId)
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ allowed: false }))); fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByText(publishedId)).not.toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Disponibilidade para novas ocorrências' })).not.toBeInTheDocument()
  })
})
