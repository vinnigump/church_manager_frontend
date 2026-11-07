# FE-04 — criação inicial de template denominacional

## Implementador

Issue #4, branch codex/fe-04-create-denomination-template. Atividade iniciada sobre
origin/main 7de2ed7, independente do PR #24 então aberto, sem comentários e com CI
em execução. Ao concluir, PR #24 reconsultado: merge externo confirmado, parecer
favorável lido e CI 42377206094 success. Branch atualizada por rebase sobre main
6c751ca; composições e suíte final verificadas após integração, sem conflitos.

Lidos issue #4/reconciliação/comentários (sem novos), instruções e papéis vigentes,
OpenAPI event-type-catalog-v1 1.0.0, EVT-005/006, EventTypeCatalogController/Service e
SecurityConfiguration. Arquivos de contrato/serviço sem diff contra origin/master.

POST /api/v1/events/denominations/{denominationId}/types envia somente name normalizado,
com Basic em memória, cookie e CSRF existentes. Backend exige EVENT_TEMPLATE_MANAGE
no recurso DENOMINATION e cria tipo DRAFT com rascunho inicial. O helper confirma
DTO DENOMINATION, obrigatório, enabled=false e nome correspondente; projeta somente
campos publicados. enabled de listagem não é convertido em lifecycle.

Formulário na rota de catálogo já integrada. Mensagem explica publicação posterior;
resposta confirmada oferece acesso ao detalhe e dispara GET separado do catálogo.
Falha do GET posterior não apaga criação confirmada. Nome inválido não envia escrita.
Nenhum formulário de UUID, permissão implícita, dado privado, log ou storage novo.

Hook acima da guarda mantém trava de escrita durante foco. Troca de contexto/conta
ignora resposta antiga; abort não equivale a desfazer transação no servidor.
Rede/5xx/schema inválido não confirmam sucesso, nem repetem POST automaticamente.
Falhas bloqueiam nova criação até consulta bem-sucedida iniciada após a falha;
contador de geração impede que um GET anterior libere nova escrita. Falha na própria
reconciliação mantém bloqueio. Paginação/refresh ficam desabilitados durante envio.
Nomes podem se repetir no domínio; consulta por nome não é alegada como idempotência.

## Testador

npm ci reproduzido nesta sessão com o mesmo package/lockfile inalterado. Sete moderados
existentes reportados, sem alterações de dependências. Após rebase, lint, typecheck,
298 testes (26 novos + 272 da main atualizada), build e diff --check passaram.

Cobertura: payload/normalização e Basic/CSRF/cookie/no-store, IDs/nome/DTO inválidos,
sem CSRF, autorização negada, sucesso/refetch/link ao detalhe, 400/403/404/409/422,
rede/500/schema inválido, ausência de retries, sucesso preservado após falha de GET,
reconciliação falha/antiga não libera escrita, duplo envio/foco, contexto trocado e
401 com AuthProvider. Suíte inclui gestão de versões já integrada no PR #24.

Testes com cliente/componentes reais e respostas controladas; sem backend vivo,
banco de uso, ensaio visual responsivo ou tecnologia assistiva. CI remota conferir
no novo PR. Nenhuma gravação de dados reais foi executada.

## Revisor

Papéis sequenciais pelo mesmo agente, sem revisão independente. Conferidos método,
permissão, estado inicial real, negação por padrão, confirmação e concorrência.
Revisão corrigiu liberação antecipada da criação antes de GET bem-sucedido e adicionou
regressões para leitura falha e resposta iniciada antes do erro. Sem achado crítico/alto
remanescente identificado. Parecer favorável com limites de ensaio visual/AT e ponta
a ponta. Aprovação humana do PR pendente, sem aceite integral da #4.

Sem merge/deploy pelo agente. Calendário/ocorrências e descoberta de contextos ainda
dependem de contratos próprios. Próxima atividade deve reconsultar os PRs novamente.
