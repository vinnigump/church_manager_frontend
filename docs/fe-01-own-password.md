# FE-01 — alterar a própria senha

Contrato real: identity-v1.openapi.json, AccountController, AccountModels,
AccountService e SecurityConfiguration do backend origin/master. POST
/api/v1/accounts/me/password exige identity:self, Basic/cookie/CSRF e recebe
currentPassword/newPassword, retornando 204. Serviço confere senha atual e conta
ativa; nova senha tem 12–72 caracteres e no máximo 72 bytes em UTF-8. Não há
requisito publicado de classes de caracteres nem proibição local de repetir senha.

Minha conta oferece /conta/senha protegida pelo Guard autenticado. A conta da sessão
é obtida por accounts/me com identity:self; não inventamos autorização contextual
DENOMINATION para uma operação pessoal. Servidor autoriza cada solicitação.

Formulário tem senha atual, nova e confirmação; autocomplete apropriado, rótulos,
validação de tamanho/UTF-8 e confirmação, sem alterar espaços da senha. Campos
limpos antes da rede. Credenciais não entram em estado React, logs ou storage;
Basic permanece no cliente em memória conforme a autenticação existente.

Uma trava síncrona impede duplo envio; não há retry automático. Sucesso encerra
sessão local, limpa Basic/CSRF e exige novo login. Aviso discriminado permanece
apenas no AuthProvider e é limpo no login ou saída comum; não recebe mensagem livre
de URL/servidor. Não prometemos invalidação de sessões remotas. Respostas após
desmontagem não comandam logout de outra tela/sessão.

400/403/404/409 são rejeições tratadas sem corpo bruto, campos permanecem vazios.
401 segue expiração existente. Rede, 5xx ou resposta incompatível bloqueiam outro
envio até encerrar a sessão local e verificar as credenciais com novo login.
Não se presume falha nem sucesso de uma escrita incerta.

Papéis Implementador/Testador/Revisor executados sequencialmente pelo mesmo agente.
Testes identificaram perda do aviso na corrida entre logout e guarda; correção usa
estado efêmero de sessão em vez de depender do estado de navegação descartável.
Revisão final conferiu payload, limites reais, CSRF dinâmico, limpeza, trava e erros.

Lint, typecheck, 472 testes (15 novos sobre main com 457), build e diff --check
passaram. Independente do PR #39, também com 15 testes próprios: números iguais
nestas branches não significam que as duas entregas estão integradas. Após merge
externo de #39, rebase em b36bf29 preservou as duas rotas e os dois relatórios;
lint/typecheck/487 testes/build/diff --check passaram na base combinada. npm ci já
executado nesta sessão; lockfile intacto. Respostas controladas nos testes.
Backend vivo e ensaio visual/AT pendentes; Browser Use recusou origem local,
sem tentativa de contorno. Não constitui homologação UI-RIO. Sem merge/deploy.
