# FE-04 — cópia manual de planejamento anual

Issue canônica frontend #4; backend EVT-008/#28. Eventos / FE-04, prioridade
frontend não definida. Data2026-11-08 UTC. Branch codex/fe-04-annual-copy,
base inicial b7525b6, atualizada com main cf51eb70d93beac1fb9e3048b0724bcedde997df
após integração externa do PR73 durante a implementação. Papéis sequenciais
no mesmo agente; revisão independente e aceite humano PENDENTES.

## Implementador

Contrato event-planning-v1 1.0.0/EventPlanningController, Models e Service,
integrado pelo backend101/b884a78 e inspecionado em86db43b; ref atual
08430212d93e86e0a30d566dff1b3c6635b4fee0 preserva o contrato. Sem API inventada.
Rota `/eventos/igrejas/:churchId/planejamento/copiar`, entrada no catálogo.
EVENT_VIEW e EVENT_CREATE antes de ler origens ou enviar comando, conforme
contrato real. Backend reautoriza a igreja e cada origem sob lock.

Lista paginada existente de todos os estados; total continua de todas as
ocorrências, não contagem local de drafts. Usuário seleciona explicitamente
até100 origens DRAFT, inclusive entre páginas. IDs vêm de consulta autorizada,
sem campo para digitar UUID. Mostra revisão consultada e revisão selecionada;
cache não atualiza snapshot silenciosamente. Leitura posterior de origem
selecionada com revisão/estado alterado marca seleção obsoleta e bloqueia
envio até remoção/reseleção explícita. Mudança de origem fora da página ainda
é revalidada pelo servidor, que pode responder409/422.

Anos de origem/destino explícitos1–9999; servidor valida ano civil no fuso da
igreja. Não filtra origens por ano UTC nem confunde datas do navegador com
esse fuso. Seleção DRAFT não exige nunca ter sido publicada: unpublish com
marco anterior continua elegível para cópia, conforme serviço. Configuração
ausente do legado não é preenchida automaticamente pelo cliente.

Revisão/confirmar sem escrita implícita. POST /planning/copy envia somente
sourceYear/targetYear e sources[{occurrenceId,expectedRevision}], JSON projetado,
CSRF existente, sem revisão global inexistente. Valida resposta contextual,
ano/fuso, recurrenceRuleId null, correspondência1:1 com origens, destinos novos
distintos, DRAFT/revisão0/adjusted e duração decorrida exata de cada snapshot.
Não calcula datas nem ajustes de fuso. Projeta extras sem participantes/links.

Cada POST cria lote novo, sem idempotência. Trava acima das guardas conserva
tentativa durante foco/envio duplo, sucesso ou erro. Sem retry automático;
resultado incerto exige conferir lista antes de iniciar nova cópia. Campos,
seleção e página sobrevivem a foco; confirmação transitória não sobrevive.
Perda de acesso oculta seleção; outro contexto zera campos/seleção e ignora
resultado atrasado, abortando requisição sem prometer rollback no servidor.
Originais não são consumidos; destinos independentes da série, versão vigente
do template, sem inscrições/presenças/fila/notificações ou publicação.

## Testador

Node24/Windows, npm ci executado. Lint/typecheck/npm test/build/diff --check
passaram: inicialmente899 testes sobre base850; após atualização sem conflitos
para main cf51eb7, **934 testes/40 arquivos,49 novos** passaram, zero ignorados.
Dependências/lockfile e timeouts inalterados. Typecheck detectou parametrização
incorreta de arrays em cinco testes de seleção inválida; convertidos para linhas
com propriedade sources, verificando realmente vazio/duplicados/escopo/revisão/
intervalo. Os49 novos e a regressão final foram executados após a correção.

| ID | Critério do incremento | Resultado | Evidência |
| --- | --- | --- | --- |
| COPY-01 | Seleção explícita, até100, só DRAFT e revisões originais | PASSOU | AnnualCopyPage.test.tsx: páginas,100/101, estados, snapshot e reseleção |
| COPY-02 | Contrato/CSRF e novos destinos1:1 com duração preservada | PASSOU | payload projetado, extras descartados, duplicação/DTO inválido |
| COPY-03 | Confirmação/erro/foco sem replay ou falso sucesso | PASSOU | voltar, clique duplo, cinco HTTP, resposta inválida, foco |
| COPY-04 | Permissões, perda de acesso e isolamento de contexto | PASSOU | três negações, contexto inválido, revogação/restauração, resposta antiga |
| COPY-05 | Backend vivo / ajustes reais de ano e fuso | NAO_TESTADO | contrato/serviço inspecionados; fixtures/jsdom |

CI do head publicado será registrado no PR. Não houve ensaio de backend vivo;
testes de UI não comprovam inserções, auditoria ou algoritmo de calendário.
Validação visual dispensada como requisito de PR pelo usuário.

## Revisor

Revisão estática sequencial de permissões, seleção/revisão, projeção, contrato,
trava/aborto e resultados. Sem achado crítico/alto remanescente identificado.
Parecer independente/aceite humano PENDENTES. Restrições: ano civil e origens
fora da página dependem de validação transacional do servidor; operação não
idempotente. Nenhuma edição de série existente, publicação, alteração de origem
ou mudança de infraestrutura/backend/banco do usuário. Sem merge em main/deploy.
Próxima ação: CI/revisão, Run local e compatibilidade com geração75.
PODE_CONCLUIR issue: NAO; capacidades restantes e aceite humano pendentes.

```yaml
atividade: FE-04-ANNUAL-COPY
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 934
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao e solicitar Run local; verificar compatibilidade com geracao75
pode_concluir: false
aceite_humano: PENDENTE
```
