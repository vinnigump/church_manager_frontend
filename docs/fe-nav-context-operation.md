# FE-NAV-CONTEXTO-REVOGACAO-ASSINCRONA

Execução: `1623b02b-66c1-4cf4-918e-bee3bd3bd2c3`, 2026-11-09 UTC.
Issue canônica: https://github.com/vinnigump/church_manager_frontend/issues/2.
Base conferida: `f1deaec8728065b6acd584c267f2579f018bda31`.
Branch: `codex/wave-2-fe-nav-contexto-revogacao-assincrona-1623b02b`.
Responsável: executor frontend (implementação e verificação local).
Estado: EM_REVISAO; revisão independente e aceite humano PENDENTES.
Sem commit, push, PR, mudança de fila ou execução de CI nesta sessão.

## Contrato e uso

Briefing READY e conteúdo da issue fornecidos pelo host, NAV-02/P11/D10 e
ContextSelection integrado (#97), inspecionado na base. Nenhum endpoint é
necessário para esta fatia local. Descoberta, concessão e revalidação continuam
dependentes de BE-NAV-AUTORIZACAO; a seleção não concede autorização.

`ContextOperation<T>` é um adaptador pronto para o chamador de ContextSelection.
Dentro do callback `children` do seletor, montar o adaptador com `contextId`,
`operation` e um renderizador dos estados loading/success/error. Manter a
referência de `operation` estável; substituí-la cancela e reinicia a operação.
O callback recebe o identificador e AbortSignal, que deve encaminhar à operação
subjacente quando ela suportar cancelamento. Erros são unknown e interpretados
pelo chamador. Não renderizar mensagens sensíveis diretamente.

A troca de contexto remonta o escopo. A perda do contexto desmonta o conteúdo
pelo seletor existente. O cleanup invalida a execução antes de abortar: mesmo
callbacks que ignoram o signal não podem publicar sucesso ou erro antigo.
O cleanup de layout acontece no commit da transição. Nenhuma rota foi ativada,
nenhuma API foi simulada em produção e não há persistência de resultados.

## Critérios e evidências

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CA1 | Cancelar e invalidar na troca, perda e desmontagem | PASSOU | ContextOperation.test.tsx: troca, revoked/loading/error/removed/unmount e StrictMode |
| CA2 | Descartar sucesso/erro tardios, A → B → A e permitir nova conclusão | PASSOU | testes parametrizados de troca e revogação; conclusão nova A/B |
| CA3 | Callbacks tipados, fixtures só em testes e ausência de endpoint/rota | PASSOU | diff local: adaptador genérico e testes; regressão ContextSelection |

## Verificação técnica local

Node v24.22.1, npm 11.19.1; dependências previamente instaladas pelo host.

- `npm test -- src/components/ContextOperation.test.tsx src/components/ContextSelection.test.tsx`: 15 aprovados, 2 arquivos.
- `npm run lint`: primeira execução falhou por dois parâmetros sem uso no teste; corrigidos com assinatura tipada de vi.fn. Reexecução aprovada.
- `npm run typecheck`: aprovado.
- `npm test`: 1428 aprovados, 58 arquivos, nenhum falho/ignorado.
- `npm run build`: aprovado (114 módulos).
- `git diff --check`: aprovado.

Não houve validação visual. CI: NAO_EXECUTADO, sem SHA publicado nesta execução.
O SHA acima identifica a base; alterações e evidências permanecem sem commit.
Não houve decisão funcional pendente para esta fatia.

## Handoff

Risco residual: o adaptador não interrompe trabalho remoto que ignore abort;
garante descarte local. Seu chamador deve desmontá-lo quando detectar revogação,
conforme o contrato de ContextSelection; a detecção real depende do backend.
Próxima ação: revisão independente e publicação pelo host conforme o fluxo.
PODE_CONCLUIR: NAO (aceite e integração não realizados; issue #2 não concluída).
