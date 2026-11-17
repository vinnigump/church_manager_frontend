# Grupos — arquivamento e histórico, rodada03

Regra posterior aprovada pelo usuário: excluir definitivamente apenas nunca
utilizados; utilizados arquivar; saída de integrante preserva tarefas e executor.
BackendV36 é dependência explícita ainda não integrada ao iniciar esta branch.
Preparação isolada autorizada pelo coordenador; não ativar antes da API integrada.

Implementado na tela existente: estado Arquivado; confirmações de arquivar,
excluir sem uso e remover integrante; histórico opcional de saídas; inclusão
oculta para arquivados. Nome/descrição seguem editáveis. API é a autoridade sobre
uso/referências; erro não autoriza cascata nem exclusão forçada. Sem ação de
reatribuição, sem regra nova de saída de ministério/departamento.

Reutiliza CHURCH_GROUP_MANAGE. Escritas enviam revisão; falha ambígua bloqueia
repetição até conferir dados. Atualização explícita é bloqueada enquanto escreve.
Nenhum dado de integrante vai para storage/log. Arquivamento conserva trilhas já iniciadas e tarefas já
existentes, incluindo assunção por integrante ativo e conclusão por executor.

PASSOU lint e build TypeScript/Vite Node24. Logs workspace
output/parallel_mvp/round03/organization/group-frontend-{lint,build}.log.
Sem novos unitários/execução local por instrução do usuário. Sem prova funcional
integrada/visual; CI e revisão root pendentes. Não conclui issue/MVP.

Próxima ação: integrar backendV36 apósV33, confirmar contrato final, abrir/revisar
PRfrontend e integrar só apósAPI. Sem deploy.
