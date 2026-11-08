# FE-04 — liberação de atribuição da equipe

Issue canônica frontend #4 (parcial), Eventos / FE-04; backend EVT-030/#52.
Prioridade frontend não definida. Responsável: agente em etapas sequenciais de
implementação/teste/revisão estática, sem revisão independente.
Data 2026-11-08 UTC; branch codex/fe-04-occurrence-team-release,
base integrada 5bb7080492a352b3bbf8e7ef1030d6de36e7cfc5 (PRs80/81).
SHA final e CI registrados no PR. Revisão/aceite humano PENDENTES.

## Implementador

Contrato event-team-v1 1.0.0, controlador/serviço e documentação EVT-030
inspecionados no backend integrado08430212d93e86e0a30d566dff1b3c6635b4fee0.
DELETE /events/churches/:church/occurrences/:id/team/:assignment exige
EVENT_EDIT local, CSRF e X-Expected-Revision compartilhada com a ocorrência.
Não adiciona corpo nem remove linha histórica. Backend revalida autorização,
contexto e revisão; mudança incrementa revisão, repetição já alcançada é no-op.

Na consulta de equipe, EVENT_VIEW protege leitura; EVENT_EDIT próprio protege
liberação. EVENT_PUBLISH não concede edição. Somente atribuição não liberada
da página validada oferece confirmação; inelegibilidade não impede liberação.
Aviso explica efeito sobre futura publicação, sem alterar membresia, presença
ou permissões. Não cria restrição por estado da ocorrência inexistente na API.
POST de inclusão e seleção de novas membresias permanecem fora deste incremento;
descoberta autorizada de membresias ainda sem contrato confirmado.

Cliente valida UUIDs/contexto, seleção/revisão do snapshot, ocorrência/atribuição
exatas no resultado e revisão igual ou +1; projeta DTO sem extras. Após resposta
confirmada, reautoriza e relê histórico. Confirmação desaparece ao reconsultar
ou trocar revisão. Comando/trava acima das guardas sobrevive a foco/reautorização;
envio duplo produz uma escrita. Erro HTTP/rede/resposta incompatível não confirma
sucesso e bloqueia novas escritas até atualização explícita e nova consulta.
Troca de contexto aborta/ignora resultado atrasado, sem prometer rollback remoto.
Sem storage, nomes/contatos inventados ou credenciais em logs.

## Testador

Node24.22.1/Windows. npm ci, npm run lint, npm run typecheck, npm test,
npm run build e git diff --check passaram. 1079 testes/44 arquivos,
26 novos casos. Primeira rodada direcionada57/2 arquivos passou, seguida da
regressão completa com os dois casos adicionais de resultado incerto e contexto.
Fixture histórica de leitura ajustada para conceder somente EVENT_VIEW; antes
ela concedia qualquer código solicitado e não distinguia permissão de edição.
Nenhuma falha/ignorado final; dependências/lockfile não alterados.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| TEAM-D01 | Leitura/edição próprias e seleção não liberada | PASSOU | VIEW/PUBLISH não editam, EDIT não lê, inelegível pode liberar |
| TEAM-D02 | Confirmação/CSRF/revisão e DTO estrito | PASSOU | DELETE sem corpo, no-op/+1, contexto/revisão incompatíveis |
| TEAM-D03 | Preserva histórico e relê após sucesso | PASSOU | item liberado permanece no total e não oferece nova ação |
| TEAM-D04 | Trava/erro/foco/contexto sem replay | PASSOU | envio duplo, HTTP403/404/409/422/500, resposta inválida e aborto |
| TEAM-D05 | Liberação em backend vivo | NAO_TESTADO | fixtures/jsdom e inspeção do serviço; sem teste vivo |

Validação visual dispensada como requisito de PR. Run local não solicitado por
rotina, conforme instrução posterior do usuário; somente quando necessário.

## Revisor e decisão

Revisão estática sequencial sem achados críticos/altos identificados. Não equivale
a revisão independente; parecer independente PENDENTE. Estado pode mudar após
consulta e revisão antiga será rejeitada pelo backend. Falha de rede pode acontecer
depois do commit; consultar antes de repetir. Sem merge em main/deploy/infraestrutura.
Próxima ação: conferir CI/revisão e reanalisar demandas independentes/contratos novos.
PODE_CONCLUIR issue #4: NÃO, escopo parcial e aceite pendente.

```yaml
atividade: FE-04-OCCURRENCE-TEAM-RELEASE
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1079
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao e reanalisar demandas independentes
pode_concluir: false
aceite_humano: PENDENTE
```
