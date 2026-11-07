# FE-01 — retorno ao acesso solicitado após login

## Implementador

Issue #1, branch codex/fe-01-return-after-login, base origin/main 6a5e43c.
Independente do PR #22: não usa componentes/rotas/DTOs ainda não integrados.
Lidos AGENTS, README, papéis, execução Eventos, issue #1 (sem comentários),
cliente/autenticação/guardas/testes vigentes, AccountController e configuração
HTTP Basic/CSRF do backend real. Nenhum endpoint ou contrato novo necessário.

Antes: abrir um catálogo sem sessão redirecionava a Entrar, seguido de Minha conta,
exigindo reabrir o acesso original. Agora Guard e ResourceAccess usam LoginRedirect,
que leva somente pathname ao estado do roteador. Login autentica pelo fluxo existente
e retorna ao caminho interno validado. Permissões são consultadas novamente na rota.
O fallback continua /conta para login direto ou destino inválido.

O destino rejeita URL externa, caminho de rede, escapes, barras invertidas, espaços,
query, fragmento e retorno ao próprio login. Query/hash/state anterior da rota
protegida não são copiados. Nenhuma credencial/token, storage ou query de retorno
é adicionada. O destino fica no estado da navegação do navegador, não no backend;
não é uma funcionalidade de sessão persistente ou descoberta de contextos.

Login inválido preserva destino para nova tentativa. Em sessão expirada, o mesmo
fluxo leva ao recurso e reconsulta autorização depois de autenticar. Administração
permanece negada por padrão. Não promete invalidação remota no logout.

## Testador

Dependências reproduzidas com npm ci nesta sessão antes de trocar de branch;
package-lock e package.json inalterados entre os dois incrementos. Sete moderados
existentes reportados, sem audit fix forçado ou alteração de dependências.

Lint, typecheck, 191 testes (20 novos + 171 da base), build e diff --check passaram.
Os 50 testes do PR #22 não pertencem à base desta branch independente.

Casos: login a partir de catálogo, consulta de permissão antes de dados, negação
real de leitura, /admin negado, login direto, falha seguida de nova tentativa,
401 seguido de reautenticação, foco/título e descarte de query/hash/state anterior.
Destinos inválidos exercitados pela navegação completa do login até Minha conta.
Uma execução inicial detectou ambiguidade na consulta de status do componente de
sondagem do teste; corrigido o elemento de teste, sem alterar regra de produção.

Respostas controladas com AuthProvider/cliente reais. Sem backend vivo, ensaio
visual ou tecnologia assistiva. CI remota deve ser conferida após publicação.

## Revisor

Papéis sequenciais pelo mesmo agente, sem revisão independente. Conferidos diff,
validação do destino, guardas e Basic/CSRF intactos. Navegação não substitui nenhuma
decisão de autorização. Sem achado crítico/alto identificado; parecer favorável com
limites de validação visual/AT e ponta a ponta. Revisão humana do PR pendente.

PR #22 reconsultado ao concluir: aberto em rascunho, sem comentários; CI 42376231710
concluída success no head 2f3da60. Sem merge/deploy ou escrita na principal.
