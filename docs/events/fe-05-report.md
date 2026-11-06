# FE-05 — preparação de inscrições, capacidade e espera

## Implementador

Base `origin/main` 667b736 após merge humano do PR #10. Branch `feat/fe-05-registration-summary`. Lidos AGENTS.md, três papéis, plano de Eventos, README, componentes de catálogo/agenda, autenticação, cliente HTTP e testes. Consultadas issue #5 e comentários (nenhum), dependências backend EP-04/05 #33–#40, comentários #15/#35 (nenhum), configuração de segurança vigente, OpenAPI de identidade e inventário EVT-001.

### Contratos verificados

- [SecurityConfiguration na principal](https://github.com/vinnigump/church_manager/blob/master/src/main/java/br/com/churchmanager/security/config/SecurityConfiguration.java) continua negando rotas não explicitamente liberadas. Basic/CSRF e autenticação frontend preservados.
- [Inventário EVT-001](https://github.com/vinnigump/church_manager/blob/master/docs/events/evt-001-inventario-e-migracoes.md) diferencia tabelas existentes de APIs/regras ainda pendentes.
- [Backend #33–#36 / EP-04](https://github.com/vinnigump/church_manager/issues/33): inscrição individual, capacidade transacional, janelas e cancelamento/consulta. Issues abertas na consulta.
- [Backend #37–#40 / EP-05](https://github.com/vinnigump/church_manager/issues/37): fila, reagendamento, reconfirmação e ofertas. Issues abertas na consulta.
- [PR backend #60](https://github.com/vinnigump/church_manager/pull/60) descreve adaptador autenticado e decisão própria `allowed` por recurso, mas registra que Eventos continuam negados e o catálogo é trabalho próprio. Não tratar uma decisão genérica como API de inscrição ou inventar códigos de Eventos. A configuração vigente na principal foi consultada separadamente; não presumir integração de um PR.

**Nenhum contrato HTTP de inscrição/capacidade/espera foi consumido ou inventado.** Os tipos em `RegistrationViews.tsx` são modelos internos de apresentação, não DTOs backend. Dados de teste são sintéticos e não entram nas rotas da aplicação.

### Entrega desbloqueada

`CapacitySummary` exibe capacidade, ocupação e vagas; rejeita números negativos, fracionários, não finitos ou ocupação acima da capacidade. Capacidade desconhecida não significa ilimitada. Vagas exibidas não prometem confirmação: a decisão pertence ao servidor.

`RegistrationOverview` exibe estado individual sem inscrição informada, confirmado, cancelado ou em espera, com posição válida quando a fila está habilitada. Não lista outras pessoas. Inscrição confirmada não comprova presença nem conclusão de Trilhas. Evento aberto não mostra capacidade de inscrições, fila ou presença individual.

Estados indisponível, carregando, erro e conflito retiram dados anteriores. Estado de conflito é apresentação preparada para futura integração; **não é uma implementação de retry/refetch/409 real**. Contexto igreja+ocorrência precisa coincidir antes de exibir snapshot. Filtragem local não substitui autorização no servidor.

Sem ações, formulários de escrita, armazenamento, requisições ou endpoints novos. Componentes não estão montados em produção; `/eventos` continua indicando indisponibilidade. Não foi alterada a autenticação nem habilitado cadastro de visitante, seleção de pessoa/dependente, inscrição familiar, cancelamento ou promoção.

### Bloqueios por funcionalidade

| Funcionalidade | Dependência |
| --- | --- |
| Consulta/inscrição individual e prevenção de duplicidade | #33, identidade #15, DTOs reais, erros de concorrência e capacidades por recurso |
| Ocupação e última vaga | #34; snapshot autorizado e semântica de atualização após 409 |
| Janela pública versus ação administrativa | #35; autorização efetiva, data/estado da ocorrência e contrato de elegibilidade |
| Cancelamento e liberação de vaga | #36; idempotência, histórico e mensagens reais |
| Fila/promoção normal e excepcional | #37, capacidades e justificativas auditadas no contrato; não criar exceção no cliente |
| Reagendamento, reconfirmação e ofertas | #38–#40; contratos/estados e limites de prazo |

Existe divergência documental: a issue frontend #5 ainda aponta inscrição durante IN_PROGRESS como pendente, enquanto backend #35 a inclui na baseline. Nenhum desses fluxos é habilitado por este incremento. Reconciliar o requisito antes de expor a ação; não inferir permissão de janela pública ou status da conta.

## Testador

| Comando | Resultado local |
| --- | --- |
| `npm ci` | Passou, 264 pacotes; 10 alertas preexistentes (8 moderados, 2 críticos) na cadeia de ferramentas já registrados na FE-04 |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 63 testes passaram: 27 novos e 36 regressões |
| `npm run build` | Passou, Vite 7.3.7 |

Cobertura nova: vagas/lotação/capacidade zero e desconhecida; números inconsistentes; confirmação sem presença; inscrição cancelada/ausente; espera/posições inválidas; fila desabilitada; eventos abertos; snapshot de outra igreja/ocorrência; loading/erro/conflito sem dados antigos; ausência de chamadas/storage, campos privados, botões e links. Os testes existentes de navegação/guardas permanecem passando.

Não executados: inscrição real, busca/cadastro de visitante, confirmação concorrente/duplicada, 409 com refetch real, cancelamento/promoção/justificativa, permissão concedida/revogada no servidor, notificação, ensaio visual/teclado/leitor de tela. Flex-wrap e estilos foram inspecionados; jsdom não prova comportamento visual responsivo.

Parecer: **APROVADO COM RESSALVAS para componentes isolados**. Aceite funcional da #5 bloqueado.

## Revisor

Papéis executados sequencialmente conforme configuração, sem ativação automática de agentes separados. Revisão de arquitetura, diff, estados discriminados, acessibilidade e segurança:

- Reutiliza contexto/estilo existentes, sem nova biblioteca ou DTO presumido. Modelos discriminados impedem associar resumo de inscrição a evento aberto em entradas tipadas.
- Seção nomeada, heading, aria-busy, status/alert e listas de definição sem tabela larga. Não há controle inoperante que sugira gravação.
- Campos de pessoas, documentos, autorizações legais e links privados não entram no modelo nem são refletidos por spread. Não há coleta ou persistência de dados de menores.
- Contexto incorreto oculta snapshot; isso não é autorização. O futuro adaptador deve fornecer somente projeção do sujeito autorizado pelo servidor e validar o contrato real.

| Severidade | Evidência/local | Impacto/encaminhamento |
| --- | --- | --- |
| ALTO — dependência funcional | EP-04/05 sem contrato de inscrição consumível | Impede aceite integral; manter componentes isolados e sem ações |
| MÉDIO — divergência de requisito | Frontend #5 versus backend #35 em IN_PROGRESS | Reconciliar antes de expor inscrição administrativa durante ocorrência |
| CRÍTICO — alerta preexistente de ferramenta | Vitest/tinypool do lockfile, registrado na FE-04 e novamente sinalizado no npm ci | Manutenção de compatibilidade pendente; nenhuma dependência alterada nesta issue. Não alegar correção ou exploração comprovada |
| BAIXO — limite de validação | Sem ensaio visual/AT/integração real | Executar antes de liberar a interface integrada |

Nenhum defeito CRÍTICO/ALTO introduzido foi identificado. Parecer: **APROVADO COM RESSALVAS para o incremento isolado; aceite funcional integral bloqueado**. Não equivale a aprovação humana de merge.

Somente #5 executada. PR draft, sem merge/deploy. Aguardar aprovação antes de outro incremento ou da #6.
