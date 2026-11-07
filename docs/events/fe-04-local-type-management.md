# FE-04 — criação e habilitação de tipos locais

## Implementador

Branch `feat/fe-04-local-type-management`, base `origin/main` 63dfe32 após merge humano do PR #19. Lidos AGENTS.md, três papéis, README, issue #4/comentários (sem novos comentários), catálogo existente e contratos reais backend. A orientação posterior do usuário autoriza continuar demandas independentes sem aguardar nova aprovação, preservando PR draft e ausência de merge/deploy pelo agente.

Contratos usados: [event-type-catalog-v1.openapi.json 1.0.0](https://github.com/vinnigump/church_manager/blob/master/docs/api/event-type-catalog-v1.openapi.json) e [EVT-005](https://github.com/vinnigump/church_manager/blob/master/docs/events/evt-005-catalogo.md). O PR backend #73 já está integrado. O trabalho posterior de versões #75 foi identificado, mas não é presumido por estes formulários locais nem foi antecipado.

- POST `/api/v1/events/churches/{churchId}/types`, corpo somente `{ name }`, EVENT_CREATE/CHURCH.
- PUT `/api/v1/events/churches/{churchId}/types/{typeId}/enabled`, corpo somente `{ enabled }`, EVENT_EDIT/CHURCH.
- GET paginado existente usado para reconciliar a consulta após sucesso, sem tratar falha de leitura como falha da escrita já confirmada.

Basic, cookie, no-store e CSRF do cliente existente preservados. O servidor determina ator/escopo e revalida cada operação. O cliente valida IDs, nome até 180 caracteres, schema da resposta e identidade/estado do tipo alterado. Projeção de DTO compartilhada com leitura, sem preservar campos extras.

## Interface e concorrência

Formulário e controles só aparecem após decisões próprias EVENT_CREATE e EVENT_EDIT. EVENT_VIEW não concede nenhuma escrita. `ResourceAccess` aceita modo opcional com fallback somente leitura: negação, loading ou erro de decisão não revelam controles. O comportamento padrão das guardas permanece inalterado.

Tipos denominacionais/obrigatórios não recebem ação nem podem ser enviados ao helper de alteração local. Desabilitação exige confirmação explícita e explica preservação de ocorrências/inscrições. Nenhuma exclusão física, renomeação, publicação/versionamento ou regra de inscrição foi adicionada.

A consulta backend retorna somente tipos habilitados. Após uma desabilitação confirmada, mantém-se **somente em memória da mesma tela** o último tipo desabilitado, com opção autorizada de reverter. Recarregar/sair perde esse atalho; não foi inventada API de listagem dos desabilitados ou busca por nome/ID. Uma futura tela de recuperação depende de contrato próprio. Falha ao reabilitar não apaga esse último resultado confirmado.

Mutação fica acima das guardas de leitura/ação: reconsulta de foco não perde resultado em andamento nem libera duplo envio. Ref de requisição impede concorrência antes do próximo render. Mudança de igreja/conta desmonta o workspace e ignora respostas antigas; abortar transporte não é anunciado como cancelamento de uma transação no servidor.

Sem sucesso otimista ou retry de escrita automático. Falha de rede, 5xx ou resposta incompatível é resultado incerto: a mensagem orienta consultar o catálogo antes de enviar novamente. Atualizar catálogo é somente GET. Uma criação confirmada é informada a partir da resposta validada, e a listagem é atualizada separadamente.

## Testador

| Comando | Resultado local |
| --- | --- |
| `npm ci` | Passou; sete moderados preexistentes na cadeia de lint, sem alteração de dependências |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 168 testes passaram: 21 novos e 147 regressões |
| `npm run build` | Passou, Vite 7.3.7 |

Casos novos: payloads exatos, Basic/CSRF/cookies, escrita sem CSRF negada, nome inválido, template obrigatório negado, resposta de outro ID rejeitada, view sem create/edit, formulário/sucesso/refetch, confirmação/cancelamento, reabilitação, duplo envio durante foco, 403/404/409/422, rede/5xx/schema inválido sem retry, resposta antiga não aparece na igreja nova.

Uma tentativa de testes/build não executou por falha temporária da revisão automática (limite de uso do serviço). Após o usuário autorizar nova tentativa, ambos passaram. Não foi contornado o controle de aprovação.

Os testes usam cliente/componentes reais com respostas controladas conforme OpenAPI; **não houve escrita contra um backend em execução, banco de uso ou dados reais**. Ensaio visual/AT e integração ponta a ponta seguem pendentes.

## Revisor

Papéis executados sequencialmente. Revistos guardas, estados, requests e resultados. Sem permissões locais fictícias, ator no corpo, campos privados, storage, logs ou coleta de menores. Resultado confirmado fica associado ao workspace atual; ausência de confirmação não é convertida em sucesso. Permissão de consulta permanece separada de permissões de escrita e backend é a autoridade final.

Parecer: **APROVADO COM RESSALVAS para gestão local publicada**, sem achado crítico/alto introduzido. Limites: reabilitação de catálogo desabilitado após sair da tela não possui consulta publicada; disponibilidade de permissões pode mudar entre consulta e ação, exigindo a decisão de servidor que já ocorre; ensaio backend vivo e visual/AT pendentes. Não conclui toda a #4.

Sem merge/deploy. Ao concluir, conferir PRs anteriores e seguir outra demanda independente tecnicamente desbloqueada.
