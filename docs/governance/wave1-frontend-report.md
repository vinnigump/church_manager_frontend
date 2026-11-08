# Onda 1 - relatório técnico de encerramento do Frontend

Issue canônica #1; relacionadas #2/#3/#4/#31/#34 e backlog backend64. Fundação,
Eventos, UI-RIO e planejamento; prioridades P0/P1/P2 conforme escopo. Codex,
2026-11-08 UTC. Branch `codex/wave1-review-report`, base main a58e2a8.
SHA/PR/CI finais desta entrega no corpo do PR. Revisão sequencial no mesmo agente;
não declarar independência ou aceite humano. Não iniciar automaticamente Onda2.

## 1. Preparação e fontes atuais

Lidos AGENTS, README, papéis, governança e auditoria Onda0 de08/11/2026 (PDF
entregue ao usuário); consultadas issues FE01..06 e UI-RIO01..08 (#1..6/#28..34,
UI07 nos complementos5/6), comentários e backend64 CF/AP. Para especificações,
consultadas backend14/15/66/67/72 com precedência das decisões posteriores.

Frontend main a58e2a86a0e1fe65b11afbdf026362491d91a002; backend master
efc5990003534c72b7a2b55db100e08edbdf7a23. PRs89/90 abertos e mergeáveis no início,
sem comentários; nada consumido como dependência integrada. Aplicação e worktrees
do usuário preservadas, inclusive documentos não rastreados e alterações IDE do
backend. Sem merge/deploy, reinício de aplicação, alteração de banco ou credenciais.

## 2. Plano, execução e estado real

Os rótulos W1 abaixo são atividades desta onda, não renumeração das issues FE.

| Atividade | Issues | Prontidão | Implementação / resultado |
| --- | --- | --- | --- |
| W1-01 revisar89/90 | #1/#4 | READY no incremento | VALIDATED técnico:89 aderente;90 corrigido em autenticação documental; revisão externa/integração pendentes |
| W1-02 fundação/Basic/guardas | #1; contexto #2 | READY para revisão independente de novos contratos | VALIDATED técnico no escopo existente; nenhum defeito funcional novo comprovado, sem reescrita artificial |
| W1-03 D1/D2/D4 | #31/#4/#34 | READY da fatia;31 integral PARTIAL | IMPLEMENTED/VALIDATED técnico no PR91;8 regressões novas; visual final manual pendente |
| W1-04 revisar Eventos/preparar público | #4 | PARTIAL | existentes revisados; preparação documental do público; integração pública BLOCKED enquanto122 não integrado |
| W1-05 identidade/Jornada | #2/#3/#33 | PARTIAL documental; fluxos BLOCKED | especificação IMPLEMENTED no PR92; autocadastro/ativação/convite/recuperação/Jornada/trilhas funcionais NOT_STARTED |
| W1-06 encerramento | #1/#34 | READY documental | relatório e roteiro final; nenhuma execução de Onda2 |

Não houve entrega simulada de inscrições, fila, check-in, indicadores ou cadastro
de pessoas. Aprovação visual de composição não define API/permissão/regra ausente.

## 3. Revisão dos PRs89 e90

### PR89 - janela administrativa

Branch `codex/fe-04-registration-window`, SHA
48156e69b90a6647a270f85434ddc7ae8d8f684b. GET/PUT/DELETE correspondem a
event-registration-window-v1 1.0.0 integrado no backend121. EVENT_VIEW/EVENT_EDIT
CHURCH; Basic/CSRF, par explícito de datas, abertura<fechamento<=início, precisão
de microssegundos e REGISTRATION_REQUIRED. DELETE deixa ausência, não janela
ilimitada. Revisão compartilhada/no-op e leitura de ocorrência/janela com revisão
igual; foco reautoriza, mantém original e desfaz confirmação; tentativa incerta
exige consulta, troca de contexto aborta cliente sem prometer rollback.

Nenhum achado técnico bloqueador comprovado nesta revisão. npm lint/typecheck/
1329 testes50 arquivos/build PASSARAM novamente. CI42525879298 verde.
Pronto tecnicamente para integração autorizada, sem efetuar merge/aceite humano.
55 testes da janela são cliente com HTTP simulado, não ensaio de backend vivo.

### PR90 - documentação de backlog

