# FE-04 — erro controlado para datas e fusos inválidos

## Implementador

Branch `fix/fe-04-invalid-agenda-dates`, base `origin/main` 9a6b75e, independente do PR #15 de ferramentas. Issue #4 reconciliada e comentários consultados (sem comentários). Instruções, componentes e testes existentes inspecionados.

Problema reproduzível por inspeção/teste: EventAgenda chamava Intl.DateTimeFormat em qualquer fuso/data fornecido e podia lançar RangeError durante render. Data sem offset dependia do ambiente do usuário; períodos invertidos podiam ser apresentados como normais.

`canDisplayAgenda` valida fuso, instantes com offset explícito, data de calendário real e fim posterior ao início, antes de formatar/filtrar. Se o snapshot da igreja corrente é inválido, a agenda mostra alerta e não oferece listagem parcial ou fallback silencioso de fuso. Primeiro restringe ao contexto atual: dado inválido de outra igreja não interfere no snapshot exibido. Comparação local continua sendo somente defesa de apresentação, sem constituir autorização backend.

Não altera contratos, datas armazenadas, regras de domínio ou APIs. Não conecta os componentes isolados a endpoints presumidos. A reconciliação da issue #4 confirma recorrência anual e APIs EP-02/03 pendentes; nenhuma recorrência nova foi criada.

## Testador

- `npm ci`: passou com lockfile da base, sem depender de Vitest 5 do PR #15.
- `npm run lint`, `npm run typecheck`, `npm run build`: passaram.
- `npm test`: 114 testes passaram, nove novos e 105 regressões sob Vitest 3.2.7.
- Novos casos: fuso inválido, data malformada, ausência de offset, data inexistente (30/02), fim malformado/igual/anterior, outra igreja inválida e offset explícito válido.

Sem testes ponta a ponta, medições visuais ou backend vivo: componente permanece isolado e essa correção não depende de API. O build da aplicação permanece igual porque o componente ainda não está montado no produto.

## Revisor

Papéis executados sequencialmente. Diff restrito ao validador de apresentação, uso no componente, regressões e relatório. Mensagem de erro genérica sem dados sensíveis; sem lista parcial ou concessão de acesso. Sem armazenamento, chamadas HTTP, alteração de autenticação ou fluxo de menores.

Parecer **APROVADO para a correção isolada**, sem achados críticos/altos introduzidos. Limites preexistentes: integração funcional da #4 bloqueada por APIs; alertas de ferramentas da base tratados independentemente no PR #15. Não substituir validação do futuro DTO/adaptador backend por este helper.

Sem merge/deploy. Após publicação, conferir revisões e merges dos PRs anteriores e seguir outra atividade independente conforme autorização do usuário.
