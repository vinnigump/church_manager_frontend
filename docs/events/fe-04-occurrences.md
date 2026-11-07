# FE-04 — ocorrências administrativas

Referência: [issue #4](https://github.com/vinnigump/church_manager_frontend/issues/4).
Contrato backend `docs/api/event-occurrences-v1.openapi.json` 1.0.0,
`EventOccurrenceController`, `EventOccurrenceModels` e `EventOccurrenceService`,
integrados no PR backend #96 (`ad2490c`) e reconferidos em `c195ae8` após #97.
A trava de programação acrescida no servidor não altera o DTO desta entrega.

## Comportamento

- `/eventos/igrejas/:churchId/ocorrencias`: consulta administrativa paginada (20),
  todos os períodos, inclusive rascunhos e legado; não é agenda pública ou filtro anual.
- `/:occurrenceId`: detalhe projetado sem links online/participantes.
- `/nova`: POST com configuração explícita; `/:occurrenceId/editar`: PUT de
  DRAFT sem marco de primeira publicação, com `X-Expected-Revision` numérico.
- Contexto vem das rotas já existentes de catálogo/calendário; sem descoberta
  fictícia, entrada de UUID ou concessão implícita por administração técnica.
- EVENT_VIEW precede os GETs. Criação e edição exigem também, separadamente,
  EVENT_CREATE e EVENT_EDIT na igreja. O servidor reautoriza cada operação.
- Tipo selecionado no catálogo real paginado, sem seleção automática. Tipos
  desabilitados aparecem identificados e indisponíveis para nova seleção.
  Seleção fora da página permanece identificada pelo ID e com disponibilidade
  a validar; o servidor confirma vínculo, habilitação e versão publicada.
- Modalidade, participação e check-in são explícitos; legado parcial não recebe
  defaults. OPEN não é convertido para OPEN_EVENT. Evento aberto exige que o
  usuário escolha check-in “Não”; nenhuma correção silenciosa.
- Capacidade vazia = null/ilimitada; zero é válido, limite Java Integer.
  Datas são editadas em UTC com segundos. O Instant original e seus
  microssegundos são mantidos se o campo não mudar. Comparação usa bigint,
  rejeita submicrossegundos e término não posterior ao início.
- Tipo da série não é alterável; mesmo tipo conserva a versão anterior.
  Resposta de escrita precisa confirmar configuração, contexto, ID, vínculo,
  revisão e estado. No-op conserva revisão; alteração incrementa uma vez.

## Concorrência e reconciliação

Trava de comando, campos e snapshot original ficam acima das guardas, preservados
durante reconsulta por foco. Clique duplo não duplica a escrita. Revisão atual
diferente não substitui o snapshot nem os campos locais silenciosamente: bloqueia
salvar e exige recarga explícita que descarta alterações locais e reautoriza.
Saída/mudança de contexto desmonta o workspace e aborta leituras/comando.

Erro de escrita ou resposta incompatível bloqueia repetição até recarga explícita.
POST incerto avisa que pode ter criado e orienta conferir a lista antes de outra
criação. Não há idempotência inventada nem retry automático. Cliente compartilhado
mantém Basic em memória, cookies same-origin, CSRF dinâmico e geração de sessão.
Corpos de erro/resposta não são refletidos em logs, URLs ou mensagens.

Sem publicação, cancelamento, exclusão, recorrência, janela de inscrição,
vínculo de calendário, local físico, check-in ou inscrições. A API de espaços
recém-integrada no backend #97 será uma atividade separada, sem dependência
implícita nesta branch. Nenhuma ação dessas é simulada pelo frontend.

## Verificação e revisão

Papéis Implementador → Testador → Revisor executados sequencialmente pelo mesmo
agente; não representa revisão independente ou aprovação humana.

- `npm ci`: concluído; lockfile inalterado. Sete vulnerabilidades moderadas
  preexistentes em tooling; sem atualização forçada de dependências.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
  `git diff --check`: executados nesta branch.
- 650 testes passaram: 62 novos de contrato/fluxo mais 588 de regressão.
  Fixtures são somente testes; não é evidência de integração com backend vivo.
- Cobertura nova: isolamento, projeção, paginação, legado, permissões antes
  de leituras, CSRF, payload/revisão, precisão temporal/no-op, versão vinculada,
  série, erros, envio duplo/foco, campos sujos com revisão concorrente e
  paginação/atualização do seletor sem submeter o formulário.
- Revisão estática: sem endpoints/regras inventados, sem armazenamento de
  credenciais, sem payload de ator/status/publicação, autorização por recurso,
  sem alteração do fluxo público/Home integrado no PR #53.

**Ressalvas:** backend vivo, teclado/leitor de tela e ensaio visual real pendentes.
Browser Use permanece bloqueado por permissão salva/política da origem, mesmo
após tentativa expressamente autorizada. Sem contorno, capturas ou afirmação
de aceite visual. Testes jsdom não verificam layout, clipping, zoom ou contraste
renderizado. PR deve permanecer em rascunho para revisão humana; sem merge/deploy.
