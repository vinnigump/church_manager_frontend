import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DependentAuthorizationView, DependentDocumentAttachment, type DependentAuthorizationState, type DocumentSelection } from './DocumentAuthorization'

// Dados sintéticos exclusivos dos testes, sem API simulada.
const context = { churchId: 'church-a', dependentId: 'dependent-a', guardianId: 'guardian-a' }
const projection = { basicProfile: { displayName: 'Dependente sintético' }, links: ['Vínculo sintético'], progress: ['Etapa sintética'] }
const approved: DependentAuthorizationState = { kind: 'ready', context, authorization: 'APROVADA', projection }
const show = (state: DependentAuthorizationState = approved) => render(<DependentAuthorizationView context={context} state={state}/> )

afterEach(() => vi.restoreAllMocks())

describe('anexo isolado pelo dependente', () => {
  it('entrega o mesmo File e contexto ao callback tipado, sem persistência ou publicação', () => {
    const onSelect = vi.fn<(selection: DocumentSelection) => void>()
    const fetcher = vi.spyOn(globalThis, 'fetch')
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const log = vi.spyOn(console, 'log')
    const reader = vi.spyOn(FileReader.prototype, 'readAsDataURL')
    const file = new File(['conteúdo sintético'], 'privado.pdf', { type: 'application/pdf' })
    const { container } = render(<DependentDocumentAttachment context={context} state="available" onSelect={onSelect}/> )
    const input = screen.getByLabelText('Selecionar documento')
    fireEvent.change(input, { target: { files: [file] } })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ...context, file })
    expect(onSelect.mock.calls[0][0].file).toBe(file)
    expect(input).toHaveValue('')
    expect(container.innerHTML).not.toMatch(/privado.pdf|conteúdo sintético/)
    expect(container.querySelector('a, img, iframe, object')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    expect(reader).not.toHaveBeenCalled()
  })
  it('não entrega seleção cancelada e permite selecionar novamente o mesmo arquivo', () => {
    const onSelect = vi.fn()
    render(<DependentDocumentAttachment context={context} state="available" onSelect={onSelect}/> )
    const input = screen.getByLabelText('Selecionar documento')
    fireEvent.change(input, { target: { files: [] } })
    expect(onSelect).not.toHaveBeenCalled()
    const file = new File(['sintético'], 'teste.pdf')
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
  it.each(['unavailable', 'loading', 'error'] as const)('não oferece coleta em %s', state => {
    const onSelect = vi.fn()
    const { container } = render(<DependentDocumentAttachment context={context} state={state} onSelect={onSelect}/> )
    expect(container.querySelector('input')).toBeNull()
    expect(screen.getByRole(state === 'error' ? 'alert' : 'status')).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', String(state === 'loading'))
    expect(onSelect).not.toHaveBeenCalled()
  })
  it('reinicia a entrada quando muda o dependente e entrega somente o novo contexto', () => {
    const onSelect = vi.fn()
    const view = render(<DependentDocumentAttachment context={context} state="available" onSelect={onSelect}/> )
    const oldInput = screen.getByLabelText('Selecionar documento')
    const next = { ...context, dependentId: 'dependent-b' }
    view.rerender(<DependentDocumentAttachment context={next} state="available" onSelect={onSelect}/> )
    const input = screen.getByLabelText('Selecionar documento')
    expect(input).not.toBe(oldInput)
    const file = new File(['sintético'], 'teste.pdf')
    fireEvent.change(input, { target: { files: [file] } })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ...next, file })
  })
})

describe('consulta documental restrita do responsável', () => {
  it('projeta somente perfil básico, vínculos e progresso aprovados, sem operações', () => {
    const privateProjection = { ...projection, documentUrl: 'https://private.invalid/doc', cpf: 'cpf privado', medical: 'saúde privada' }
    const { container } = show({ ...approved, authorization: 'APROVADA', projection: privateProjection })
    expect(screen.getByRole('status')).toHaveTextContent('APROVADA')
    expect(screen.getByRole('region', { name: 'Perfil básico' })).toHaveTextContent(projection.basicProfile.displayName)
    expect(screen.getByRole('region', { name: 'Vínculos' })).toHaveTextContent(projection.links[0])
    expect(screen.getByRole('region', { name: 'Progresso' })).toHaveTextContent(projection.progress[0])
    expect(container.innerHTML).not.toMatch(/private.invalid|cpf privado|saúde privada/)
    expect(container.querySelector('button, input, a, form, img, iframe')).toBeNull()
  })
  it.each(['PENDENTE', 'REJEITADA', 'REVOGADA'] as const)('remove projeção anterior em %s mesmo com dados obsoletos no objeto', authorization => {
    const view = show()
    view.rerender(<DependentAuthorizationView context={context} state={{ ...approved, authorization, projection } as DependentAuthorizationState}/> )
    expect(screen.getByRole('status')).toHaveTextContent(authorization)
    expect(screen.queryByText(projection.basicProfile.displayName)).not.toBeInTheDocument()
    expect(screen.queryByText(projection.links[0])).not.toBeInTheDocument()
    expect(screen.queryByText(projection.progress[0])).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Perfil básico' })).not.toBeInTheDocument()
  })
  it.each(['unavailable', 'loading', 'error'] as const)('limpa projeção em %s', kind => {
    const view = show()
    view.rerender(<DependentAuthorizationView context={context} state={{ kind }}/> )
    expect(screen.queryByText(projection.basicProfile.displayName)).not.toBeInTheDocument()
    expect(screen.queryByText(projection.links[0])).not.toBeInTheDocument()
    expect(screen.queryByText(projection.progress[0])).not.toBeInTheDocument()
    expect(screen.getByRole(kind === 'error' ? 'alert' : 'status')).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', String(kind === 'loading'))
  })
  it.each(['churchId', 'dependentId', 'guardianId'] as const)('oculta projeção de outro contexto %s', field => {
    const view = show()
    view.rerender(<DependentAuthorizationView context={{ ...context, [field]: 'other' }} state={approved}/> )
    expect(screen.getByRole('status')).toHaveTextContent('indisponível para este contexto')
    expect(screen.queryByText(projection.basicProfile.displayName)).not.toBeInTheDocument()
    expect(screen.queryByText(projection.links[0])).not.toBeInTheDocument()
    expect(screen.queryByText(projection.progress[0])).not.toBeInTheDocument()
  })
  it('apresenta vazios sem inventar vínculos ou progresso', () => {
    show({ ...approved, authorization: 'APROVADA', projection: { ...projection, links: [], progress: [] } })
    expect(screen.getByText('Nenhum vínculo autorizado para exibição.')).toBeInTheDocument()
    expect(screen.getByText('Nenhum progresso autorizado para exibição.')).toBeInTheDocument()
  })
})
