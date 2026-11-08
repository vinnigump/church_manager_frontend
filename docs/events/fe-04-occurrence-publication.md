# FE-04 — publicação de ocorrência sem exceção crítica

Issue canônica frontend #4, Eventos / FE-04; prioridade não definida.
Data: 2026-11-08 UTC. Branch: codex/fe-04-occurrence-publication.
Base integrada: 0f6871e98c649cf6d1529f16969cd0a9441cd881.
Responsável: agente implementador/testador em etapas sequenciais;
revisão independente e aceite humano PENDENTES. SHA e CI finais no PR.

## Implementação e contrato

Contrato integrado backend event-lifecycle-v1 1.1.0, ref
08430212d93e86e0a30d566dff1b3c6635b4fee0, EventPublicationService,
EventLifecycleService e gate de equipe. A ação do detalhe usa EVENT_VIEW e
EVENT_PUBLISH próprios, sem herdar EVENT_EDIT. Rascunho configurado exige
confirmação sobre a revisão consultada; POST /events/churches/:church/occurrences/:id/publish
envia JSON {overrides:[]}, CSRF e X-Expected-Revision pelo cliente existente.

Servidor exige exatamente um coordenador não liberado, com membresia formal ativa
da igreja e pessoa ativa. A tela não conta coordenadores em uma página parcial
nem substitui a validação transacional. Revalida disponibilidade do tipo, equipe,
conflitos, permissões e horários. Resultado não contém churchId: a projeção usa
contexto validado do pedido e ID global exato. Confere três flags booleanas e
PUBLISHED/revisão+1 ou IN_PROGRESS/COMPLETED/revisão+2, incluindo reconciliação
automática. Relê ocorrência após sucesso e apresenta estado efetivo/alertas.
Republicação de DRAFT preserva firstPublishedAt no servidor.

Foco invalida confirmação e reautoriza; trava de envio permanece acima das guardas.
Erro não vira sucesso nem replay automático; atualização explícita consulta estado
e acesso antes de outra tentativa. Mudança de conta/igreja/ocorrência/ação aborta e
descarta resposta antiga conforme fluxo existente. Nenhum armazenamento persistente.

## Limite funcional específico

Publicação normal está integrada. A tela não solicita EVENT_CONFLICT_OVERRIDE nem
justificativas. A consulta atual /space/conflicts avalia o DRAFT atual, sem avaliação
autoritativa da proposta PUBLISHED; não inferir conjunto crítico/revisões exigidas
a partir dessa classificação. O servidor rejeita conflito crítico sem provas.
Há aviso antes da confirmação e link ao planejamento autorizado para correção.
Uma futura interface de exceções precisa da avaliação autoritativa apropriada;
essa pendência não impede publicação sem conflitos críticos ou outras atividades.
Não abre inscrições/check-in, não publica calendário, não altera série/template.

## Testador — evidências reais

Node 24.22.1 / Windows. npm ci executado nesta worktree; dependências não alteradas.
Execução direcionada: 90 testes em dois arquivos, incluindo 36 novos casos de
OccurrencePublication.test.tsx. Após incorporar main/cópia78 sem conflitos:
npm run lint, npm run typecheck, npm test, npm run build e git diff --check passaram.
Regressão: 1020 testes / 42 arquivos, zero falhas e ignorados.
Composição anterior geração75+cópia78 também verificada em snapshot isolado:
984 testes / 41 arquivos, lint/typecheck/build/diff passaram; snapshot não publicado.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| PUB-01 | Leitura/publicação próprias e DRAFT configurado | PASSOU | negações, detalhe, configuração e seis estados recusados |
| PUB-02 | Payload sem exceções, CSRF, revisão e resposta estrita | PASSOU | três resultados, flags inválidas, ID/estado/revisão incompatíveis |
| PUB-03 | Confirmação, foco e trava sem replay/falso sucesso | PASSOU | envio duplo, reautorização, revisão nova, HTTP403/409/422/500 |
| PUB-04 | Republicação e resultado reconciliado/alertas | PASSOU | primeiro marco existente e três estados efetivos |
| PUB-05 | Equipe/conflitos reais em backend vivo | NAO_TESTADO | testes isolados com fixtures e inspeção do serviço integrado |

Validação visual dispensada como requisito de PR. Run local somente se houver
necessidade concreta, conforme instrução atual do usuário; não solicitado por rotina.

## Revisão e decisão

Revisão estática sequencial: sem achados críticos/altos identificados no diff.
Não equivale a revisão independente. Backend continua autoridade; falha de rede pode
ocorrer após commit e exige consulta antes de nova tentativa. CI final registrado no
PR. Sem merge em main, deploy ou alteração de infraestrutura/dados do usuário.
Próxima ação: conferir CI/revisão e continuar demanda independente.
PODE_CONCLUIR issue #4: NÃO; escopo parcial, aceite humano pendente.

```yaml
atividade: FE-04-OCCURRENCE-PUBLICATION
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1020
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI e revisao; continuar demanda independente
pode_concluir: false
aceite_humano: PENDENTE
```
