# FE-04 — despublicação, cancelamento e conclusão de ocorrências

Issue canônica frontend #4; Eventos / FE-04, prioridade não definida.
Branch `codex/fe-04-occurrence-transitions`, base frontend `f72b9fe`.
Data 2026-11-07 UTC. Implementação/testes/revisão estática sequenciais pelo
mesmo agente; revisão independente e aceite humano PENDENTES.

## Implementador

Backend integrado `9e14094f0b84ae09e97873c2f0b594e22e703d44`, PR #100:
`event-lifecycle-v1.openapi.json` 1.0.0, `EventLifecycleController`,
`EventLifecycleService`, `EventPublicationService`, `OccurrenceLifecyclePolicy`.
DTO real de despublicação/cancelamento/conclusão contém churchId (inspecionado
no serviço), além de id/status/revision. Projeção descarta extras.

Detalhe autorizado oferece links separados conforme estado e permissão.
Rota `/eventos/igrejas/:churchId/ocorrencias/:occurrenceId/transicoes/:action`
aceita exclusivamente unpublish/cancel/complete. EVENT_VIEW e permissão própria
são exigidos antes do GET: respectivamente EVENT_PUBLISH, EVENT_CANCEL e
EVENT_EDIT. Guardas são UX; backend reautoriza cada operação real.

Confirmação explícita usa snapshot/revisão do detalhe recém-consultado.
POST sem corpo, CSRF do cliente compartilhado, X-Expected-Revision numérico.
Servidor decide horário, validade e reconciliação; não usa relógio do navegador
para conceder transição nem altera estado local por timer. Cancelamento afeta
somente ocorrência, não encerra série. Despublicação não altera calendário e
preserva marco de publicação/configuração imutável. Conclusão não apaga presença.
Estados legados não são convertidos, terminais não oferecem reabertura.

Sucesso exige contexto, ID, estado alvo e revisão compatível com serviço real.
Conclusão de PUBLISHED admite +1 ou +2 porque o servidor pode reconciliar início
e término antes da conclusão; IN_PROGRESS incrementa uma vez. Repetições de alvo
já atingido suportadas no contrato preservam revisão. Após sucesso, nova
autorização e leitura; erros/resposta incerta bloqueiam repetição até atualização
explícita. Trava acima das guardas conserva envio em foco/recheck, confirmação
transitória é descartada; contexto desmontado aborta requisição. Sem storage,
grants cacheados, replay, dados de participantes ou novos endpoints inventados.

**Dependência real de publicação:** backend #52 exige exatamente um coordenador
formal ativo da própria igreja antes de publicar. O gate foi desenvolvido no
PR #110 ainda não integrado na referência usada. Não oferecer POST publish nem
exceções críticas antes dessa integração e de contrato de seleção/prova suficiente.
Esta atividade não conclui publicação, equipe, recorrência ou toda a issue #4.

## Testador

Node24/Windows, npm ci executado nesta worktree; lockfile inalterado.
Lint/typecheck/npm test/build/diff --check passaram. **792 testes/36 arquivos**,
54 novos contra base 738. Nenhum ignorado/timeout alterado.
Primeiro ensaio de 49 novos: 46 passaram/3 falharam por observar texto antigo
antes do efeito de leitura; corrigido para aguardar estado confirmado específico.
Depois adicionados cenários de perda de acesso/contexto/entrada autorizada.
Typecheck identificou opção `exact` indevida nos locators Testing Library;
removida (name string já é exato); 52 direcionados e build passaram, depois
54 e regressão integral 792 passaram com typecheck/lint.
Build executado após correção de tipos; os dois testes finais só ampliam cobertura.
CI do head publicado deve ser registrado no PR. Respostas controladas/jsdom,
backend vivo não ensaiado; testes não comprovam execução PostgreSQL desta sessão.
Validação visual dispensada como requisito dos PRs por instrução atual do usuário.

| ID | Critério do incremento | Resultado | Evidência |
| --- | --- | --- | --- |
| TRANS-01 | Permissões próprias, leitura e contexto antes da operação | PASSOU | negações por ação, negação de VIEW, contexto inválido, links autorizados |
| TRANS-02 | Confirmação, CSRF, revisão e resposta contextual | PASSOU | três fluxos e casos de contrato/revisão/no-op/reconciliação |
| TRANS-03 | Sem reabertura, conversão de legado ou publicação sem gate | PASSOU | OPEN/CLOSED/terminais, ação publish inválida, detalhe sem link publish |
| TRANS-04 | Foco/concorrência/erros sem repetição e isolamento | PASSOU | trava pendente, cinco erros HTTP, resposta incompatível, perda de permissão, troca de igreja |
| TRANS-05 | Publicação com equipe e exceções críticas | NAO_TESTADO | depende backend #52/PR #110; não incluída neste incremento |

## Revisor

Inspeção estática sequencial: rotas, allowlist, guardas, snapshot, payload,
headers, projeção, aborto, erro e estado após resposta. Sem achados críticos/altos
remanescentes próprios. Não equivale a parecer independente ou aprovação humana.
Riscos/limites: relógio/estado podem mudar entre leitura e comando; servidor
responde conflito/estado incompatível, exigindo conferência. Ambiente real não
ensaiado. Publicação bloqueada pela dependência citada. Nenhum merge em main,
deploy, alteração backend/infraestrutura ou operação no banco do usuário.

PODE_CONCLUIR: NAO para a issue canônica. Incremento EM_REVISAO; próxima ação:
CI/revisão e Run local conforme orientação do usuário; retomar publicação após gate.

```yaml
atividade: FE-04-OCCURRENCE-TRANSITIONS
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 792
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [publicacao_depende_gate_equipe_backend_110, revisao_independente, aceite_humano]
proxima_acao: Conferir CI e revisao; solicitar Run local; retomar publicacao apos gate integrado
pode_concluir: false
aceite_humano: PENDENTE
```
