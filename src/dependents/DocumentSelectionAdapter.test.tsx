import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentSelectionAdapter } from './DocumentSelectionAdapter'
import type { DocumentSelection } from './DocumentAuthorization'

const context = { churchId: 'church-a', dependentId: 'dependent-a', guardianId: 'guardian-a' }
const file = new File(['sintético'], 'privado.pdf')
function deferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function select() {
  fireEvent.change(screen.getByLabelText('Selecionar documento'), { target: { files: [file] } })
}
afterEach(() => vi.restoreAllMocks())

describe('resultado assíncrono da seleção documental', () => {
  it('entrega File/contexto, distingue pendência e termina sem confirmar upload ou autorização', async () => {
    const request = deferred()
    const onSelect = vi.fn<(selection: DocumentSelection) => Promise<void>>(() => request.promise)
    const fetcher = vi.spyOn(globalThis, 'fetch')
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const log = vi.spyOn(console, 'log')
    const reader = vi.spyOn(FileReader.prototype, 'readAsDataURL')
    const { container } = render(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
    select()
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ...context, file })
    expect(onSelect.mock.calls[0][0].file).toBe(file)
    expect(screen.getByRole('status')).toHaveTextContent('Processando seleção')
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true')
    await act(async () => request.resolve())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(container.firstChild).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByText(/A seleção não confirma envio nem aprovação/)).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/privado.pdf|APROVADA|sintético/)
    expect(container.querySelector('a, img, iframe, object')).toBeNull()
    for (const spy of [fetcher, storage, log, reader]) expect(spy).not.toHaveBeenCalled()
  })

  it.each(['rejeição', 'exceção síncrona'])('mostra erro seguro em %s e permite nova seleção', async mode => {
    const request = deferred()
    const onSelect = vi.fn(() => {
      if (mode === 'exceção síncrona') throw new Error('segredo documental')
      return request.promise
    })
    render(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
    select()
    if (mode === 'rejeição') await act(async () => request.reject(new Error('segredo documental')))
    expect(screen.getByRole('alert')).toHaveTextContent('Nenhum envio foi confirmado')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/segredo documental/)).not.toBeInTheDocument()
    onSelect.mockImplementation(() => new Promise<void>(() => {}))
    select()
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Processando seleção')
  })

  describe.each(['churchId', 'dependentId', 'guardianId'] as const)('troca de %s', field => {
    it.each(['resolve', 'reject'] as const)('ignora %s tardio, inclusive ao voltar ao contexto inicial', async outcome => {
      const old = deferred()
      const current = deferred()
      const onSelect = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
      const view = render(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
      select()
      const next = { ...context, [field]: 'other' }
      view.rerender(<DocumentSelectionAdapter context={next} onSelect={onSelect}/> )
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      select()
      expect(onSelect.mock.calls[1][0]).toEqual({ ...next, file })
      await act(async () => old[outcome]())
      expect(screen.getByRole('status')).toHaveTextContent('Processando seleção')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      view.rerender(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
      await act(async () => current[outcome]())
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it.each(['resolve', 'reject'] as const)('ignora %s de seleção substituída sem apagar erro atual', async outcome => {
    const old = deferred()
    const current = deferred()
    const onSelect = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    render(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
    select()
    select()
    await act(async () => current.reject())
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await act(async () => old[outcome]())
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['resolve', 'reject'] as const)('ignora %s da primeira sessão após A → B → A', async outcome => {
    const old = deferred()
    const current = deferred()
    const onSelect = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const view = render(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
    select()
    view.rerender(<DocumentSelectionAdapter context={{ ...context, dependentId: 'other' }} onSelect={onSelect}/> )
    view.rerender(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
    select()
    await act(async () => old[outcome]())
    expect(screen.getByRole('status')).toHaveTextContent('Processando seleção')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => current.resolve())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('não inicia callback ao cancelar seleção e consome rejeição após desmontagem', async () => {
    const request = deferred()
    const onSelect = vi.fn(() => request.promise)
    const view = render(<DocumentSelectionAdapter context={context} onSelect={onSelect}/> )
    fireEvent.change(screen.getByLabelText('Selecionar documento'), { target: { files: [] } })
    expect(onSelect).not.toHaveBeenCalled()
    select()
    view.unmount()
    await act(async () => request.reject(new Error('privado')))
  })
})
