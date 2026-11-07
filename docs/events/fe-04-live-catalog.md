# FE-04 — consulta real do catálogo por igreja

## Implementador

Branch `feat/fe-04-live-church-catalog`, base `origin/main` 980996d. PRs #15/#16 integrados por ação humana; #17/#18 permaneciam independentes na última consulta. A nova checagem do backend identificou merge humano do [PR #73](https://github.com/vinnigump/church_manager/pull/73), commit f6f35b5699192bb0899e2967a6b09d271a89aaa2. A tarefa foi retomada assim que o contrato ficou disponível.

Instruções, papéis, issue #4 reconciliada, comentários e componentes existentes consultados. Sem recorrência semanal/mensal/personalizada. Não ativa operações ainda planejadas.

### Contratos usados

[event-type-catalog-v1.openapi.json 1.0.0](https://github.com/vinnigump/church_manager/blob/master/docs/api/event-type-catalog-v1.openapi.json), blob 327ff4e45746c0c07e25b359a8f3b9578c7607fc:

```text
GET /api/v1/events/churches/{churchId}/types?page=0&size=20
{ items: [{ id, scopeType, name, mandatory, enabled }], page, size, total }
```

Escopo CHURCH/DENOMINATION no item indica origem; não é uma concessão. Paginação: page 0..100000, size 1..100. O cliente usa size 20. Estados de versão não constam na resposta e não foram inferidos. Campos adicionais são descartados na validação em runtime.

Guarda usa a consulta existente de própria autorização 1.0.0 com EVENT_VIEW, recurso CHURCH e UUID da rota. [Documentação EVT-005](https://github.com/vinnigump/church_manager/blob/master/docs/events/evt-005-catalogo.md) e [SecurityConfiguration principal](https://github.com/vinnigump/church_manager/blob/master/src/main/java/br/com/churchmanager/security/config/SecurityConfiguration.java) confirmam liberação do GET e autorização no serviço. A decisão prévia da UI não substitui reautorização de cada GET pelo backend.

POST local, PUT enabled e catálogo denominacional também foram publicados, mas **não são implementados neste incremento de consulta**. Sem operações de escrita, token CSRF novo ou nova autoridade presumida.

### Interface

Rota autenticada `/eventos/igrejas/:churchId/catalogo`, com guarda por recurso antes de buscar dados. Caminho de frontend, não endpoint backend. UUID inválido apresenta erro sem request. Acesso por link do contexto da igreja; nenhum formulário técnico de UUID ou lista fictícia de igrejas foi criado. Descoberta automática de contextos ainda depende de contrato próprio; após login pelo fluxo atual pode ser necessário reabrir o link.

Listagem paginada apresenta origem, obrigatoriedade e habilitação dos campos reais. Sem remover template obrigatório, sem inferir DRAFT/PUBLISHED ou mostrar botões de escrita apenas por EVENT_VIEW. `/eventos` diferencia a consulta de catálogo do calendário/programação ainda indisponíveis.

Loading, vazio, erro e sucesso; retry explícito; respostas antigas ignoradas/abortadas ao trocar página ou contexto. Dados anteriores não aparecem durante carregamento. Erros do backend não refletem o corpo recebido; 401 limpa sessão pelo fluxo existente. A guarda reconsulta ao retomar foco e pode remontar a consulta na página inicial.

`data-page-title` no título identifica um texto estático para integração com o ajuste de navegação acessível em revisão no PR #17; não contém nome de evento/igreja/pessoa. Sem dados nominais, URLs privadas, armazenamento de snapshots ou fixtures em produção.

## Testador

Instalação reproduzida com `npm ci` do lockfile atual da principal na tarefa anterior; não há mudança de dependências nesta branch.

| Check | Resultado local |
| --- | --- |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 138 testes passaram: 24 novos + 114 regressões da base |
| `npm run build` | Passou, Vite 7.3.7 |

Testes usam o cliente real e componentes com respostas controladas conforme o contrato publicado: URI/query, cookies/no-store, schema em runtime, paginação/duplicatas inválidas, campos extras descartados, guarda anônima/negada, UUID inválido, estados, troca de página/contexto, respostas tardias, erro de rede e retry, 403/404/409/422/500, 401 com AuthProvider/login reais e ausência de ações de escrita.

**Não houve chamada contra backend em funcionamento**, concessão real, mudança de banco ou teste ponta a ponta. O código agora consome um endpoint implementado; os testes não são prova de funcionamento do ambiente do usuário. Teste visual/responsivo/AT manual ainda pendente; CSS existente reutilizado com paginação flexível.

## Revisor

Papéis executados sequencialmente conforme configuração. Guardas e dados são independentes: mesmo allowed=true, GET pode negar depois de revogação e a UI não mantém conteúdo anterior. Schema validado e projeção explícita removem dados extras; nenhuma lista global é consultada para descobrir igrejas. Paginação respeita limites publicados.

Parecer: **APROVADO COM RESSALVAS para consulta do catálogo**, sem achados críticos/altos introduzidos. Pendências: ensaio backend vivo/AT, descoberta de contextos, criação/habilitação local e catálogo denominacional, lifecycle/versionamento/calendário nas histórias próprias. Não fecha integralmente a #4.

Sem merge/deploy. Conferir revisões/merges anteriores ao concluir e continuar outra demanda independente quando desbloqueada.
