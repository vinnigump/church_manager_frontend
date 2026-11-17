# FE-V4-STANDALONE-TASKS — rodada02

Issue frontend #2 / backend #67 e mestre #64. Base frontend 28f6508 (#113).
Pré-requisito integrado: backend #174 / 080d432630b1dee90105be931c73954c99f7f991.
Contrato real work-items-v1, sem endpoints simulados em produção.

Entrega: Início → Minhas tarefas, fila pessoal filtrada/paginada, detalhe,
Assumir/Concluir conforme flags atuais do servidor. Gestão secundária por igreja
descoberta/autorizada: listar, criar para Usuário/Grupo/Ministério/Departamento,
atribuir coletivo a integrante retornado pelo seletor e concluir administrativamente.
Nenhum menu principal extra, UUID digitado ou seletor global obrigatório.

Cadastro individual já nasce com responsável. Coletivo permite assunção/atribuição,
sem obrigar Iniciar/aceite. Títulos/instruções são texto simples. Conta e diretórios
continuam autoridade de escopo; associação não concede RBAC. TASK_VIEW/CREATE/
ASSIGN/COMPLETE_ADMIN negados por padrão, sem concessão automática a perfis.

Preserva CSRF/cliente de autenticação, revisão original e requestId de criação.
Trava impede envio simultâneo. Falha exige conferir dados antes de repetir;
foco revalida consulta/permissões sem soltar trava ou substituir a revisão do
comando pendente. Sessão/rota diferentes abortam e descartam respostas anteriores.
Conclusão sem vínculo vigente exige regularização conforme backend. Histórico
administrativo é distinguido; nenhuma presença/resposta/membresia é produzida.

Validação local: lint, typecheck e build PASSOU. Unitários novos não foram criados
nem executados localmente, conforme instrução expressa. Testes/CI existentes
preservados. Fluxo visual/E2E desta interface: NAO_TESTADO nesta entrega.
Logs do workspace pai output/parallel_mvp/round02/tasks/frontend-*.log.
Bundle mantém aviso de tamanho conhecido, sem erro de build.

Revisão central/CI no PR; root autorizado a integrar após checks. Sem deploy.
Limites: avulsas somente; sem edição/reabertura/reatribuição, avanço de trilhas ou
questionários nesta tela. Próxima integração será work_item vinculado a etapa,
com conclusão automática da trilha, em contrato próprio (V33).
