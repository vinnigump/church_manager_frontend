# Grupos independentes — rodada02

Backend172 integrado em c9eb9dcbf09c164a3f5e219e41fcfe1b32bac34b antes do consumo.
Contrato church-groups-v1, CHURCH_GROUP_MANAGE contextual, sem grants automáticos.

Entrega: acesso secundário Grupos em Ministérios; igrejas autorizadas; pesquisa,
criação, consulta/edição e integrantes. Inclusão usa seletor de contas contextual
por nome, sem UUID digitado nem login/contatos globais. Grupo é independente de
ministério/departamento. Permissão conferida antes de montar as consultas.
CSRF/revisão, trava de comando, troca de sessão/igreja e reconciliação de erros
continuam no fluxo. Respostas são projetadas/validadas; nenhuma credencial persistida.

Exclusão/remoção de integrantes estão explicitamente indisponíveis: não inventar
cascata ou efeitos em tarefas/histórico. Não declarar CRUD completo.

Lint, typecheck e build locais aprovados. Por orientação posterior do usuário,
nenhum unitário novo ou executado localmente; CI existente preservado. Fluxos
novos ainda não foram executados funcionalmente. Revisão técnica root e resultado
do CI/SHA registrados no PR. Logs output/parallel_mvp/round02/organization.
Sem deploy ou reinício de aplicações. Issues64/65 não concluídas.
