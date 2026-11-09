import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JourneyProgress, type JourneyContext, type JourneyProjection } from './JourneyProgress'

// Synthetic presentation fixtures only; no simulated API or production route.
const context: JourneyContext = { actorId: 'actor', subjectId: 'subject', churchId: 'church', executionId: 'execution' }
const projection: JourneyProjection = {
  context, title: 'Trilha sintética', versionLabel: 'Versão sintética',
  stateLabel: 'Situação fornecida', progressLabel: 'Progresso fornecido: 7 de 12',
  tasks: [{ id: 'task', title: 'Tarefa sintética', stateLabel: 'Situação da tarefa fornecida' }],
}

describe('Minha Jornada isolada', () => {
  it('exibe somente os campos de apresentação autorizados, sem inferir progresso das tarefas', () => {
    const data = { ...projection, privateDocument: 'documento privado', secret: 'segredo sintético' }
    render(<JourneyProgress context={context} state={{ kind: 'ready', projection: data }}/>)
    expect(screen.getByRole('region', { name: 'Minha Jornada' })).toHaveAttribute('aria-busy', 'false')
    for (const text of [projection.title, projection.versionLabel, projection.stateLabel, projection.progressLabel!,
      projection.tasks[0].title, projection.tasks[0].stateLabel]) expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Tarefas' })).toBeInTheDocument()
    expect(screen.queryByText(data.privateDocument)).not.toBeInTheDocument()
    expect(screen.queryByText(data.secret)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it.each(['loading', 'error', 'empty', 'denied'] as const)('remove toda a projeção anterior ao mudar para %s', kind => {
    const { rerender } = render(<JourneyProgress context={context} state={{ kind: 'ready', projection }}/>)
    rerender(<JourneyProgress context={context} state={{ kind }}/>)
    for (const text of [projection.title, projection.versionLabel, projection.stateLabel, projection.progressLabel!,
      projection.tasks[0].title, projection.tasks[0].stateLabel]) expect(screen.queryByText(text)).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole(kind === 'error' ? 'alert' : 'status')).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', String(kind === 'loading'))
  })

  it.each(['actorId', 'subjectId', 'churchId', 'executionId'] as const)('oculta snapshot anterior quando %s muda', field => {
    const { rerender } = render(<JourneyProgress context={context} state={{ kind: 'ready', projection }}/>)
    rerender(<JourneyProgress context={{ ...context, [field]: 'outro' }} state={{ kind: 'ready', projection }}/>)
    expect(screen.getByRole('status')).toHaveTextContent('Jornada indisponível para este contexto.')
    expect(screen.queryByText(projection.title)).not.toBeInTheDocument()
    expect(screen.queryByText(projection.progressLabel!)).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('não transforma progresso ausente em zero nem deduz conclusão da lista vazia', () => {
    render(<JourneyProgress context={context} state={{ kind: 'ready', projection: { ...projection, progressLabel: null, tasks: [] } }}/>)
    expect(screen.getByText('Progresso não informado.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma tarefa autorizada para exibição.')
    expect(screen.queryByText(/0%|100%|membro ativo|presença confirmada/i)).not.toBeInTheDocument()
  })

  it('substitui a projeção sem preservar tarefas ou progresso anteriores', () => {
    const { rerender } = render(<JourneyProgress context={context} state={{ kind: 'ready', projection }}/>)
    rerender(<JourneyProgress context={context} state={{ kind: 'ready', projection: { ...projection, progressLabel: 'Revisão fornecida', tasks: [] } }}/>)
    expect(screen.queryByText(projection.tasks[0].title)).not.toBeInTheDocument()
    expect(screen.queryByText(projection.progressLabel!)).not.toBeInTheDocument()
    expect(screen.getByText('Revisão fornecida')).toBeInTheDocument()
  })
})
