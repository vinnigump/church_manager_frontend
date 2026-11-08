# FE-01 — auditoria de séries e compatibilidade com contrato1.5

Issue canônica frontend #1 (parcial); relacionada #4/Eventos/FE-04 e backend #28.
Módulo Segurança, prioridade frontend não definida. Data2026-11-08UTC.
Branch codex/fe-01-series-audit; base5bb7080492a352b3bbf8e7ef1030d6de36e7cfc5.
Responsável: agente em etapas sequenciais de implementação/testes/revisão estática;
revisão independente e aceite humano PENDENTES. SHA/CI finais no PR.

## Implementador

Contrato audit-query-v1 1.5.0 integrado no backend113, ref
5c7638c6fabefa288c5e704c97f0a39d9f1c49f8. Inspecionados OpenAPI, AuditQuery,
AuditQueryController e requisito de filtro explícito. Atividade independente dos
PRs frontend82(liberação de equipe) e83(editor de série).

Adiciona EVENT_RECURRENCE_RULE à seleção da auditoria e rota contextual existente.
Somente filtro explícito aceita EVENT_SERIES_UPDATED/SUCCESS com ator/IDs válidos.
Não aceita esse recurso em consulta padrão, por ID isolado ou outro tipo. Mantém
security:audit:read/DENOMINATION, sem inferir permissão ou denominação da série
a partir de EVENT_VIEW/EDIT/CREATE. Não cria link partindo da série sem contexto
denominacional autorizado disponível.

Compatibilidade: parser antes limitado às três recusas1.2 recusava páginas válidas
do contrato integrado1.3/1.4. Agora aceita também PROFILE_READ_DENIED,
ASSIGNMENT_READ_DENIED e DELEGATED_ASSIGNMENT_DENIED apenas sob AUDIT_LOG/DENIED.
Outras ações/resultados/atores continuam recusados. Consulta padrão mantém sete
tipos anteriores, sem séries/recusas. Selecionar sem aplicar não consulta.

Reusa filtros de período/recurso, paginação e guardas existentes. Exibe somente
metadados projetados, sem justificativas, snapshots, seleção ou metadata extras.
Aviso diferencia edição seletiva do histórico completo de Eventos. Não grava
edição, exporta dados ou concede permissão. GET de auditoria registra tentativa
de leitura no backend segundo contrato; isso não comprova recebimento pelo cliente.
Comportamento existente de foco mantido: reautoriza/remonta workspace; rota geral
volta ao filtro padrão, rota contextual conserva tipo/ID da URL validada.

## Testador

Node24.22.1/Windows: npm ci/lint/typecheck/test/build/diff --check passaram.
1070 testes/44 arquivos;17 novos. Direcionados49 testes em AuditPage.test.tsx e
SeriesAudit.test.tsx passaram. Sem falhas/ignorados finais; lockfile/dependências
preservados. Backend vivo NAO_TESTADO; fixtures/jsdom e contrato real inspecionado.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| AUD-S01 | Série exige filtro explícito e par tipado | PASSOU | padrão/ID/outro tipo/ação/outcome/ator inválidos recusados |
| AUD-S02 | Novas recusas tipadas mantêm opt-in | PASSOU | três ações novas só sob AUDIT_LOG/DENIED |
| AUD-S03 | Consulta/filtros/página/rota e permissão existentes | PASSOU | selecionar não consulta, paginação/rota contextual/foco/negação |
| AUD-S04 | Projeta só metadados do contrato | PASSOU | metadata/justificativa/seleção extras descartadas |
| AUD-S05 | Consulta e data_access_log em backend vivo | NAO_TESTADO | fixtures não comprovam persistência viva |

Validação visual dispensada como requisito de PR. Run local não solicitado por
rotina; somente por necessidade concreta, conforme orientação atual do usuário.

## Revisor e decisão

Revisão estática sequencial sem críticos/altos identificados; revisão independente
PENDENTE. Dados podem mudar entre consultas; backend reavalia autorização e tenant.
UI não promete auditoria completa ou entrega de resposta. Sem storage, merge em
main, deploy ou mudança de infraestrutura. Próxima ação: conferir CI/revisão e
composição com demais PRs; reanalisar backlog implementável.
PODE_CONCLUIR issue #1/#4: NÃO; entrega parcial, aceite pendente.

```yaml
atividade: FE-01-SERIES-AUDIT
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1070
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao/composicao e backlog implementavel
pode_concluir: false
aceite_humano: PENDENTE
```
