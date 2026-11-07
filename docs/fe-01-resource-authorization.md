# FE-01 — consulta autenticada de autorização por recurso

## Implementador

Incremento da issue #1, branch `feat/fe-01-resource-authorization`, base `origin/main` 60d96f8 após merge humano do PR #12. Lidos AGENTS.md, README e três papéis. Issues abertas e comentários #1 consultados (sem comentários). PRs backend #60–#63 e arquivos vigentes verificados; código da principal, não só proposta, usado como evidência.

### Contrato implementado no backend

[OpenAPI própria autorização 1.0.0](https://github.com/vinnigump/church_manager/blob/master/docs/api/self-authorization-v1.openapi.json), blob `2ca1ae5424e48930fbc15e3a1d9a48d6cb66ceb1`, e [SelfAuthorizationController](https://github.com/vinnigump/church_manager/blob/master/src/main/java/br/com/churchmanager/security/api/SelfAuthorizationController.java) confirmam:

```text
GET /api/v1/accounts/me/authorization
  ?permissionCode=<código>
  &resourceType=CHURCH|DENOMINATION
  &resourceId=<UUID>
200 { "allowed": boolean }
```

Basic, identity:self e Cache-Control no-store. Erros documentados: 400, 401, 403. Código desconhecido/recurso ausente/escopo insuficiente podem retornar allowed=false. O servidor determina o ator; não se envia userId nem lista de grants. Administrador técnico externo não recebe acesso por inferência.

[Catálogo Events vigente](https://github.com/vinnigump/church_manager/blob/master/docs/events/evt-003-permissoes.md) documenta EVENT_VIEW e outros códigos independentes. Permissão não habilita API inexistente nem torna sua resposta credencial para outra operação. A [configuração de segurança principal](https://github.com/vinnigump/church_manager/blob/master/src/main/java/br/com/churchmanager/security/config/SecurityConfiguration.java) libera a consulta, mantendo rotas de negócio de Eventos negadas por padrão.

### Mudança

`consultAuthorization` usa o cliente HTTP existente, parâmetros codificados por URLSearchParams e validação em runtime do objeto estrito `{ allowed: boolean }`. Não aceita verdade por string/número nem propriedades extras do contrato. Não altera Basic/CSRF e não persiste decisões/credenciais.

`ResourceAccess` é uma guarda reutilizável de UX para futuros pontos integrados. Consulta o servidor por combinação permissão/tipo/ID; não combina permissões e escopos de fontes independentes nem usa grants estáticos como fallback. Carregamento, negação e erro ocultam children. Erro oferece nova tentativa explícita. 401 reutiliza a invalidação de sessão existente.

Decisão vinculada à instância atual da conta e à consulta. Trocar recurso, permissão, tipo ou sessão oculta o conteúdo anterior durante o render, antes do novo efeito. Cleanup aborta e ignora requisições antigas. Mesmo uma resposta atrasada que ignore AbortSignal não atualiza o estado do contexto novo. Foco da janela dispara nova consulta; ao recarregar, children ficam ocultos.

Não há enumeração de igrejas autorizadas, tela com UUID digitado, ativação do `/admin` global ou montagem dos componentes isolados de Eventos. A guarda está preparada para ser composta com rotas cujo contexto e operação tenham contratos publicados. Nenhum endpoint de Eventos foi presumido. Não é polling nem assinatura em tempo real: uma decisão pode mudar no servidor enquanto a janela permanece aberta; **cada operação backend deve reautorizar**, independentemente da UX.

## Testador

| Comando | Resultado local |
| --- | --- |
| `npm ci` | Passou; mesmos 10 alertas preexistentes de ferramentas, 8 moderados/2 críticos |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 105 testes passaram, 21 novos + 84 regressões |
| `npm run build` | Passou, Vite 7.3.7 |

Testes novos: query exata sem ator; no-store/cookies; Basic real do cliente; resposta malformada/fora do schema; anônimo sem request; carregamento; allowed true/false; falhas HTTP e rede sem vazamento do corpo; retry; troca de recurso e descarte de resposta antiga; nova sessão da mesma conta; reconsulta por foco/revogação; 401 com AuthProvider real.

São testes do cliente e componentes com respostas controladas conforme o contrato publicado; **não são chamadas contra um backend em funcionamento**. Não executados: ponta a ponta com conta sintética no servidor, concessão/revogação transacional real, layout/teclado/leitor de tela, APIs de negócio de Eventos. Nenhuma concessão ou banco foi alterado.

Parecer Testador: **APROVADO para o incremento cliente/guarda com ressalva de ensaio backend real pendente**.

## Revisor

Papéis executados sequencialmente conforme configuração; não são três processos independentes. Revisão do diff, contrato publicado, estados e testes:

- Contexto e sessão vinculados à decisão; comparação durante render evita mostrar concessão anterior. Sem fallback permissivo.
- Aborto e flag de atividade tratam efeitos descartados/StrictMode; sessão segue a geração protegida do ApiClient existente.
- Parâmetros não incluem ator ou dados de menores; corpo de falha não é refletido. Sem logs/storage, dados simulados de produção ou concessões locais.
- Retry usa botão e erros/loading usam alert/status; conteúdo protegido não é renderizado durante falha ou consulta.

| Severidade | Evidência/impacto | Encaminhamento |
| --- | --- | --- |
| ALTO — bloqueio funcional de Eventos preexistente | Permissões/consulta não fornecem CRUD/calendário/inscrições/presença | Manter preparações #4/#5/#6 isoladas até contratos de negócio |
| MÉDIO — limite de decisão de UX | Ausência de atualização em tempo real entre consultas | Reconsulta em montagem, mudança de contexto/sessão, foco e retry; backend deve autorizar cada operação |
| CRÍTICO — alerta preexistente de ferramenta | Vitest/tinypool no lockfile, registrado anteriormente e sinalizado em npm ci | Manutenção própria pendente; dependências preservadas, sem alegar correção ou exploração comprovada |
| BAIXO — verificação pendente | Sem ambiente backend sintético exercitado nesta entrega | Executar ensaio ponta a ponta antes de declarar integração operacional validada |

Nenhum defeito crítico/alto introduzido foi identificado. Parecer: **APROVADO COM RESSALVAS para o incremento da #1**. Não conclui integralmente a #1, habilita Eventos ou substitui aprovação humana. PR draft, sem merge/deploy.
