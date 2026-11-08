# FE-04 — confirmação de escritas do calendário anual

## Identificação e escopo

Issue canônica [#4](https://github.com/vinnigump/church_manager_frontend/issues/4),
módulo Eventos, épico FE-04, prioridade não definida na issue.
Data: 2026-11-07 UTC. Branch `codex/fe-04-calendar-confirmation`, base `86f0821`.
Responsável: agente da atividade, papéis executados sequencialmente.
Não representa revisão independente ou aprovação humana.

Contrato `event-calendar-v1.openapi.json` 1.0.0 e `EventCalendarService`
conferidos no backend integrado `28ea26d`. O serviço cria em revisão0,
incrementa uma vez quando muda publicação e retorna o registro intacto
em no-op. Publicar/retirar publicação não modifica `createdAt`.

Problema reproduzido: a validação anterior aceitava estado/ID corretos mesmo
com revisão regressiva, sem incremento, incremento excessivo, mudança de
metadados imutáveis ou no-op que alterava a data de publicação. O hook podia
então apresentar sucesso de uma resposta incompatível. Não é alegação de que
o backend integrado tenha produzido essas respostas em operação real.

Agora a confirmação exige revisão0 na criação, revisão esperada exata nas
transições/no-op e preservação dos instantes imutáveis. Datas equivalentes
com offset são aceitas; diferenças submilissegundo são preservadas na comparação.
O parser limita a fração aos nove dígitos representáveis por Java Instant.
Resposta incompatível utiliza o fluxo existente de resultado incerto, sem
sucesso otimista nem repetição automática.

Sem alteração de markup, permissões, endpoints, CSRF, corpo/header de escrita,
estado de publicação, regra de autorização ou servidor. Fixture antiga de
criação corrigida para revisão0 conforme o backend, sem enfraquecer asserções.

## Critérios do incremento

Não representam todos os critérios da issue #4.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CONF-01 | Rejeitar revisões incompatíveis e criação fora da revisão0 | PASSOU | calendar-confirmation.test.ts, casos parametrizados |
| CONF-02 | Preservar no-op e incremento exato da transição | PASSOU | calendar-confirmation.test.ts, publicar/retirar/no-op |
| CONF-03 | Preservar instantes imutáveis e aceitar offsets equivalentes | PASSOU | diferenças de1microssegundo e representações equivalentes |
| CONF-04 | Resposta inválida não gera sucesso/retry; manter regressões de autorização/CSRF | PASSOU | AnnualCalendarPage.test.tsx e suíte completa |
| CONF-05 | Ensaio desta correção com backend vivo | NAO_TESTADO | testes de contrato usam respostas controladas |

## Testador

Node24/Windows, Vitest5.1.0/jsdom. `npm ci` concluído neste worktree, lockfile
inalterado. Antes da correção,14 novos testes de contrato resultaram em9falhas
e5aprovações, demonstrando a lacuna. Após correção, os58 testes de calendário
(contrato/fluxo) passaram. Regressão completa: **665 testes,33 arquivos, todos
aprovados**, sem ignorados. São15 casos novos (14 contrato e1 fluxo).

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e
`git diff --check` passaram. Sem alteração de timeout/configuração de testes.
Sete vulnerabilidades moderadas preexistentes em tooling permaneceram; sem
atualização forçada. CI do head deve ser confirmado no PR.

Última tentativa de atualizar a ref backend após os testes falhou por DNS
(`github.com` não resolvido); os contratos usados são da ref integrada já
consultada28ea26d, não de PRs backend pendentes.

## Revisão, riscos e decisão

Revisão estática sequencial: sem achados críticos/altos remanescentes no diff.
Parecer independente PENDENTE. Risco limitado à confirmação: resposta fora do
contrato passa a exigir reconciliação explícita pelo fluxo já existente.
Não há replay de escrita nem inferência local de autorização.

Não há mudança visual nesta correção. Backend vivo não ensaiado; quando uma
validação visual for necessária, solicitar ao usuário ativação da aplicação,
conforme orientação recebida. Não administrar o ambiente como pré-condição
para desenvolvimento independente.

PODE_CONCLUIR: NAO — issue #4 permanece parcial, aguardando demais contratos
e aceite humano. Próxima ação: publicar PR draft, confirmar CI e revisão.

```yaml
atividade: FE-04-CALENDAR-CONFIRMATION
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 665
testes_falhos: 0
testes_ignorados: 0
ci: NAO_EXECUTADO
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [backend_vivo_nao_ensaiado, revisao_independente, aceite_humano]
proxima_acao: Abrir PR e conferir CI e revisao do head final
pode_concluir: false
aceite_humano: PENDENTE
```

## Atualização da base — 2026-11-07 UTC

PR #60 / issue #4. Base f72b9fec225c4ca0a41401f2bceb13330b63d6de incorporada
sem conflito, preservando planejamento e auditoria integrados. Lint, typecheck,
753 testes/36 arquivos, build e diff --check passaram novamente. Sem dependências,
lockfile ou timeouts alterados. Revisão estática sequencial sem críticos/altos;
revisão independente/aceite humano pendentes. CI novo head registrado no PR.
Validação visual dispensada pelo usuário como requisito dos PRs; registros anteriores
são históricos e não se convertem em PASSOU. Backend vivo não ensaiado.
Sem merge em main, deploy ou alterações de infraestrutura.
