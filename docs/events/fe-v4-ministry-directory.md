# FE-V4-MINISTRY-DIRECTORY

Issue backend #65 / mestre #64. Branch codex/v4-organization-ui.
Pré-requisito confirmado: backend #169 integrado em 130be28f5e767e04b2c07686499f6e5859acfcd5.
Contrato managed-ministry-units-v1 1.0.0 + self-authorization-contexts-v1 e
group-memberships-v1 já integrados. Nenhuma API pendente consumida.

Entrega: entrada Ministérios, seleção entre igrejas autorizadas, diretório com
pesquisa por nome/tipo e paginação no servidor; nomes, ministério pai e situação;
links aos vínculos existentes com retorno ao diretório. Sem UUID digitado.

GROUP_MEMBERSHIP_MANAGE/LED são apenas gate contextual do frontend. O backend
restringe LED à liderança exata antes de contar/paginar; LED sem atribuição pode
receber diretório vazio. Nova sessão, foco/revogação ou igreja invalidam dados.
Transporte simulado nos testes de cliente/componente; sem alegação de E2E visual.

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Descoberta por permissão/igreja sem concessão implícita | PASSOU | MinistryPages.test.tsx |
| Busca/paginação real e nomes/situação | PASSOU | mesmo teste + managed-units-api.test.ts |
| Entrada/retorno a vínculos sem digitar IDs | PASSOU | MinistryPages + navegação existente |
| Negação/revogação/sessão/igreja e resposta tardia | PASSOU | MinistryPages.test.tsx |
| DTO mínimo e respostas divergentes rejeitadas | PASSOU | managed-units-api.test.ts |

24 testes afetados aprovados na primeira execução. Resultados finais de suíte,
lint/tipos/build, CI e SHA são registrados no PR. Logs no workspace pai
output/parallel_mvp/organization/frontend-*.log.
Revisão independente/aceite técnico: coordenador root. Sem merge/deploy pelo agente.

Fora do escopo: CRUD ministerial completo, inclusão de integrantes sem seletor de
pessoas autorizado e Grupos independentes. A tela de vínculos reutilizada ainda
exibe IDs de pessoas, pois o contrato não fornece seus nomes. Unidades inativas
permanecem consultáveis para histórico e não concedem novas participações.
Nenhuma nova permissão, conta, senha ou regra de exclusão criada. npm ci reportou
7 vulnerabilidades moderadas da árvore existente; lockfile não alterado.
Issue #65 não concluída. Próximo: revisão/CI e integração coordenada.
