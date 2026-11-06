# FE-04 — catálogo e agenda: preparação isolada

## Implementador

Branch `feat/fe-04-event-catalog`, baseada na `origin/main` 1209920. Foram lidos AGENTS.md, os três papéis em `.github/agents/`, README e `codex-frontend-execution.md`. Issues frontend #4/#5/#6 e seus comentários consultados: sem comentários adicionais. Somente a #4 foi executada.

### Contratos e evidências

- [Inventário backend EVT-001](https://github.com/vinnigump/church_manager/blob/master/docs/events/evt-001-inventario-e-migracoes.md): oito entidades/repositórios existentes, sem controllers/DTOs de Eventos. Dados de persistência não são contratos de frontend.
- [SecurityConfiguration vigente](https://github.com/vinnigump/church_manager/blob/master/src/main/java/br/com/churchmanager/security/config/SecurityConfiguration.java): HTTP Basic/CSRF preservados, demais rotas negadas por padrão. O OpenAPI de identidade 0.3.0 mantém `/accounts/me` e `/csrf`; nenhuma mudança de autenticação nesta entrega.
- [PR backend #55](https://github.com/vinnigump/church_manager/pull/55): integrado, somente planejamento. Isso não entrega APIs. [PR #59](https://github.com/vinnigump/church_manager/pull/59): defesa parcial de persistência; registra falta de fronteira autenticada/catálogo, sem rotas habilitadas.
- EP-02: [#25 catálogo](https://github.com/vinnigump/church_manager/issues/25), [#26 versões](https://github.com/vinnigump/church_manager/issues/26), [#27 calendário anual](https://github.com/vinnigump/church_manager/issues/27), [#28 recorrência](https://github.com/vinnigump/church_manager/issues/28). Todas abertas na consulta.
- EP-03: [#29 políticas](https://github.com/vinnigump/church_manager/issues/29), [#30 estados](https://github.com/vinnigump/church_manager/issues/30), [#31 visibilidade](https://github.com/vinnigump/church_manager/issues/31), [#32 contrato de calendário](https://github.com/vinnigump/church_manager/issues/32). Todas abertas na consulta.

Não foi encontrado contrato OpenAPI de Eventos publicado nas fontes inspecionadas. Nenhum endpoint de Eventos, DTO HTTP, código de permissão ou resposta foi inventado. Nenhum contrato de Eventos é consumido nesta entrega.

### Implementação desbloqueada

- `EventCatalog`: apresentação isolada de origem local/denominacional, obrigatoriedade e estado, com filtro por origem.
- `EventAgenda`: agenda em lista semântica ordenada, filtro por período com validação, interseção de ocorrências multi-dia e datas no fuso explicitamente fornecido.
- Estados discriminados indisponível/carregando/erro/pronto, incluindo listas vazias. Ao sair de pronto, conteúdo anterior deixa de ser renderizado.
- Modelos internos de apresentação em `presentation.ts`; **não são DTOs**. O futuro adaptador deve validar datas/fuso, mapear contratos publicados e fornecer somente dados já autorizados pelo backend.
- Componentes não recebem campos de links online, documentos ou pessoas; não fazem spread de dados no DOM. Não oferecem criação/edição/publicação/cancelamento nem ações de inscrição/presença.
- `/eventos` é uma rota autenticada contendo somente indisponibilidade. O catálogo e a agenda não estão montados em produção; fixtures vivem exclusivamente nos testes. Não há prévia pública, storage ou chamadas de Eventos.
- CSS usa grid adaptativo, flex-wrap e campos com labels. Eventos abertos exibem ausência de inscrição/presença individual, mesmo se uma combinação inconsistente chegar ao componente; ocorrência multi-dia informa check-in único quando habilitado.

### Bloqueios

| Entrega funcional da #4 | Dependência |
| --- | --- |
| Listagem real de catálogo/versões | EP-02 #25/#26, DTOs/OpenAPI e autorização autenticada |
| Calendário público/administrativo | #27/#32, filtros/paginação/fuso e política de visibilidade; não expor drafts |
| Criar/programar/publicar ocorrências | #29/#30 e contrato real de capacidades por recurso/igreja |
| Recorrência/exceções/cópia anual | #28; escopo de série versus ocorrência e concorrência publicados |
| Links restritos | Política e DTO público redigido no backend; frontend não deve receber link não autorizado |

Filtro de igreja local evita mistura acidental na apresentação; **não comprova isolamento nem substitui autorização backend**. Sem contrato de capacidades, todas as ações ficam ausentes. Não usar `organization:manage` global como permissão de Eventos.

A baseline v1.0 prevalece sobre textos antigos: ocorrência em andamento não é cancelável; eventos abertos não têm presença nominal; não há check-out, presença diária ou gestão de locais. Autorização pendente ocupa vaga e bloqueia participação, sem cancelar inscrição. Nenhum fluxo das issues #5/#6 foi implementado.

## Testador

Testes de componentes usam somente dados sintéticos e não representam integração real. Cobrem estados de catálogo/agenda, origem/estado, ausência de ações, troca de contexto, filtro de igreja, datas locais versus UTC, sobreposição multi-dia, validação/correção de período, ordenação, evento aberto, ausência de links/campos privados, navegação e negação a anônimos.

Resultados locais reais:

| Comando | Resultado |
| --- | --- |
| `npm ci` | Passou, 264 pacotes instalados; alertas preexistentes abaixo |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 36 testes passaram (17 novos de Eventos, 19 regressões) |
| `npm run build` | Passou, Vite 7.3.7 |
| `git diff --check` | Passou |
| `npm audit --omit=dev --json` | Zero vulnerabilidades reportadas |
| `npm audit --json` | 10 alertas em dependências de desenvolvimento: 8 moderados, 2 críticos |

Uma tentativa inicial dos checks ocorreu antes de `npm ci` finalizar e falhou por executáveis ainda indisponíveis. Todos os checks foram repetidos após a conclusão da instalação e passaram. Não houve falha de teste funcional.

Integração ponta a ponta com backend, calendário público real, formulários de escrita, permissões concedidas/revogadas no servidor, concorrência de publicação e teste visual em navegador/teclado/leitor de tela não executados. Responsividade verificada somente por inspeção do CSS; jsdom não mede layout.

Parecer Testador: **APROVADO COM RESSALVAS para componentes isolados**, sem aceite de integração funcional da #4.

## Revisor

Revisão sequencial conforme os papéis configurados, sem executar agentes separados automaticamente. Inspeção do diff, contratos e testes:

- Tipagem: estado discriminado impede tratar erro/loading como sucesso; modelos de apresentação separados do cliente HTTP. Campos sensíveis não fazem parte dos modelos, nem são serializados/refletidos por spread.
- Reutilização: componente interno de estado comum às duas listagens; padrões existentes de layout, autenticação e roteamento preservados. Sem nova biblioteca.
- Acessibilidade: títulos e regiões nomeados, labels, fieldset/legend, status/alert, aria-busy e erro associado aos campos. Datas têm `<time>`. Sem grade interativa que exija navegação complexa; agenda é lista semântica.
- Segurança: componentes sem ações, requests, storage ou dados nominais. Rota pública não expõe listagens; rota autenticada não concede capacidade por estar logada. Filtragem local é apenas proteção adicional.

Achados e limites:

| Severidade | Local/evidência | Impacto e encaminhamento |
| --- | --- | --- |
| ALTO — dependência funcional preexistente | Backend #25–#32 e ausência de capacidades | Bloqueia integração/aceite integral da #4; componentes ficam isolados e rota indisponível |
| CRÍTICO — alerta de dependência preexistente | Lockfile: Vitest 3.2.7/tinypool; audit GHSA-5gmw-xhrv-c9v3 e GHSA-85c8-ppgw-ccpr | Auditoria sinaliza cadeia de execução de testes. Não demonstra exploração no app. Pacotes não entram no bundle de produção; atualizar ferramenta com verificação de compatibilidade em manutenção própria. Não aplicar audit fix --force nesta issue |
| MÉDIO — alerta de dependência preexistente | @vitest/mocker e minimatch na cadeia de lint/testes | 8 registros moderados incluindo efeitos transitivos. Reavaliar com a atualização de ferramentas; package.json/lockfile preservados |
| BAIXO — limite de verificação | CSS e jsdom | Teste visual, teclado e leitor de tela pendentes; não afirmar validação completa de responsividade/acessibilidade |

Nenhum defeito CRÍTICO/ALTO introduzido no incremento foi identificado na revisão. Os alertas preexistentes continuam explícitos e não foram classificados como corrigidos. Parecer: **APROVADO COM RESSALVAS para o incremento isolado; aceite funcional integral da #4 bloqueado**. O parecer não constitui aprovação humana de merge.

Escopo deliberadamente parcial: a #4 não está concluída. PR em rascunho, sem merge/deploy; aguardar aprovação antes de outro incremento ou da issue #5.
