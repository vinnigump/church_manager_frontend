# FE-04 — janela administrativa de inscrição

Issue canônica: https://github.com/vinnigump/church_manager_frontend/issues/4.
Módulo Eventos; épico FE-04; prioridade conforme backlog; responsável Codex;
data UTC 2026-11-08; branch `codex/fe-04-registration-window`.
Base frontend a58e2a8 (PR88 integrado); backend
efc5990003534c72b7a2b55db100e08edbdf7a23 (PR121 integrado).
SHA final e CI registrados no PR; este relatório precede o commit.

## Implementador

AGENTS, README, papéis, governança, issues4/5 e contrato real relidos. Revisões
externas dos PRs88/121 conferidas: ambos integrados; sem PR aberto dependente.
Contrato `event-registration-window-v1`1.0.0 e serviço/DTOs de121 são a autoridade.

Rota administrativa a partir do detalhe autorizado da ocorrência. GET da janela
seguido do detalhe, EVENT_VIEW contextual; revisões precisam coincidir para
exibir editor. Não se presume snapshot transacional entre endpoints. Escritas
exigem EVENT_EDIT, confirmação, CSRF e X-Expected-Revision original. PUT envia
somente opensAt/closesAt; DELETE explícito sem corpo remove os dois limites.

Legado mantém campos vazios; ausência não é janela pública ilimitada. PUT apenas
para REGISTRATION_REQUIRED, abertura anterior ao fechamento<=início. Texto com
fuso explícito reutiliza validação de instantes existente e comparação bigint
em nanos para não perder microssegundos; offsets equivalentes são no-op.
Não converte hora local, não arredonda datas e não restringe edição a DRAFT
quando o contrato não impõe isso. Remoção preserva ocorrência/inscrições.

O rascunho/revisão original e trava de tentativa permanecem acima do guard.
Foco revalida acesso e desfaz confirmação; mudança de revisão exige descarte
explícito. Uma tentativa não é repetida automaticamente, inclusive após erro
ou resposta incompatível. Resultado incerto exige nova consulta. Troca de
conta/igreja/ocorrência aborta cliente e ignora resposta antiga, sem prometer
rollback do servidor. Nenhuma credencial/dado persiste em storage.

Sem alterações de capacidade, audiência, modo, publicação, inscritos, presença
ou APIs públicas. Inscrição pública/admin em andamento, fila, menores e correção
terminal continuam dependendo do orquestrador; esta entrega não conclui #4/#5.
Auditoria existente já aceita EVENT_OCCURRENCE com as ações CONFIGURED/CLEARED
do backend; não requer novo filtro nem concessão de auditoria ao editor.

## Testador

Windows, Node24.22.1, npm. `npm ci`, `npm run lint`, `npm run typecheck`,
`npm test`: PASSOU, 1329 aprovados em50 arquivos,0 falhos/ignorados;55 novos.
Primeira execução direcionada teve54/55: asserção esperava mensagem interna
que useRead sanitiza. Corrigida para verificar mensagem segura existente e
ausência de editor/escrita. Suíte completa posterior passou55/55 novos.
Build e diff final: resultado registrado no PR após execução.

| ID | Critério do incremento | Resultado | Evidência |
| --- | --- | --- | --- |
| W01 | Legado ausente e projeção sem dados privados | PASSOU | API/UI, campos vazios, sem defaults |
| W02 | Datas explícitas/fuso/microssegundos e fechamento inclusivo | PASSOU | ordem, igualdade, offset, precisão, limite no início |
| W03 | GET/PUT/DELETE, confirmação, revisão, no-op | PASSOU | corpo/headers, remoção sem corpo, revisões0/+1 |
| W04 | Identidade/permissão/CSRF/contexto | PASSOU | VIEW sem EDIT, PUBLISH sem EDIT, EDIT sem VIEW, CSRF real do cliente, URL inválida |
| W05 | Concorrência, tentativa única e resposta incerta | PASSOU | GETs divergentes, foco/revisão, duplo clique, HTTP403/409/422/500, resposta incompatível |
| W06 | Revogação e troca de contexto | PASSOU | VIEW negado oculta dados; abort/late response |
| W07 | Inscrição/ocupação/fila e backend vivo | NAO_TESTADO | fora deste incremento; APIs de orquestração ainda ausentes |

Testes HTTP simulados comprovam comportamento do cliente, não execução real do
backend. Teste vivo não necessário para este incremento; visual dispensado
por orientação do usuário, Run local não solicitado automaticamente.

## Revisor

Revisão técnica sequencial do mesmo agente: sem achados críticos/altos no escopo
inspecionado; não substitui revisão independente nem aceite humano. Conferidos
DTOs, no-op por instante, revisão compartilhada, isolamento/CSRF, sanitização de
erros e ausência de inscrição simulada. Revisão independente PENDENTE.

PODE_CONCLUIR: NAO. Entrega parcial da4; próximo passo: CI/revisão independente
e outra demanda autorizada sem depender deste PR. Sem merge/deploy.

```yaml
atividade: FE-04-REGISTRATION-WINDOW
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 7
criterios_comprovados: 6
testes_aprovados: 1329
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: ["Orquestrador de inscrição fora do incremento"]
proxima_acao: "CI/revisão externa e continuidade independente"
pode_concluir: false
aceite_humano: PENDENTE
```
