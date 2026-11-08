# Reconciliação do README com a execução atual

Issue canônica: https://github.com/vinnigump/church_manager_frontend/issues/1.
Módulo Fundação/governança; prioridade conforme backlog; responsável Codex;
2026-11-08 UTC; branch `codex/docs-current-backlog`; base a58e2a8.
SHA final, PR e CI no corpo do PR. Incremento exclusivamente documental.

## Problema comprovado e implementação

O README ainda descrevia toda #4 como dependente de backend #18, #5 como
dependente de #15/#18 e #6 como decisões deliberadamente pendentes, apesar
das entregas integradas e da reconciliação Eventos v1.0 nas próprias issues.
Também repetia homologação visual pendente sem esclarecer a dispensa atual.
Isso induzia leitura incorreta dos bloqueios e da ordem de trabalho.

Substituído o quadro antigo por entregas existentes e próxima dependência por
issue, com distinção explícita entre janela administrativa e inscrição real.
PR89 é mencionado como entrega a conferir, sem incorporar seu código pendente.
Atualizadas apenas as orientações atuais de visual/Run local. Relatórios
históricos não foram reescritos nem issues declaradas concluídas.

## Fontes verificadas

- AGENTS.md e docs/governance/development-reporting.md: continuidade após PR,
  bloqueio por demanda, visual dispensado e Run local por necessidade concreta.
- Issues frontend #1–6 e #28–33: escopos e reconciliações posteriores.
- Frontend main a58e2a8, PR88 integrado; PR89 aberto, mergeável, sem comentários
  na inspeção. CI42525879298 do48156e69 passou; não valida este novo documento.
- Backend master efc5990003534c72b7a2b55db100e08edbdf7a23 e inventário docs/api;
  sem PR backend aberto na inspeção. event-registration-window-v1 integrado,
  sem contratos de inscrição/fila/OTP/Jornada/trilhas/autorizações/check-in.
- organization.md, MinistryController e OrganizationController: administração
  global não substitui descoberta contextual dos usuários de Eventos.
- README e rotas/serviços reais distinguem componentes isolados e integrações.

## Testador e critérios

Revisão textual comparada com as fontes acima; `git diff --check` executado
antes do commit. Sem alteração de aplicação/configuração/dependências; suíte
local de aplicação não executada neste incremento documental. CI próprio
será conferido no SHA publicado, sem transferir resultado do PR89.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| D01 | Remover dependências históricas como quadro atual | PASSOU | tabela README com API/escopo específico e backlog canônico |
| D02 | Distinguir entregue, dependente e aceite formal | PASSOU | fonte main/PR89, avisos de parcialidade e revisão |
| D03 | Aplicar visual/Run local e continuidade atuais | PASSOU | README coerente com AGENTS, sem novos fluxos de aprovação |
| D04 | Preservar execução e relatórios históricos | PASSOU | diff somente README e este relatório |

## Revisor e decisão

Revisão técnica sequencial do mesmo agente, sem achados críticos/altos neste
escopo documental. Revisão independente PENDENTE. Não cria contrato, permissão,
regra funcional ou integração. Retrato temporal exige reconsulta antes de nova
atividade. PODE_CONCLUIR issue1: NAO; aceite humano PENDENTE.

```yaml
atividade: FE-01-CURRENT-BACKLOG-DOCS
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 4
criterios_comprovados: 4
testes_aprovados: 0
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: []
proxima_acao: "CI e revisão independente; reconsultar backlog/contratos"
pode_concluir: false
aceite_humano: PENDENTE
```
