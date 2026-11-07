# FE-01 — revogação central de atribuições

Incremento dependente da consulta #39, integrada externamente em b36bf29.
Contrato assignments-v1 1.1.0, AssignmentController,
AuthenticatedAccessManagementService e AccessManagementService do backend
origin/master conferidos. POST /assignments/{id}/revoke não tem corpo, recebe
X-Expected-Revision e retorna id/status/revision. Serviço exige ACTIVE, incrementa
revisão e retorna REVOKED; servidor aplica isolamento, não escalada e recuperação.

Detalhe oferece /atribuicoes/:assignmentId/revogar para estado registrado ACTIVE.
Rota autenticada e ResourceAccess exigem security:assignment:manage/DENOMINATION;
não amplia leitura/revogação ao delegado sem essa permissão central. A origem
delegada de uma atribuição não transforma a sessão em gestora central.

Confirmação identifica atribuição/conta, permite cancelar e explica limite do
efeito. Não presume que outras atribuições sejam revogadas. Revisão lógica vem
do DTO, nunca do ETag. Resultado é validado/projetado; identidade, REVOKED e
incremento de revisão devem corresponder ao comando.

Trava síncrona e bloqueio de repetição ficam acima de ResourceAccess, sobrevivem
à reconsulta por foco. Sucesso reautoriza e recarrega antes de apresentar estado
novo; não há atualização otimista. Perda da própria permissão remove controles.
Falhas exigem atualizar atribuição e permissão; não repetem POST. Resultado incerto
de rede/5xx/schema não é declarado sucesso ou falha de domínio. Contextos antigos
são desmontados e requisições abortadas; respostas tardias não alteram outra tela.
Nenhum cálculo local tenta decidir o último acesso administrativo.

Papéis sequenciais pelo mesmo agente. Revisão conferiu protocolo, ausência de
corpo, CSRF, autorizações separadas, trava, reconciliação e mensagens sem corpo
bruto. Lint/typecheck/485 testes (13 novos sobre base 472)/build/diff --check passaram.
Após merge externo de #41, rebase em 67f431c preservou rotas e relatórios de ambos;
lint/typecheck/500 testes/build/diff --check passaram na base combinada.
Revisão humana apontou corrida na asserção de título do teste de senha no CI.
A mesma falha foi reproduzida durante a integração 1.2; a asserção passa a aguardar
o efeito de navegação, sem mudar o valor esperado ou regra de produto.
Rebase em 11b458a após integração externa de #43; lint/typecheck/514 testes/build/
diff --check passaram, preservando os fluxos de delegação e senha integrados.
npm ci já executado nesta sessão, dependências intactas. Testes controlados;
backend vivo e ensaio visual/AT não executados. Origem local recusada pelo Browser
Use, sem contorno. Não homologa UI-RIO. Sem merge/deploy/infraestrutura.
