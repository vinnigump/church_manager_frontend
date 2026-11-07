# FE-04 — catálogo denominacional e consulta de versões

## Implementador

Issue #4, branch codex/fe-04-template-history, base origin/main 6a5e43c após merge
externo do PR #21. PR #21: discussão/revisão lida e CI 42374052166 confirmada success.
Preservados os dois resumos locais não rastreados. Nenhum merge/deploy pelo agente.

Lidos AGENTS, README, papéis, execução Eventos e issue #4/reconciliação (sem comentários).
Contratos reais EVT-005/006 1.0.0 inspecionados no backend: event-type-catalog-v1.openapi.json,
event-template-version-v1.openapi.json, evt-005-catalogo.md, evt-006-versoes.md,
EventTypeCatalogController/Service, EventTemplateVersionController/Service e configuração
HTTP SecurityConfiguration. Arquivos usados conferidos sem diff contra origin/master;
EVT-006 integrado no PR backend #75.

Consultas:
- GET /api/v1/events/denominations/{denominationId}/types?page&size.
- GET /api/v1/events/denominations/{denominationId}/types/{typeId}.
- GET /api/v1/events/denominations/{denominationId}/types/{typeId}/versions?page&size.

Rotas /eventos/denominacoes/:denominationId/catalogo e
/eventos/denominacoes/:denominationId/templates/:typeId recebem contexto do acesso da
denominação. EVENT_TEMPLATE_MANAGE/DENOMINATION verificado antes de buscar dados.
Não há descoberta fictícia, entrada de UUID, inferência a partir de permissões locais
ou concessão para administrador técnico externo. Backend autoriza novamente cada GET.

Catálogo administrativo não converte enabled em lifecycle. Detalhe apresenta estado
real, rascunho e histórico com nomes preservados por versão. Datas explícitas em UTC;
identificação da versão publicada usa o ponteiro da última consulta do template,
com rótulo que explicita esse limite. Atualizar template recarrega também o histórico;
atualizar histórico preserva o detalhe, sem prometer snapshot atômico entre GETs.

Cliente valida UUIDs, identidade do template, paginação, schema, enum, revisões seguras,
datas com fuso, duplicidades e rascunho incompatível. Projeta somente campos usados.
Basic em memória, cookie, no-store, abort e geração de sessão existentes preservados.
Sem escrita, protocolo de revisão novo, storage, logs, dados pessoais ou links privados.

## Testador

npm ci passou (sete vulnerabilidades moderadas na cadeia existente, sem mudar lockfile).
Lint, typecheck, 221 testes (50 novos + 171 regressões), build e diff --check passaram.

Cobertura nova: requests/DTOs, projeção de campos, origem, IDs e timestamps inválidos,
decisão negada/erro/foco/revogação, visitante, catálogo/histórico vazios, paginação,
recuperação quando catálogo encolhe, retry GET, 403/404/409/422/500, 401 com AuthProvider,
respostas antigas de outra denominação, título/foco na navegação, estado descontinuado,
rascunho separado do histórico e ausência de comandos de escrita.

Respostas controladas conforme contrato; não foi executado backend vivo, banco de uso,
ensaio visual responsivo ou leitor de tela. CI remota deve ser conferida após publicação.

## Revisor

Papéis executados sequencialmente pelo mesmo agente, sem revisão independente.
Diff conferido quanto a isolamento, deny-by-default, privacidade, contratos e navegação.
Consultas antigas são descartadas por active/abort e contexto em key; nenhum dado de
outra página é mantido enquanto carrega. Paginação corretiva somente diminui a página.
Nenhum achado crítico/alto identificado nesta revisão. Parecer técnico favorável com
ressalvas de validação visual/AT e ponta a ponta pendentes; aprovação humana do PR pendente.

Entrega parcial da #4. Escritas de versões (X-Expected-Revision), calendário e programação
ficam para incrementos próprios. Descoberta de contextos continua pendente. A issue não é
encerrada. Enquanto este PR aguarda revisão, outra demanda independente pode avançar.
