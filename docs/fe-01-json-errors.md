# FE-01 — mensagens seguras para falhas de leitura JSON

## Implementador

Issue #1, branch codex/fe-01-json-errors, base origin/main 6c751ca, independente
 do PR #25. Ao iniciar: PR #25 aberto em draft, sem comentários, CI em execução.
Lidos issue #1/comentários (sem novos), instruções/papéis vigentes, cliente/login,
OpenAPI identity-v1 para accounts/me e csrf e contratos Basic/CSRF existentes.

Reprodução automatizada com Response real contendo texto sintético inválido:
response.json rejeitava com SyntaxError que incluía trecho do corpo recebido.
ApiClient propagava essa mensagem e Login a exibia no alert. Os testes de regressão
falharam antes da correção, inclusive nos dois endpoints do login.

Agora falhas ao ler/interpretar JSON viram mensagem estática em português, sem corpo
ou causa bruta. A geração de sessão é checada também no catch de leitura; erro de
corpo de um login antigo não limpa credenciais da sessão nova. Sem HTTP status
fabricado, storage, logs, endpoint, schema ou mudança de Basic/CSRF/autorização.
204 continua retornando undefined sem parse. Erros HTTP conservam o tratamento atual.
Não há retry automático, inclusive em escrita com resposta de resultado incerto.

## Testador

Dependências reproduzidas com npm ci nesta sessão; mesmo package/lockfile inalterado,
sete moderados existentes reportados. Lint, typecheck, 281 testes (9 novos + 272 da
base integrada), build e diff --check passaram. Os 26 testes do PR #25 não pertencem
à base independente desta branch.

Regressões novas: texto inválido/corpo vazio/JSON truncado, 204, login com accounts/me
ou csrf malformado, limpeza de Basic/CSRF após falha, não repetição de escrita e erro
de corpo antigo durante leitura assíncrona após novo login. Inicialmente 8 dos 9
falharam no comportamento anterior; todos passam com a correção.

Testes usam Response real e AuthProvider; a corrida de leitura usa promessa controlada.
Sem backend vivo, banco real, ensaio visual ou tecnologia assistiva.

## Revisor

Papéis sequenciais no mesmo agente, sem revisão independente. Conferidos diff curto,
privacidade da mensagem e precedência da geração de sessão. Sem achado crítico/alto
remanescente identificado; parecer favorável para a correção com validação humana
pendente. Não amplia validação de schemas além do trabalho atual nem conclui a #1.

Ao concluir, PR #25 novamente consultado: aberto, sem comentários, CI 42377678156
concluída success. Sem merge/deploy pelo agente. CI desta branch conferir após push.
