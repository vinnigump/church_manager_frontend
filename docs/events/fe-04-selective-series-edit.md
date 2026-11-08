# FE-04 — consulta, prévia e edição seletiva de série anual

Issue canônica frontend #4 (parcial), Eventos / FE-04; backend EVT-008/#28.
Prioridade frontend não definida. Data 2026-11-08 UTC.
Branch codex/fe-04-selective-series-edit; base frontend
5bb7080492a352b3bbf8e7ef1030d6de36e7cfc5. SHA e CI finais no PR.
Responsável: agente em etapas sequenciais de implementação/teste/revisão estática.
Revisão independente e aceite humano PENDENTES.

## Implementador

PR backend113 confirmado integrado em
5c7638c6fabefa288c5e704c97f0a39d9f1c49f8 antes da implementação.
Inspecionados event-series-v1 1.0.0, EventSeriesController/Models/Service,
issue28 e comentários recentes. Não usou rotas de branches pendentes.

Rota /eventos/igrejas/:church/planejamento/series/:series, acessível pela série
vinculada no detalhe da ocorrência. EVENT_VIEW antes da leitura paginada e prévia;
EVENT_EDIT próprio para selecionar/aplicar, sem herança de CREATE/PUBLISH.
GET retorna todos os estados e total do servidor. Padrão/ano delimitado nulos
do legado são preservados; RRULE é descritiva e não interpretada pelo navegador.
Ano armazenado é preservado; legado exige proposta explícita, validada no servidor.

POST /preview usa CSRF e somente padrão anual. Horários/ajustes/fuso são calculados
pelo servidor; valida ID/revisão/fuso, índices consecutivos, instantes ordenados,
flags e duração decorrida. Nenhum ID é associado automaticamente a um horário.
Validação de padrão civil extraída da geração para função compartilhada;
geração existente conserva payload e seus 50 testes passaram.

Seleciona até366 DRAFT nunca publicadas, inclusive em páginas diferentes. Guarda
snapshot/revisão original e exige destino calculado distinto para cada selecionada.
Resumo de confirmação mostra origem/revisão, destino/índice/intervalo e configuração
completa. Alteração de padrão descarta prévia/destinos; configuração descarta
confirmação, conservando prévia porque não muda horários. Foco conserva campos,
seleção e prévia, mas descarta confirmação e reautoriza/relê a página.

PUT envia padrão, configuração e somente seleções {occurrenceId,expectedRevision,
slotIndex}, além de X-Expected-Revision da série/CSRF. Não envia versões, espaços,
participantes ou IDs não selecionados. Confirma mapeamento1:1, revisões por item,
indicador changed coerente com destino/configuração e revisão agregada, inclusive
no-op. Backend recalcula e valida seleção/capacidade/participação/tipo/ano/fuso,
transação e auditoria atômicas. Preserva tipo/snapshot/espaço, publicadas e não
selecionadas; não cria/exclui ocorrências, inscrições, presenças ou notificações.

Revisão nova da série bloqueia proposta até descarte/releitura; selecionada visível
alterada exige remoção/reseleção. Não atualiza revisão original silenciosamente;
alterações fora da página são revalidadas no PUT pelo servidor. Comando/trava acima
das guardas impede duplo envio e replay após foco/erro/sucesso. Resposta incerta
exige conferir registros antes de descartar tentativa. Mudança de conta/igreja/série
aborta/ignora resposta antiga, sem prometer rollback remoto. Sem storage.

Após confirmação, mostra resultado/revisões do servidor. A lista conserva o snapshot
da consulta anterior, identificado como revisão consultada; botão de descarte e
releitura consulta o estado atual antes de outra edição. Não é assinatura em tempo real.

## Testador — evidências reais

Node24.22.1/Windows. npm ci, npm run lint, npm run typecheck, npm test,
npm run build e git diff --check passaram. Regressão1115 testes/44 arquivos;
62 novos casos em SeriesPage.test.tsx. Nenhuma falha/ignorado final.
Primeiro lint encontrou argumento não usado, corrigido com verificação explícita
de contexto no observer. Primeiras rodadas direcionadas identificaram testes
lendo controles antes da autorização assíncrona; aguardam agora os controles
autorizados com findBy, sem mudar guardas ou conceder acesso durante loading.
Rodada final direcionada62/62 e regressão completa passaram.
Dependências/lockfile não alterados; sete moderados existentes de tooling.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| SE-F01 | Leitura contextual/paginada/legado e prévia sem escrita | PASSOU | schemas, VIEW-only, legado nulo e POST sem PUT |
| SE-F02 | Seleção/destinos explícitos preservando não selecionadas | PASSOU | payload só uma origem, páginas distintas, 366/367, publicadas bloqueadas |
| SE-F03 | Revisão/CSRF/configuração/no-op/DTO estrito | PASSOU | cabeçalhos, revisão agregada/por item, respostas e seleções incompatíveis |
| SE-F04 | Confirmação/foco/erro/contexto sem replay | PASSOU | revisão nova, duplo envio, HTTP403/409/422/500 e aborto |
| SE-F05 | Backend vivo, fuso e atomicidade reais | NAO_TESTADO | fixtures/jsdom e serviço integrado inspecionado; CI backend não é teste frontend vivo |

Validação visual dispensada como requisito de PR. Run local somente por necessidade
concreta, conforme orientação atual do usuário; não solicitado por rotina.

## Revisor e decisão

Revisão estática sequencial sem achados críticos/altos identificados; revisão
independente/aceite humano PENDENTES. Proposta não reserva horário; autorização e
concorrência são reavaliadas pelo servidor. Não altera active/encerra série nem
publica calendário. Seleção e estado em memória não são restaurados após navegação
para outra rota. Sem merge em main/deploy/infraestrutura/banco do usuário.
Próxima ação: conferir CI/revisão/conflitos e procurar demanda independente.
PODE_CONCLUIR issue #4: NÃO, escopo parcial e aceite pendente.

```yaml
atividade: FE-04-SELECTIVE-SERIES-EDIT
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1115
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao/conflitos e procurar demanda independente
pode_concluir: false
aceite_humano: PENDENTE
```
