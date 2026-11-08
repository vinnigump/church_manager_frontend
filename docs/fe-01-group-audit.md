# FE-01 — auditoria de vínculos de grupos

Issue canônica frontend #1(parcial), relacionada #4 e backend EVT-011/#31.
Segurança/FE-01, prioridade frontend não definida. Data2026-11-08UTC.
Branch codex/fe-01-group-audit; base6e83fc19dc2a843f065febd8ee2bda86c016d336.
SHA/CI finais no PR. Responsável: agente em etapas sequenciais; revisão
independente e aceite humano PENDENTES.

## Implementação

audit-query-v1 1.6.0 e AuditQuery inspecionados no backend integrado119,
ref07495839d50d57fa4a72740d91bc21a74f7eaef3. Demanda independente da consulta/
desvinculação do frontend86. Adiciona GROUP_MEMBERSHIP ao filtro/rota de auditoria
existentes, somente mediante security:audit:read/DENOMINATION. Gestão ou liderança
de grupo não concede auditoria. Sem inferir denominação por churchId ou vínculo.

Filtro explícito aceita apenas GROUP_MEMBER_LINKED/GROUP_MEMBER_RELEASED/SUCCESS,
ator e IDs válidos. Consulta padrão, ID isolado, outros tipos e pares arbitrários
não incluem vínculos. Preserva sete tipos anteriores no padrão e opt-ins separados
para recusas e séries. Selecionar sem aplicar não consulta; filtro/recurso/período
e paginação reutilizados. O motivo pertence ao histórico autorizado do vínculo;
projeção descarta reason/metadata/nomes extras e UI explica limite de cobertura.
Não inclui workflow de solicitação/aprovação ou alterações de membresia formal,
cargos ou presença. Nenhuma nova escrita, exportação, storage ou API inventada.

## Verificação

Node24.22.1/Windows: npm ci/lint/typecheck/test/build/diff --check passaram.
Regressão1174 testes/47 arquivos;16 novos. Direcionados65/3 arquivos passaram,
incluindo auditoria anterior e séries. Zero falhas/ignorados finais; dependências
e lockfile preservados. Fixtures/jsdom, sem backend vivo nesta atividade.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| GA-01 | Filtro explícito e ações tipadas somente SUCCESS | PASSOU | duas ações, padrão/ID/outro tipo e pares/atores incompatíveis |
| GA-02 | Permissão denominacional e contexto próprios | PASSOU | rota/ID fixos, gestor de grupo não audita, revogação em foco |
| GA-03 | Metadados mínimos sem motivo privado | PASSOU | extras descartados e nota de cobertura |
| GA-04 | Aplicação/paginação/padrão preservados | PASSOU | selecionar não consulta, página2 e retorno ao padrão |
| GA-05 | Leitura auditada em backend vivo | NAO_TESTADO | fixtures não comprovam data_access_log vivo |

Revisão estática sequencial sem achados críticos/altos; revisão independente e
aceite PENDENTES. Visual não é requisito de PR; Run local apenas por necessidade
concreta e não solicitado por rotina. Backend revalida tenant/permissão a cada GET.
Sem merge/deploy/infraestrutura. Próxima ação: CI/revisão/composição com86 e
reanalisar backlog. PODE_CONCLUIR issue1/4: NÃO, entrega parcial.

```yaml
atividade: FE-01-GROUP-AUDIT
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1174
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao/composicao e reanalisar backlog
pode_concluir: false
aceite_humano: PENDENTE
```
