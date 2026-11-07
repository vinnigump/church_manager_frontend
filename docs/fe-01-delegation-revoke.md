# FE-01 — revogar fonte de delegação

Base dce6cd7, com #43 e #42 integrados externamente. Contrato delegations-v1 1.1.0,
DelegationController, AuthenticatedAccessManagementService e AccessManagementService
do backend origin/master conferidos. POST /delegations/{id}/revoke sem corpo,
X-Expected-Revision lógico, resultado id/revision/status. Serviço exige ACTIVE,
incrementa revisão, grava REVOKED e audita sob controle transacional.

Rota autenticada /seguranca/denominacoes/:denominationId/delegacoes/:delegationId/
revogar exige security:assignment:manage/DENOMINATION antes de carregar a fonte.
O detalhe oferece link apenas após essa permissão e estado registrado ACTIVE.
Consultar a própria fonte pelo GET não dá permissão de revogação. Não há redelegação
ou criação de fonte nesta entrega.

Confirmação identifica fonte/delegado, permite cancelar e explica perda da validade
da fonte nas operações delegadas e preservação do histórico. Não calcula efeitos
de autorização no cliente, não promete remoção física nem revogação nominal de
outras atribuições. O servidor permanece autoridade nas decisões posteriores.

Resposta validada por ID, REVOKED e incremento de revisão. Sem atualização otimista;
sucesso remonta a guarda para reautorizar e consultar dados. Falhas bloqueiam novo
comando até atualizar dados/permissão; rede/5xx/schema não são declarados sucesso.
Sem retry automático, armazenamento de credenciais ou corpos brutos em mensagens.

Controle de envio/bloqueio/aborto/reconciliação extraído do fluxo integrado de
revogação de atribuições para useSecurityCommand e reutilizado por ambos. Fica
acima da guarda e mantém trava síncrona durante reconsulta por foco. Desmontagem
aborta e ignora resposta tardia. Não houve alteração na política dos comandos.

Implementador/Testador/Revisor sequenciais pelo mesmo agente. Revisão conferiu
autorização central separada da consulta própria, confirmação, protocolo, resultado
e regressão da atribuição. Lint/typecheck/528 testes (14 novos sobre base 514)/build/
diff --check passaram. npm ci nesta sessão, lockfile intacto. Testes controlados;
backend vivo/visual/AT pendentes. Browser Use recusou origem local; sem contorno.
Não homologa UI-RIO. Sem merge/deploy/infraestrutura; arquivos locais preservados.