Branch `codex/docs-current-backlog`, head anterior6cc74a1 revalidado1274/49.
Encontrado problema documental comprovado: tabela FE02 ainda dizia APIs de OTP
como dependência definitiva, contradizendo CF/AP. Corrigido no novo SHA
e802663bcf203f9e796b87a02448696ecdf315ae: autocadastro com senha/canal exclusivo,
convite/ativação/recuperação/Jornada/dependentes. Basic em produção não alterado.
Relatório anterior preserva evidência histórica e registra a correção Onda1.
Lint/typecheck/1274 testes49 arquivos/build PASSARAM novamente após correção.
Novo CI42533237651 PASSOU no e802663, sem reutilizar o verde antigo42526145717.
Pronto tecnicamente para integração autorizada; revisão externa pendente.

## 4. Fundação, sessão, navegação e segurança

Revisados api.ts, session-contracts, auth.tsx, LoginPage, PasswordPage,
useSignOut, loginDestination/LoginRedirect, ResourceAccess e AppLayout. Basic e
CSRF somente em memória; cache no-store, mesma origem, erros públicos uniformes
sem corpo privado. Geração de sessão descarta resposta/401 antigos. Saída limpa
sessão local; não promete invalidação remota. Redirect aceita caminho interno
restrito; queries/fragmentos não migram para retorno.

ResourceAccess nega por padrão, vincula decisão a conta/recurso/tentativa e
reconsulta no foco; concessão local vazia não é fallback. Backend decide cada
operação. Descoberta de contextos e sessão técnica seguem pendentes: não inferir
privilégio pelo login nem conceder /admin com grants inventados.

Testes existentes reexecutados: api, api-json, session-contracts, authorization,
login-return, LoginPage, HomePage, AppLayout, navigation, PasswordPage e Segurança.
Cobrem Basic/CSRF,401, saída durante login,401 de sessão antiga, autorização
pendente/erro/negação/revogação, mudança de contexto e retorno protegido.
Resultado no head90 novo e baseline:1274/49,0 falhas/ignorados. Sem falha
funcional independente comprovada que justifique mudar autenticação na onda.

## 5. D1/D2/D4 - entrega PR91

Branch `codex/wave1-template-presentation`, SHA
0669e6f3f0959114b51827f0820ce79edc4094d9. Relatório específico:
https://github.com/vinnigump/church_manager_frontend/blob/codex/wave1-template-presentation/docs/design/wave1-template-presentation.md.

Componentes modificados: TemplatePages, TemplateManagement, ChurchCatalogPage,
AnnualCalendarPage e event-admin.css; novo TemplatePresentation.test.tsx.
Referência aprovada rio-template-lifecycle.html copiada para docs/design/rio-v1,
SHA256 conferido a5c47da124a63034d99b078480797cf5336a3e252c9bdf2c134ba82e6993ec0e.

D1: variantes secundárias de atualizar/paginar/cancelar, atenção acompanhada de
consequência textual e ações com wrap/coluna mobile fora de form.
D2: identificação/estado/referência ID fora da paginação; não inventa nome
publicado ausente no DTO raiz. Nomes/números/UTC reais continuam no histórico.
D4: descontinuação na região de disponibilidade depois do histórico, separada
de edição/publicação. Estados reais preservados, sem reativação/exclusão.
Cancelar publicação/descontinuação devolve foco ao acionador sem escrita nem
perda de edição. Trava da mesma mutação continua compartilhada entre seções.

Testes novos verificam ordem DOM/regiões nomeadas, referência com histórico vazio,
nome180, estados, cancelamento/foco e revogação.1282/50 passaram; lint/typecheck/
build passaram. CI42532885772 aprovado. Visual não foi solicitado no meio da onda;
teste DOM/CSS não comprova geometria renderizada, dispositivos ou zoom nativo.

## 6. Revisão das integrações administrativas

Inventário real em master e clientes correspondentes inspecionados; permissão
de leitura não autoriza escrita. Nenhuma API nova foi criada ou presumida.

