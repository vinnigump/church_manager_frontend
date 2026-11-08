# FE-04 — confirmar o nome na criação local

Issue canônica [#4](https://github.com/vinnigump/church_manager_frontend/issues/4),
Eventos / FE-04, prioridade não definida. Data: 2026-11-07 UTC.
Branch `codex/fe-04-local-type-confirmation`, base `86f0821`.
Responsável: agente da atividade, papéis sequenciais; revisão independente pendente.

## Problema e correção

O cliente confirmava criação local com escopo/flags válidos mesmo quando o nome
retornado era diferente do enviado. Isso podia exibir sucesso e limpar o campo
sem confirmar o resultado solicitado. A criação denominacional já conferia o nome.

Contrato real `event-type-catalog-v1.openapi.json` 1.0.0 e
`EventTypeCatalogService.createLocal` conferidos na ref integrada28ea26d:
o servidor retorna o nome recebido, com remoção das extremidades. O cliente
já envia `name.trim()`; agora exige igualdade com esse mesmo valor ao confirmar.
Não altera a normalização, payload, endpoints, nome em leituras legadas ou
regras do catálogo. Resposta divergente segue o tratamento existente de
resultado incerto; o nome digitado permanece para conferência e não há retry
automático. Não adiciona bloqueio de reenvio manual que não existia no fluxo.

## Critérios do incremento

Não representa o inventário integral da issue #4.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| NOME-01 | Não confirmar nome divergente/vazio na resposta de criação | PASSOU | Dois casos parametrizados de LocalTypeManagement.test.tsx |
| NOME-02 | Não mostrar sucesso nem limpar campo ou reenviar automaticamente | PASSOU | Caso de resposta divergente no fluxo de catálogo |
| NOME-03 | Preservar criação válida, trim, permissões, Basic/CSRF e isolamento | PASSOU | Regressão completa e testes de escrita local existentes |
| NOME-04 | Ensaio da correção com backend vivo | NAO_TESTADO | Respostas controladas de contrato |

## Testes, revisão e decisão

Node24/Windows/Vitest5.1.0. `npm ci`, lint, typecheck, testes, build e
`git diff --check` executados neste worktree. Antes da correção, três novos
casos falharam entre24 testes do arquivo, reproduzindo a lacuna. Após a
correção, **653 testes em32 arquivos passaram**, sem ignorados. São3 casos
novos, além dos650 integrados na base. Lockfile/dependências inalterados.

Revisão estática sequencial sem achados críticos/altos remanescentes; parecer
independente PENDENTE. Não é alegação de resposta defeituosa do backend vivo.
Sem mudança visual; caso necessária, a ativação será solicitada ao usuário.
Sem backend/infraestrutura, merge, deploy, armazenamento ou exposição de credenciais.

PODE_CONCLUIR: NAO — a issue #4 permanece parcial e o aceite humano está pendente.
Próxima ação: PR draft, CI do head final e revisão externa.

```yaml
atividade: FE-04-LOCAL-TYPE-CONFIRMATION
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 4
criterios_comprovados: 3
testes_aprovados: 653
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [backend_vivo_nao_ensaiado, revisao_independente, aceite_humano]
proxima_acao: Conferir CI e revisao do head final
pode_concluir: false
aceite_humano: PENDENTE
```

## Atualização da base — 2026-11-07 UTC

PR #61 / issue #4. Base f72b9fec225c4ca0a41401f2bceb13330b63d6de incorporada
sem conflito, preservando planejamento e auditoria. Diff funcional próprio permanece
na confirmação de nome. Lint, typecheck, 741 testes/35 arquivos, build e diff --check
passaram novamente. Sem alterações de dependências, lockfile ou timeout.
Revisão estática sequencial sem críticos/altos; revisão independente/aceite humano
pendentes. CI novo head registrado no PR. Validação visual dispensada pelo usuário
como requisito dos PRs; registros anteriores são históricos, não PASSOU.
Backend vivo não ensaiado. Sem merge em main, deploy ou infraestrutura.
