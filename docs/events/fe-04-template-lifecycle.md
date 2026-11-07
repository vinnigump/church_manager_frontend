# FE-04 — gestão do ciclo de templates denominacionais

## Implementador

Issue #4, branch codex/fe-04-template-lifecycle, base origin/main 7de2ed7.
Antes de iniciar: PRs #22/#23 confirmados merged por ação externa, comentários de
revisão favoráveis lidos e CIs 42376231710/42376486532 confirmadas success.
Resumos locais não rastreados preservados.

Lidos AGENTS, README, papéis, execução Eventos, issue #4/reconciliação e comentários
(sem novos), OpenAPI event-template-version-v1 1.0.0 completo, EVT-006,
EventTemplateVersionController/Service. Contratos usados sem diff contra origin/master.
Reutilizados Basic/CSRF/cookies, ResourceAccess, DTOs e páginas do PR #22 integrado.

Comandos no recurso /events/denominations/{denominationId}/types/{typeId}:
- POST /draft: sem corpo, X-Expected-Revision do template.
- PUT /draft: somente name, X-Expected-Revision do rascunho.
- POST /publish: draftVersionId e expectedDraftRevision, header da revisão do template.
- POST /discontinue: sem corpo, header da revisão do template.

Não usa If-Match, ator/permissões no corpo ou concessões locais. Todas as ações
exigem EVENT_TEMPLATE_MANAGE/DENOMINATION e o backend reautoriza cada escrita.
Helper valida estado/revisões/IDs e confirma resposta do mesmo template; publicação
confere ponteiro para o rascunho solicitado. Não se altera uma versão publicada.

UI oferece novo rascunho quando publicado sem draft; edição/publicação quando há
rascunho e template não terminal. Descontinuado não tem ações. Publicação exige
nome salvo e confirmação mostrando versão/nome. Descontinuação exige confirmação
e explica irreversibilidade e preservação de histórico/ocorrências.

Hook de escrita fica acima da guarda, com trava por ref contra duplo envio mesmo
em reconsulta por foco. Troca de conta/recurso desmonta o workspace, aborta transporte
e ignora resultado antigo. Abort não afirma cancelar transação do servidor.
Sucesso exige resposta validada e dispara GET independente de detalhe/histórico.
Falhas 4xx ou resultado incerto (rede/5xx/schema) não repetem a operação. Nova escrita
fica bloqueada até Atualizar template; se a leitura falhar, controles não aparecem.
Mensagem confirmada não é convertida em falha caso a reconciliação GET falhe.

## Testador

npm ci passou; sete moderados existentes reportados, sem mudar package/lockfile.
Lint, typecheck, 272 testes (31 novos + 241 da base integrada), build e diff --check
passaram. Uma primeira verificação de tipos identificou nullability no servidor
sintético do teste; corrigida antes da suíte final, sem alterar regras de domínio.

Casos: quatro métodos/rotas, payloads e revisão exatos, Basic/CSRF/cookies/no-store,
ausência de If-Match, CSRF ausente, estado terminal, nome inválido, publicação sem
draft, resposta incompatível, ciclo completo, confirmação/cancelamento, nome não
salvo, acesso negado, 401 com AuthProvider, 400/403/404/409/422, rede/500/schema,
trava durante foco e escrita tardia em outra denominação. Testes de consulta existentes
passam com controles autorizados e continuam assegurando ausência de escrita automática.

Respostas controladas conforme contratos; sem backend vivo, banco real, ensaio visual
ou tecnologia assistiva. Nenhuma escrita contra dados de uso. CI remota conferir no PR.

## Revisor

Papéis sequenciais no mesmo agente; sem revisão independente. Revistos concorrência,
isolamento, negação por padrão, revisões e preservação dos snapshots publicados.
Não foi identificado achado crítico/alto. Parecer favorável com ressalvas de ensaio
ponta a ponta/visual/AT pendentes. Aprovação humana do PR pendente.

Entrega parcial da #4; não inclui criação inicial de template nem calendário/ocorrências.
Sem merge/deploy. Após abrir o PR, seguir demanda independente e reconsultar este PR
antes da próxima atividade, conforme orientação vigente do usuário.