| Área / contrato integrado | Cliente/tela | Resultado e limite |
| --- | --- | --- |
| identity0.3.0/self-authorization1.0.0 | api/auth/authorization/conta | Basic/CSRF/decisão pontual aderentes; sem cadastro público/descoberta |
| catálogo1.0.1 | catalog-api/ChurchCatalogPage/TemplatePages | origem/habilitação/obrigatoriedade, paginação e permissão próprias |
| templates1.0.1 | template-api/TemplateManagement | revisões raiz versus rascunho; histórico, publish/discontinue preservados |
| calendário1.0.0 | calendar-api/AnnualCalendarPage | publicar planejamento não publica ocorrências |
| ocorrências1.1.1 | occurrence-api/OccurrencePages/Filters | filtro interseção [from,to), DRAFT nunca publicado, CSRF/CAS;422 do servidor preservado |
| lifecycle1.1.0 | lifecycle-api/OccurrenceTransitionPage | equipe coordenadora validada no servidor; overrides vazios, sem exceção crítica inventada |
| espaços1.0.1 | planning-api/PlanningPage/SpaceEditorPage | código exato, conflito administrativo não prova publicação/disponibilidade |
| planejamento1.0.0/séries1.0.0 | generation/copy/series-api e páginas | ano/fuso do servidor, prévia/seleção/revisão; sem RRULE livre ou retry que duplica lote |
| equipe1.0.0 | team-api/OccurrenceTeamPage | consulta/liberação preservadas; nova inclusão precisa seleção autorizada |
| audiência1.0.0 | audience-api/AudiencePage | política explícita, sem default PUBLIC/fatos do cliente; novas referências dependem catálogo autorizado |
| janela1.0.0 | window-api/RegistrationWindowPage no89 | configura limites, não inscrição; aderência revista nesta onda |
| grupos1.0.0 | group-api/GroupAccess | leitura/histórico/saída; liderança exata validada no servidor, sem inferir membresia formal |

Observação de compatibilidade a levar ao backend: ocorrências1.1.1 protege
redução de capacidade com PENDING/CONFIRMED legados; produto estabelece somente
CONFIRMED para ocupação no futuro fluxo de inscrição. Frontend atual não calcula
ocupação nem relaxa422. Reconciliar o escritor de inscrição antes de integrar
capacidade/fila, sem alterar regra funcional ou fabricar vagas nesta onda.

## 7. Preparação para calendário público

Backend122 permanece não integrado na inspeção final deste relatório. A proposta
event-public-calendar-v1 é referência para planejamento, nunca dependência atual.
Não criada rota/cliente que a consuma antes da integração. Próxima onda deverá:
1. Conferir merge efetivo, contrato final e CI; reler política pública e DTO.
2. Consumir apenas projeção mínima autorizada, lista/total do servidor, no-store;
   sem links privados, seleção de sujeitos ou fatos/idade enviados pelo cliente.
3. Tratar anônimo PUBLIC versus conta real nas demais visibilidades conforme
   contrato;404 não confirma existência restrita,401 não é permissão pública.
4. Validar schema/contexto/filtros/paginação, limpar dados ao mudar sessão/igreja;
   não reutilizar cache entre sujeitos nem usar totais administrativos como públicos.
5. Testar leitura/erro/vazio/IDOR/resposta tardia e audiência sem conceder direito
   de inscrição. Cadastro/inscrição permanecem contratos separados.

## 8. Planejamento de identidade/Jornada - PR92

Branch `codex/wave1-identity-spec`, SHA865d799ddbd6bffe246e466372de26afa421d479.
Documento docs/planning/wave1-identity-journey.md: seis áreas especificadas,
inventário de contratos, DoR, exceções C1/C2/C3/C6 e12 cenários futuros de aceite.
Autocadastro com senha/canal exclusivo; convite manual e ativação pelo titular;
recuperação prioritariamente própria; Jornada/contexto/dependentes autorizados;
trilha comum automática versus oficial na versão inicial. Sem implementação.
Lint/typecheck/1274 testes49 arquivos/build e diff check passaram no código
inalterado. CI42533204111 PASSOU no865d799. Testes de features futuras são
NAO_TESTADO, não simulados como reais.

## 9. Telas para validação manual ao final da onda

Somente agora é apresentada a relação; não houve solicitação visual intermediária.
Não reiniciar aplicações automaticamente. Revisões estão em branches separadas,
não integradas silenciosamente em main ou entre si.

