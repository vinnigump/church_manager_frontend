# FE-01 — revogação de atribuição pelo contexto da fonte

Base 1675e04 com #44/#45 integrados externamente. Revalidados assignments-v1 1.2.0,
AssignmentController/AssignmentReadService, AuthenticatedDelegatedAssignmentService,
AccessManagementService e DelegationScopePolicy em backend origin/master.

O detalhe contextual oferece /seguranca/denominacoes/:denominationId/delegacoes/
:delegationId/atribuicoes/:assignmentId/revogar quando o estado registrado é ACTIVE.
GET autorizado deve confirmar a fonte do DTO antes de oferecer o comando. Não exige
security:assignment:manage denominacional ao delegado; essa permissão permanece
obrigatória na rota central, que não foi ampliada.

Reutiliza AssignmentRevokePage, confirmação e useSecurityCommand integrados. A
leitura local usa readDelegatedAssignment e verifica origem. Ao foco recarrega os
dados/política pelo GET, ocultando a consulta anterior. Foco não limpa o bloqueio de
falha nem permite duplicar comando pendente. Atualização explícita reconsulta antes
de habilitar tentativa; sucesso reconcilia via GET. Desmontagem aborta/descarta.

POST /assignments/{id}/revoke continua sem corpo e com X-Expected-Revision/CSRF.
Não envia ator, capacidade nem fonte fabricada. Servidor escolhe política central
se houver permissão efetiva; caso contrário exige ator delegado, mesma origem,
autoria da concessão e fonte ainda utilizável. Revogada/expirada, perfil inválido,
origem alheia ou estado/revisão conflitante são decisões do servidor. Conhecer a
fonte ou consultar seus metadados não torna o usuário gestor.

Não implementa concessão ou seleção de destinatário. Continua pendente descoberta
contextual de contas: userId é UserAccount, não Person; a API técnica de criação
de conta não é um catálogo autorizado de destinatários denominacionais.

Papéis sequenciais pelo mesmo agente. Revisão verificou manutenção da guarda
central, origem, trava, confirmação, concorrência, CSRF e descarte. Lint/typecheck/
548 testes (8 novos sobre base540)/build/diff --check passaram, incluindo regressão
central existente. npm ci nesta sessão, lockfile intacto. Testes controlados;
Após integração externa de #46, conciliação em ca29aff preservou auditoria,
separação das rotas e identidade integrada. Lint/typecheck/566 testes/build/
diff --check passaram; atendido o pedido de conciliação da revisão externa.
backend vivo/visual/AT pendentes. Browser Use recusou origem local, sem contorno.
Identidade integrada preservada, sem homologar novas telas UI-RIO. Sem merge/deploy.
