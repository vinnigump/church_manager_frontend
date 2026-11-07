import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { changeTemplate, type EventTemplate, type TemplateCommand, type TemplateVersion } from './template-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const type = '00000000-0000-0000-0000-000000000002'
const version = '00000000-0000-0000-0000-000000000003'
const other = '00000000-0000-0000-0000-000000000005'
const draft: TemplateVersion = { id: '00000000-0000-0000-0000-000000000004', number: 2, status: 'DRAFT', name: 'Nome salvo', revision: 3, createdAt: '2026-11-07T12:00:00.123456Z', publishedAt: null }
const published: EventTemplate = { id: type, status: 'PUBLISHED', revision: 7, publishedVersionId: version, draft: null }
const editing: EventTemplate = { ...published, draft }
const newDraft: EventTemplate = { ...published, revision: 8, draft: { ...draft, revision: 0 } }
const edited: EventTemplate = { ...editing, draft: { ...draft, name: 'Novo nome', revision: 4 } }
const released: EventTemplate = { ...editing, revision: 8, publishedVersionId: draft.id, draft: null }
const discontinued: EventTemplate = { ...editing, status: 'DISCONTINUED', revision: 8 }
const invalidCases: Array<{ label: string; command: TemplateCommand; before: EventTemplate; after: unknown }> = [
  { label: 'criar rascunho sem incrementar raiz', command: 'createDraft', before: published, after: { ...newDraft, revision: 7 } },
  { label: 'criar rascunho trocando versão publicada', command: 'createDraft', before: published, after: { ...newDraft, publishedVersionId: other } },
  { label: 'criar rascunho fora da revisão zero', command: 'createDraft', before: published, after: { ...newDraft, draft: { ...draft, revision: 1 } } },
  { label: 'editar incrementando raiz', command: 'editDraft', before: editing, after: { ...edited, revision: 8 } },
  { label: 'editar descontinuando raiz', command: 'editDraft', before: editing, after: { ...edited, status: 'DISCONTINUED' } },
  { label: 'editar trocando versão publicada', command: 'editDraft', before: editing, after: { ...edited, publishedVersionId: other } },
  { label: 'editar sem incrementar rascunho', command: 'editDraft', before: editing, after: { ...edited, draft: { ...draft, name: 'Novo nome' } } },
  { label: 'editar alterando número da versão', command: 'editDraft', before: editing, after: { ...edited, draft: { ...edited.draft!, number: 3 } } },
  { label: 'editar alterando data em um microssegundo', command: 'editDraft', before: editing, after: { ...edited, draft: { ...edited.draft!, createdAt: '2026-11-07T12:00:00.123457Z' } } },
  { label: 'publicar sem incrementar raiz', command: 'publish', before: editing, after: { ...released, revision: 7 } },
  { label: 'publicar com salto de revisão', command: 'publish', before: editing, after: { ...released, revision: 9 } },
  { label: 'descontinuar sem incrementar raiz', command: 'discontinue', before: editing, after: { ...discontinued, revision: 7 } },
  { label: 'descontinuar trocando versão publicada', command: 'discontinue', before: editing, after: { ...discontinued, publishedVersionId: other } },
  { label: 'descontinuar descartando rascunho', command: 'discontinue', before: editing, after: { ...discontinued, draft: null } },
  { label: 'descontinuar alterando rascunho', command: 'discontinue', before: editing, after: { ...discontinued, draft: { ...draft, name: 'Outro nome' } } },
]
function respond(value: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(value); return { client, request } }

describe('integridade das confirmações de templates', () => {
  it.each(invalidCases)('rejeita efeito fora do contrato: $label', async ({ command, before, after }) => {
    const { client, request } = respond(after)
    await expect(changeTemplate(denomination, before, command, 'Novo nome', undefined, client)).rejects.toThrow('confirmar')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it.each<TemplateCommand>(['createDraft', 'editDraft', 'publish', 'discontinue'])('aceita efeito exato de %s', async command => {
    const before = command === 'createDraft' ? published : editing
    const after = { createDraft: newDraft, editDraft: edited, publish: released, discontinue: discontinued }[command]
    expect(await changeTemplate(denomination, before, command, 'Novo nome', undefined, respond(after).client)).toEqual(after)
  })
  it('editar o mesmo nome ainda incrementa revisão do rascunho, conforme servidor', async () => {
    const after = { ...editing, draft: { ...draft, revision: 4 } }
    expect(await changeTemplate(denomination, editing, 'editDraft', draft.name, undefined, respond(after).client)).toEqual(after)
  })
  it('aceita instante equivalente com offset ao preservar a criação da versão', async () => {
    const after = { ...edited, draft: { ...edited.draft!, createdAt: '2026-11-07T09:00:00.123456-03:00' } }
    expect(await changeTemplate(denomination, editing, 'editDraft', 'Novo nome', undefined, respond(after).client)).toEqual(after)
  })
  it('descontinuar sem rascunho não fabrica versão nova', async () => {
    const after = { ...published, status: 'DISCONTINUED' as const, revision: 8 }
    expect(await changeTemplate(denomination, published, 'discontinue', undefined, undefined, respond(after).client)).toEqual(after)
  })
})
