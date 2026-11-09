import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PersonForm, PersonView, type PersonCreationResult } from './PersonViews'

// Synthetic presentation fixtures only; no HTTP mocks or production route.
const person = { fullName: 'Pessoa sintética', preferredName: 'Nome sintético' }
function fill(name = person.fullName, cpf = '000.000.000-00') {
  fireEvent.change(screen.getByLabelText('Nome completo (obrigatório)'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: cpf } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'sintetico@example.invalid' } })
}
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Cadastrar pessoa' })) }

describe('formulário isolado de pessoa', () => {
  it('exige nome não vazio e documento sem inventar tipos ou validação de CPF', () => {
    const callback = vi.fn()
    render(<PersonForm onSubmit={callback}/>)
    fill('   '); submit()
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toHaveAttribute('aria-invalid', 'true')
    fill(person.fullName, '   '); submit()
    expect(screen.getByLabelText(/^CPF/)).toHaveAttribute('aria-invalid', 'true')
    expect(callback).not.toHaveBeenCalled()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('aceita CPF ausente somente com alternativa aceita pelo chamador', async () => {
    const callback = vi.fn().mockResolvedValue({ kind: 'confirmed', person })
    render(<PersonForm onSubmit={callback} acceptedAlternativeDocument={{ label: 'Alternativa sintética' }}/>)
    fill('   ' + person.fullName + '   ', ''); submit()
    expect(callback).toHaveBeenCalledWith({ fullName: person.fullName, cpf: '', email: 'sintetico@example.invalid', phone: '', birthDate: '' })
    expect(await screen.findByRole('heading', { name: 'Ficha da pessoa' })).toBeInTheDocument()
  })

  it('não aceita alternativa com rótulo vazio', () => {
    const callback = vi.fn()
    render(<PersonForm onSubmit={callback} acceptedAlternativeDocument={{ label: '   ' }}/>)
    fill(person.fullName, ''); submit()
    expect(callback).not.toHaveBeenCalled()
  })

  it.each(['E-mail', 'Telefone'])('exige pelo menos um contato e aceita somente %s', async contact => {
    const callback = vi.fn().mockResolvedValue({ kind: 'confirmed', person })
    render(<PersonForm onSubmit={callback}/>)
    fill()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: '   ' } })
    submit()
    expect(callback).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Telefone')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByLabelText(contact), { target: { value: contact === 'E-mail' ? 'sintetico@example.invalid' : '000000000' } })
    submit()
    expect(await screen.findByText('Cadastro confirmado.')).toBeInTheDocument()
  })

  it('exige nascimento somente pela regra explícita do chamador', async () => {
    const callback = vi.fn().mockResolvedValue({ kind: 'confirmed', person })
    render(<PersonForm onSubmit={callback} birthDateRequired/>)
    fill(); submit()
    expect(callback).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nascimento (obrigatório)')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByLabelText('Nascimento (obrigatório)'), { target: { value: '2000-01-01' } })
    submit()
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ birthDate: '2000-01-01' }))
    expect(await screen.findByText('Cadastro confirmado.')).toBeInTheDocument()
  })

  it('edita rascunho incompleto em memória e descarta ao perder acesso, inclusive confirmação pendente', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    let confirm!: (result: PersonCreationResult) => void
    const callback = vi.fn(() => new Promise<PersonCreationResult>(resolve => { confirm = resolve }))
    const { rerender } = render(<PersonForm onSubmit={callback}/>)
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '000000000' } })
    expect(callback).not.toHaveBeenCalled()
    fill(); submit()
    rerender(<PersonView state={{ kind: 'unavailable' }}/>)
    await act(async () => confirm({ kind: 'confirmed', person }))
    expect(screen.queryByText('Cadastro confirmado.')).not.toBeInTheDocument()
    rerender(<PersonForm onSubmit={callback}/>)
    for (const label of ['Nome completo (obrigatório)', 'CPF', 'E-mail', 'Telefone', 'Nascimento (opcional)']) {
      expect(screen.getByLabelText(label)).toHaveValue('')
    }
    expect(storage).not.toHaveBeenCalled()
    storage.mockRestore()
  })

  it('aguarda confirmação, impede envio duplicado e usa a ficha retornada', async () => {
    let confirm!: (result: PersonCreationResult) => void
    const callback = vi.fn(() => new Promise<PersonCreationResult>(resolve => { confirm = resolve }))
    render(<PersonForm onSubmit={callback}/>)
    fill(); submit(); submit()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Aguardando confirmação')
    expect(screen.getByLabelText(/^CPF/)).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Ficha da pessoa' })).not.toBeInTheDocument()
    await act(async () => confirm({ kind: 'confirmed', person: { fullName: 'Nome confirmado' } }))
    expect(screen.getByText('Nome confirmado')).toBeInTheDocument()
    expect(screen.queryByText(person.fullName)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each(['error', 'conflict', 'rejection'] as const)('preserva edição e bloqueia repetição após %s sem refletir erro bruto', async kind => {
    const callback = vi.fn((): Promise<PersonCreationResult> => kind === 'rejection'
      ? Promise.reject(new Error('segredo de teste')) : Promise.resolve({ kind }))
    render(<PersonForm onSubmit={callback}/>)
    fill(); submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toHaveValue(person.fullName)
    expect(screen.getByLabelText(/^CPF/)).toHaveValue('000.000.000-00')
    expect(screen.getByLabelText('E-mail')).toHaveValue('sintetico@example.invalid')
    expect(screen.getByRole('button')).toBeDisabled()
    fill('Correção sintética'); submit()
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '000000000' } })
    expect(screen.getByLabelText('Telefone')).toHaveValue('000000000')
    expect(callback).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('heading', { name: 'Ficha da pessoa' })).not.toBeInTheDocument()
    expect(screen.queryByText(/segredo de teste/)).not.toBeInTheDocument()
  })

  it('descarta dados quando o chamador troca a chave de contexto', () => {
    const callback = vi.fn()
    const { rerender } = render(<PersonForm key="context-a" onSubmit={callback}/>)
    fill()
    rerender(<PersonForm key="context-b" onSubmit={callback}/>)
    expect(screen.getByLabelText(/^CPF/)).toHaveValue('')
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toHaveValue('')
  })
})

describe('consulta isolada da ficha', () => {
  it('cobre carregamento, erro, indisponibilidade e perda do acesso sem ficha anterior', () => {
    const { rerender } = render(<PersonView state={{ kind: 'ready', person }}/>)
    expect(screen.getByText(person.preferredName)).toBeInTheDocument()
    for (const kind of ['loading', 'error', 'unavailable'] as const) {
      rerender(<PersonView state={{ kind }}/>)
      expect(screen.queryByText(person.fullName)).not.toBeInTheDocument()
      expect(screen.getByRole(kind === 'error' ? 'alert' : 'status')).toBeInTheDocument()
    }
  })
})