| Branch/revisão | Acesso autorizado | Estados a validar manualmente |
| --- | --- | --- |
| codex/wave1-template-presentation @0669e6f | /eventos/denominacoes/:denominationId/templates/:typeId | rascunho, publicado sem/com rascunho, confirmação/cancelar publicação, disponibilidade/descontinuação, descontinuado; referência/histórico/UTC/nome longo/foco |
| mesma branch | catálogo denominacional, catálogo da igreja, calendário anual existentes | ações primárias/secundárias, paginação, erro/vazio/negação, confirmar/cancelar, texto longo |
| codex/fe-04-registration-window @48156e6 | detalhe autorizado -> janela-inscricao | ausência, configuração, modo incompatível, limite no início, remoção explícita, conflito e resultado incerto |
| main ou branches de aplicação acima | /, /entrar, /conta, /conta/senha | Home pública sem menus, Basic/retorno, mostrar senha, logout/expiração, navegação/foco |

Contextos reais vêm de links autorizados, não digitação de UUID inventado.
Conta com permissões adequadas e dados de homologação são necessários para cada
estado. Não declarar estado disponível no banco apenas porque teste o simula.
Conferir320/360/390/768/1024/1440px, zoom200%, teclado/foco, alvos44x44, campos16px,
textos/confirmadores e estados críticos. Safari/iOS/AT só com evidência própria.
PR90/92 e este relatório são documentais, sem novas telas para homologar.

## 10. Evidências, revisão e decisão

| Critério da Onda1 | Resultado | Evidência |
| --- | --- | --- |
| R01 rever89/90 e aderência | PASSOU | contratos/serviço/cliente, checks reais e comentários nos PRs/issue1 |
| R02 preservar Basic/guardas sem regressão | PASSOU | revisão e suíte existente, sem autenticação nova |
| R03 reconciliar D1/D2/D4 com diferenças comprovadas | PASSOU | PR91,1282 testes,8 novos e CI verde |
| R04 rever Eventos e preparar público sem endpoint pendente | PASSOU | matriz e checklist seção7 |
| R05 especificar identidade/Jornada sem implementar | PASSOU | PR92 e matriz12 cenários futuros |
| R06 relatório/rastreabilidade/telas/recomendações | PASSOU | este relatório, PRs e comentários nas issues |
| R07 aceite visual manual e revisão externa | NAO_TESTADO | produto/revisor externo, sem bloquear entregas independentes |

Ambiente Windows/Node24.22.1. Instalação npm ci onde necessário;7 alertas moderados
preexistentes de tooling, sem atualização forçada ou novas dependências.
Não somar suítes repetidas como número de testes exclusivos. Não foram
executados testes de backend vivo, dispositivos ou fluxo ponta a ponta.
O CI do próprio relatório e SHA final devem ser registrados no PR.
Nesta branch documental, npm ci/lint/typecheck/test/build também PASSARAM:
1274 testes/49 arquivos,0 falhas/ignorados. Não são testes de novas features;
aplicação permanece igual à base. Diff check passou antes do commit.

Parecer técnico sequencial APROVADO_COM_RESSALVAS: sem achado crítico/alto
remanescentes identificado no escopo implementado, com limites de integração,
contratos futuros e homologação final explícitos. Não equivale a revisão
independente ou aceite humano. PODE_CONCLUIR issues1/2/3/4/31: NAO.

Recomendações da próxima onda, não iniciada: integrar somente após aprovação;
revalidar122; obter contratos e critérios de autocadastro/convite/ativação/
recuperação/Jornada/trilhas; refinar menores/dispensa/retomada, cadastro/perfil/
deduplicação e fórmulas dos indicadores. Não confundir prontidão documental
com liberação funcional. Encerramento da execução Onda1, aguardando revisão e
validação manual do produto; sem início automático da Onda2.

```yaml
atividade: W1-FRONTEND-REVIEW-REPORT
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 7
criterios_comprovados: 6
testes_aprovados: 1274
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: APROVADO_COM_RESSALVAS_TECNICO_SEQUENCIAL
prs: [89, 90, 91, 92]
bloqueios: ["Integração pública aguarda122; contratos futuros e critérios funcionais pendentes"]
proxima_acao: "Revisão externa e validação visual manual final; não iniciar Onda2"
pode_concluir: false
aceite_humano: PENDENTE
```
