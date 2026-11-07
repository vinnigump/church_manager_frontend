# FE-06 — preparação de avisos de autorização e presença

## Implementador

Base `origin/main` 186c561, após merge humano do PR #11. Branch `feat/fe-06-participation-notices`. Lidos AGENTS.md, três papéis, plano de execução, README, componentes, rotas, autenticação, cliente e testes. Consultadas issue frontend #6 e dependências backend #43–#48, incluindo comentários: sem comentários adicionais nessas issues.

### Contratos e decisões

- [Backend #43](https://github.com/vinnigump/church_manager/issues/43): política DIGITAL/DOCUMENT/BOTH por ocorrência e responsável validado; pendência ocupa vaga. Isso não define DTOs de coleta, retenção ou upload consumíveis pelo frontend.
- [#44](https://github.com/vinnigump/church_manager/issues/44): revogação bloqueia participação sem cancelar inscrição.
- [#45](https://github.com/vinnigump/church_manager/issues/45): portal/pendências e análise documental ainda dependentes das histórias anteriores.
- [#46](https://github.com/vinnigump/church_manager/issues/46): check-in QR opaco e idempotente, único por ocorrência, **sem check-out**.
- [#47](https://github.com/vinnigump/church_manager/issues/47): NO_SHOW somente quando check-in habilitado; correções auditadas.
- [#48](https://github.com/vinnigump/church_manager/issues/48): evidência de Trilhas por presença validada, nunca inscrição.

Todas essas issues estavam abertas na consulta. A issue frontend #6 contém texto histórico de planejamento anterior à baseline: check-out e reserva de vagas não devem ser implementados com base nesse texto. O plano versionado estabelece ausência de check-out e ocupação de vaga enquanto a autorização está pendente. Métodos de coleta/revisão documental, política de retenção e contratos detalhados continuam dependências; não coletar evidências.

[SecurityConfiguration na principal](https://github.com/vinnigump/church_manager/blob/master/src/main/java/br/com/churchmanager/security/config/SecurityConfiguration.java) agora libera `GET /api/v1/accounts/me/authorization` para identity:self; Basic/CSRF preservados. Isso atualiza a evidência histórica da FE-05: há uma consulta autenticada de decisão. As demais rotas de Eventos continuam negadas por padrão. O [PR #61](https://github.com/vinnigump/church_manager/pull/61) descreve catálogo granular sem novas rotas de negócio; não presumir merge ou APIs operacionais por esse planejamento. OpenAPI identidade 0.3.0 inspecionado continua documentando pessoas/conta/CSRF, sem contratos de menores/presença.

**Nenhum contrato HTTP novo é consumido por esta entrega.** Não se inventaram endpoints, permissões, payloads ou autenticação. Nenhum arquivo/banco do backend foi modificado.

### Entrega isolada

`ParticipationNotices.tsx` apresenta somente mensagens a partir de uma projeção interna tipada. Não representa DTO HTTP ou motor de autorização.

- Inscrição confirmada, espera, cancelada e desconhecida permanecem separadas da autorização.
- Autorização pendente/revogada informa bloqueio sem cancelar inscrição. Estado desconhecido não libera participação. Autorização registrada ou não exigida tampouco constitui permissão no cliente.
- Presença não registrada/validada/invalidada/ausência é exibida como informação do servidor, sem reconciliação ou conclusão de tarefas no frontend.
- Quando check-in está desabilitado, não há inferência de ausência. Quando habilitado, mensagem de check-in único por ocorrência, inclusive multi-dia.
- Evento aberto não exibe inscrição nominal, autorização ou presença.
- Snapshot só aparece se igreja, ocorrência e sujeito coincidirem. Essa comparação reduz mistura acidental, **não substitui autorização backend nem prova vínculo familiar**.
- Indisponível/loading/erro retiram dados anteriores. Título/aria-busy e status/alert expõem estados sem depender de cor.

Não montado em rotas; fixtures somente nos testes. Sem ações, QR, câmera, assinatura, upload, documentos, nomes, detalhes de responsáveis, links privados, storage ou requests. A rota de Eventos permanece indisponível para integração. Nenhuma validação real de presença pode ser executada pelo componente.

### Bloqueios para aceite funcional

| Fluxo | Dependência |
| --- | --- |
| Identificar responsável com poder de autorizar | Identidade #15, escopo por sujeito e concessão real, sem inferir de parentesco |
| Exibir política/estado real de autorização | #43–#45: DTOs aprovados, estados, validade/revogação e minimização de dados |
| Coleta/consulta de evidências | Método, consentimento, retenção, acesso privado e revisão de privacidade; sem implementação antecipada |
| Participação/check-in real | #46: contrato de ação, QR opaco, online, CSRF, validação transacional de autorização e idempotência |
| Presença/correção/ausência | #47: estados e erro de concorrência, permissão e auditoria |
| Evidências e invalidação para Trilhas | #48/#14: processamento idempotente no backend; não simular conclusão |

## Testador

| Comando | Resultado local |
| --- | --- |
| `npm ci` | Passou, 264 pacotes; mesmos 10 alertas preexistentes de ferramentas (8 moderados, 2 críticos) |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 84 testes passaram: 21 novos + 63 regressões |
| `npm run build` | Passou, Vite 7.3.7 |

Novos testes: pendência/revogação sem cancelamento; desconhecida/registrada/não exigida sem liberação; separação da inscrição; estados de presença; check-in opcional e único; evento aberto; contexto igreja/ocorrência/sujeito; remoção de conteúdo anterior; aria-busy; ausência de chamadas/storage/coleta/reflexão de campos privados.

Não executados: integração backend, QR/câmera, upload/assinatura, validação de responsável, check-in e correção concorrentes/idempotentes, revogação transacional, concessões reais, notificação, leitores de tela/teclado e inspeção visual responsiva. Nenhum fluxo desses foi habilitado. Layout usa a seção responsiva já existente; jsdom não comprova dimensões visuais.

Parecer Testador: **APROVADO COM RESSALVAS para avisos isolados; aceite funcional integral da #6 bloqueado**.

## Revisor

Papéis executados sequencialmente, sem ativação automática de agentes separados. Inspecionados diff, tipagem, contratos, segurança e resultados. Modelo discriminado separa evento aberto de presença nominal e check-in desabilitado de ausência. Mensagens não oferecem ação nem simulam sucesso. Dados sensíveis não entram no modelo e campos adicionais não são refletidos por spread.

| Severidade | Evidência | Encaminhamento |
| --- | --- | --- |
| ALTO — dependência funcional | APIs EP-06/07 ainda ausentes | Impede aceite integral; componente não é ligado a rotas nem autoriza operações |
| MÉDIO — divergência histórica | Texto #6 versus baseline versionada | Seguir baseline, sem check-out e com vaga mantida na pendência; contratos detalhados ainda precisam de revisão |
| CRÍTICO — alerta preexistente de ferramenta | Vitest/tinypool no lockfile, já registrado nas FE-04/05 e sinalizado novamente pelo npm ci | Manutenção própria pendente; dependências não alteradas. Não alegar correção nem exploração comprovada |
| BAIXO — limite de verificação | Sem ensaio visual/AT/backend | Validar após contrato real, antes de liberar integração |

Nenhum defeito CRÍTICO/ALTO introduzido identificado. Parecer Revisor: **APROVADO COM RESSALVAS para o incremento isolado; aceite funcional integral bloqueado**. Isso não constitui aprovação humana de merge.

PR draft; sem merge/deploy. Não iniciar novo incremento sem aprovação humana.
