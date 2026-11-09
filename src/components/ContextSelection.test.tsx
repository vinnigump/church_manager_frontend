import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContextSelection } from './ContextSelection'

const first = { id: 'context-a', label: 'Igreja A' }
const second = { id: 'context-b', label: 'Igreja B' }

describe('ContextSelection', () => {
  it('apresenta carregamento, falha recuperável e lista vazia sem montar o conteúdo', () => {
    const onRetry = vi.fn()
    const content = vi.fn(() => <p>Conteúdo de contexto</p>)
    const onSelect = vi.fn()
    const { rerender } = render(<ContextSelection state={{ kind: 'loading' }} {...{ onRetry, onSelect }}>{content}</ContextSelection>)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    rerender(<ContextSelection state={{ kind: 'error' }} {...{ onRetry, onSelect }}>{content}</ContextSelection>)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar novamente' }))
    expect(onRetry).toHaveBeenCalledOnce()

    rerender(<ContextSelection state={{ kind: 'ready', options: [] }} {...{ onRetry, onSelect }}>{content}</ContextSelection>)
    expect(screen.getByRole('status')).toHaveTextContent('Nenhum contexto autorizado')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(content).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('mostra apenas opções fornecidas e emite a seleção válida', () => {
    const onSelect = vi.fn()
    render(<ContextSelection state={{ kind: 'ready', options: [first] }} onSelect={onSelect} />)
    const select = screen.getByRole('combobox', { name: 'Contexto' })
    expect(screen.queryByRole('option', { name: second.label })).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: second.id } })
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.change(select, { target: { value: first.id } })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(first.id)
  })

  it('remove o conteúdo revogado e permite uma nova seleção autorizada', () => {
    const onSelect = vi.fn()
    const content = (id: string) => <p>Conteúdo de {id}</p>
    const { rerender } = render(<ContextSelection state={{ kind: 'ready', options: [first, second], selectedId: first.id }} onSelect={onSelect}>{content}</ContextSelection>)
    expect(screen.getByText('Conteúdo de context-a')).toBeInTheDocument()

    rerender(<ContextSelection state={{ kind: 'revoked', options: [second] }} onSelect={onSelect}>{content}</ContextSelection>)
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso ao contexto anterior não autorizado')
    expect(screen.queryByText('Conteúdo de context-a')).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: first.label })).not.toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Contexto' })
    expect(select).toHaveValue('')
    fireEvent.change(select, { target: { value: second.id } })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(second.id)
    expect(screen.queryByText('Conteúdo de context-b')).not.toBeInTheDocument()

    rerender(<ContextSelection state={{ kind: 'ready', options: [second], selectedId: second.id }} onSelect={onSelect}>{content}</ContextSelection>)
    expect(screen.getByText('Conteúdo de context-b')).toBeInTheDocument()
  })

  it('omite conteúdo quando a seleção recebida deixa de fazer parte das opções', () => {
    const content = vi.fn(() => <p>Conteúdo de contexto</p>)
    render(<ContextSelection state={{ kind: 'ready', options: [second], selectedId: first.id }} onSelect={vi.fn()}>{content}</ContextSelection>)
    expect(screen.getByRole('combobox', { name: 'Contexto' })).toHaveValue('')
    expect(content).not.toHaveBeenCalled()
  })
})
