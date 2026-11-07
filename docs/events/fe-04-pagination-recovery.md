# FE-04 — recuperação da paginação do catálogo

## Implementação

Issue #4. Branch codex/fe-04-catalog-pagination-recovery.
O frontend já continha fundação e gestão local; este incremento corrige a leitura
quando desabilitações ou mudanças externas deixam a página atual além do total.
A resposta validada determina a última página válida (zero quando vazio), que é
consultada por GET. Uma página ainda válida é preservada. Não há retry de escrita.

Contratos inspecionados no backend local: docs/api/event-type-catalog-v1.openapi.json
1.0.0, docs/events/evt-005-catalogo.md, EventTypeCatalogController,
EventTypeCatalogService e EventTypeModels. GET retorna items/page/size/total;
a consulta de igreja filtra tipos habilitados. Issue #4 consultada no GitHub.
Nenhum endpoint, payload ou permissão novo. Guardas e CSRF existentes preservados.

## Validação e revisão

Papéis executados sequencialmente nesta sessão, sem revisão independente por subagente.
- npm ci: passou; sete vulnerabilidades moderadas reportadas, sem mudar dependências.
- npm run lint: passou.
- npm run typecheck: passou.
- npm test: 171 testes passaram, incluindo três novos casos de regressão.
- npm run build: passou.
- git diff --check: passou.

Regressões cobrem queda do total para zero/20 a partir da terceira página,
reconsulta direta da primeira página, ausência de escritas e preservação da
segunda página quando válida. Testes de interface usam respostas controladas;
não houve ensaio com backend vivo nem validação visual/tecnologia assistiva.

Revisão do diff: resposta antiga continua protegida pelo ciclo active/abort;
a página corrigida é estritamente menor que a solicitada, limitando reconsultas.
Estado loading permanece até a resposta da página válida; erros seguem com retry
manual existente. Nenhum dado novo em storage, logs ou URLs.

Entrega parcial da #4; calendário, publicação e demais fluxos seguem fora deste
incremento. Sem merge/deploy; decisão final do PR permanece humana.
