import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider } from '../auth'
import { EventAgenda, EventCatalog } from './EventViews'
import type { AgendaItem, CatalogItem, ViewState } from './presentation'

// Dados sintéticos exclusivos de testes de apresentação, sem simular API.
const church = { id: 'church-a', name: 'Igreja A' }
const catalog: CatalogItem[] = [
  { id: '1', churchId: church.id, title: 'Encontro denominacional', origin: 'denomination', status: 'published' },
  { id: '2', churchId: church.id, title: 'Encontro local', origin: 'local', status: 'draft' },
  { id: '3', churchId: 'church-b', title: 'Evento de outra igreja', origin: 'local', status: 'published' },
]
const occurrence: AgendaItem = { id: '1', churchId: church.id, title: 'Encontro de vários dias', startsAt: '2026-11-06T01:00:00Z', endsAt: '2026-11-08T20:00:00Z', status: 'published', participation: 'registration', checkInEnabled: true }
const account = { id: 'a', personId: 'p', login: 'ana', status: 'ACTIVE' }

describe('catálogo isolado', () => {
  it.each([
    [{ kind: 'unavailable' }, 'Eventos indisponíveis'],
    [{ kind: 'loading' }, 'Carregando eventos'],
    [{ kind: 'error' }, 'Não foi possível carregar'],
    [{ kind: 'ready', items: [] }, 'Nenhum tipo de evento'],
  ] as const)('apresenta estado %j', (state, text) => {
    render(<EventCatalog church={church} state={state} />)
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument()
  })
  it('distingue origem e estado sem expor ações não autorizadas', () => {
    render(<EventCatalog church={church} state={{ kind: 'ready', items: catalog }} />)
    expect(screen.getByText('Denominacional · obrigatório no catálogo')).toBeInTheDocument()
    expect(screen.getByText('Estado: Rascunho')).toBeInTheDocument()
    expect(screen.queryByText('Evento de outra igreja')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'local' } })
    expect(screen.queryByText('Encontro denominacional')).not.toBeInTheDocument()
    expect(screen.getByText('Encontro local')).toBeInTheDocument()
  })
  it('remove dados da igreja anterior quando o contexto muda', () => {
    const view = render(<EventCatalog church={church} state={{ kind: 'ready', items: catalog }} />)
    view.rerender(<EventCatalog church={{ id: 'church-b', name: 'Igreja B' }} state={{ kind: 'ready', items: catalog }} />)
    expect(screen.queryByText('Encontro local')).not.toBeInTheDocument()
    expect(screen.getByText('Evento de outra igreja')).toBeInTheDocument()
  })
})

describe('agenda isolada', () => {
  function show(items: AgendaItem[] = [occurrence]) {
    return render(<EventAgenda church={church} timeZone="America/Fortaleza" state={{ kind: 'ready', items }} />)
  }
  it('exibe fuso e datas locais, abrangendo ocorrência multi-dia', () => {
    show()
    expect(screen.getByText(/Fuso horário: America\/Fortaleza/)).toBeInTheDocument()
    expect(screen.getByText('05/11/2026, 22:00')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-11-07' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-11-07' } })
    expect(screen.getByText(occurrence.title)).toBeInTheDocument()
    expect(screen.getByText(/único por ocorrência/)).toBeInTheDocument()
  })
  it('trata fuso inválido sem lançar exceção ou mostrar listagem parcial', () => {
    render(<EventAgenda church={church} timeZone="Invalid/Zone" state={{ kind: 'ready', items: [occurrence] }}/>)
    expect(screen.getByRole('alert')).toHaveTextContent('período ou fuso horário inválido')
    expect(screen.queryByText(occurrence.title)).not.toBeInTheDocument()
  })
  it.each([
    ['not-a-date', occurrence.endsAt],
    ['2026-11-06T01:00:00', occurrence.endsAt],
    ['2026-02-30T01:00:00Z', occurrence.endsAt],
    [occurrence.startsAt, 'not-a-date'],
    [occurrence.startsAt, occurrence.startsAt],
    [occurrence.endsAt, occurrence.startsAt],
  ])('trata período inválido %s até %s', (startsAt, endsAt) => {
    show([occurrence, { ...occurrence, id: 'invalid', startsAt, endsAt }])
    expect(screen.getByRole('alert')).toHaveTextContent('período ou fuso horário inválido')
    expect(screen.queryByText(occurrence.title)).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
  it('dados inválidos de outra igreja não impedem agenda autorizada atual', () => {
    show([occurrence, { ...occurrence, id: 'other', churchId: 'other', startsAt: 'invalid' }])
    expect(screen.getByText(occurrence.title)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('aceita offset explícito e ordena pelo instante real', () => {
    show([{ ...occurrence, startsAt: '2026-11-05T22:00:00-03:00' }])
    expect(screen.getByText('05/11/2026, 22:00')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('filtra pela data local, não pelo dia UTC', () => {
    show([{ ...occurrence, endsAt: '2026-11-06T02:00:00Z' }])
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-11-06' } })
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma ocorrência')
  })
  it('valida intervalo e permite corrigir o filtro', () => {
    show()
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-11-09' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-11-05' } })
    expect(screen.getByRole('alert')).toHaveTextContent('A data final deve ser igual ou posterior')
    expect(screen.getByLabelText('Data final')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText(occurrence.title)).toBeInTheDocument()
  })
  it('evento aberto não apresenta inscrição, presença nominal ou check-in', () => {
    show([{ ...occurrence, participation: 'open', checkInEnabled: true }])
    expect(screen.getByText('Evento aberto · sem inscrição e sem presença individual')).toBeInTheDocument()
    expect(screen.queryByText(/Check-in habilitado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('não exibe links privados ou campos extras do objeto recebido', () => {
    const withPrivateData = { ...occurrence, privateOnlineUrl: 'https://private.invalid/secret', minorDocument: 'documento-secreto' }
    const { container } = show([withPrivateData])
    expect(container.innerHTML).not.toContain('private.invalid')
    expect(container.innerHTML).not.toContain('documento-secreto')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('não mistura igrejas e ordena as ocorrências pelo início', () => {
    show([occurrence, { ...occurrence, id: '2', title: 'Anterior', startsAt: '2026-11-04T12:00:00Z' }, { ...occurrence, id: '3', title: 'Outra igreja', churchId: 'church-b' }])
    expect(screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual(['Anterior', occurrence.title])
    expect(screen.queryByText('Outra igreja')).not.toBeInTheDocument()
  })
  it.each(['loading', 'error', 'unavailable'] as const)('apresenta %s sem manter conteúdo anterior', kind => {
    const view = show()
    const state: ViewState<AgendaItem> = { kind }
    view.rerender(<EventAgenda church={church} timeZone="America/Fortaleza" state={state} />)
    expect(screen.queryByText(occurrence.title)).not.toBeInTheDocument()
    expect(screen.getByRole(kind === 'error' ? 'alert' : 'status')).toBeInTheDocument()
  })
})

describe('rota de eventos sem integração', () => {
  it('redireciona visitante e não faz requests de eventos', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter initialEntries={['/eventos']}><AuthProvider><App /></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('conta sem capacidades vê indisponibilidade, sem catálogo, ações ou mocks', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter initialEntries={['/eventos']}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App /></AuthContext.Provider></MemoryRouter>)
    expect(screen.getByRole('status')).toHaveTextContent('ainda não estão disponíveis')
    expect(screen.queryByRole('heading', { name: 'Catálogo de eventos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar|criar|cancelar|inscrever/i })).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: 'Minha conta' }))
    expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
  })
})
