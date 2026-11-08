# FE-04 — consulta da equipe operacional

Issue canônica frontend #4 (incremento parcial), Eventos / FE-04; backend EVT-030/#52.
Prioridade frontend não definida. Responsável: agente em etapas sequenciais de
implementação/teste/revisão estática; revisão independente PENDENTE.
Data 2026-11-08 UTC, branch codex/fe-04-occurrence-team-read,
base 0f6871e98c649cf6d1529f16969cd0a9441cd881. SHA/CI finais no PR.

## Implementador

Inspecionados event-team-v1 1.0.0, EventTeamController/Models/Service e
docs/events/evt-030-operational-team.md da ref backend integrada
08430212d93e86e0a30d566dff1b3c6635b4fee0. Rota /ocorrencias/:id/equipe,
entrada no detalhe já protegido. EVENT_VIEW na igreja antes do GET
/events/churches/:church/occurrences/:id/team?page=:page&size=20.
Reusa Basic em memória, ResourceAccess, useRead/ReadResult/Pagination e estilos.

Valida contexto/IDs, revisão, metadados e quantidade exata da página no snapshot,
papéis COORDINATOR/SUPPORT, instantes, ordem da liberação com precisão fracionária,
elegibilidade booleana e IDs únicos. Projeta somente DTO, sem nomes/contatos extras.
Liberação exclui elegibilidade; atribuição não liberada pode ser inelegível.
Exibe revisão compartilhada, atribuição/membresia, papel, datas e elegibilidade
informada pelo servidor. Total inclui histórico; nenhuma contagem global da equipe
ativa nem decisão de publicação é calculada de uma página parcial.

Página acima da guarda conserva paginação no foco; contexto conta/igreja/ocorrência
reinicia workspace. Guarda reautoriza, remove dados negados; useRead aborta e ignora
respostas antigas. Há loading, erro, atualização explícita e vazio legítimo.
Nenhuma escrita ou armazenamento persistente. A API de equipe não concede permissões.

Este incremento consulta o histórico inteiro paginado; não atribui/libera membros.
Liberação possui contrato e poderá ser implementada em atividade própria. Inclusão
precisa de seleção autorizada de membresias locais, ainda sem API de descoberta
confirmada; não introduzimos formulário de UUID nem inventamos pessoas/nomes.

## Testador

Node24.22.1/Windows: npm ci, npm run lint, npm run typecheck, npm test,
npm run build e git diff --check. Regressão 1017 testes /42 arquivos;
33 novos casos direcionados passaram, sem ignorados/falhas finais.
Primeira execução detectou seletor de teste com nome incorreto da paginação;
corrigido para o rótulo acessível existente "Próxima página" e execução repetida.
Backend vivo NAO_TESTADO; fixtures/jsdom comprovam cliente, não integração em execução.
Validação visual dispensada como requisito. Run local somente por necessidade concreta.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| TEAM-R01 | Leitura contextual EVENT_VIEW, negação e perda de acesso | PASSOU | URL inválida, autorização negada e remoção após foco |
| TEAM-R02 | Contrato estrito e projeção sem dados extras | PASSOU | metadados/IDs/papéis/datas/flags/duplicados incompatíveis |
| TEAM-R03 | Histórico, paginação, elegibilidade e vazio | PASSOU | papéis, liberação fracionária, página vazia e foco na página2 |
| TEAM-R04 | Erros não viram dados/sucesso | PASSOU | HTTP403/404/500 |
| TEAM-R05 | Histórico em backend vivo | NAO_TESTADO | inspeção do contrato/serviço; sem execução viva |

## Revisão e decisão

Revisão estática sequencial sem achados críticos/altos identificados. Revisão
independente e aceite humano PENDENTES; não se autoaprova. Elegibilidade pode mudar
após consulta; publicação exige nova validação backend. Sem merge em main/deploy.
Próxima ação: conferir CI/revisão e continuar liberação em atividade própria.
PODE_CONCLUIR issue #4: NÃO, escopo parcial e aceite pendente.

```yaml
atividade: FE-04-OCCURRENCE-TEAM-READ
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1017
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao; implementar liberacao em atividade propria
pode_concluir: false
aceite_humano: PENDENTE
```
