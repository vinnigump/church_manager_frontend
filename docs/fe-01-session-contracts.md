# FE-01 — validação das respostas de sessão

## Implementador

Issue #1; branch codex/fe-01-login-response-validation. Iniciada independente do
PR #36, então aberto, sem comentários e com CI 42379475339 success. Ao concluir,
#36 confirmado merged por ação externa e revisão favorável lida. Branch atualizada
por rebase sobre main 3af86b4 e suíte combinada executada. Nenhum merge pelo agente.

Lidos requisitos e comentários atuais da #1 (registro visual UI-RIO não despachado),
identity-v1.openapi.json, AccountController/AccountModels e cliente/login/guardas.
Nenhuma reconstrução de autenticação ou mudança de layout/design foi realizada.

Antes, dados de /accounts/me e /csrf eram aceitos por cast TypeScript. Agora login
usa unknown, valida estrutura e projeta somente Account/Csrf contratados antes de
estabelecer sessão. Conta exige UUIDs, campos obrigatórios e limites do schema;
status continua string sem enum inventado e não concede permissões locais.
CSRF exige strings utilizáveis no protocolo HTTP, rejeita cabeçalho inválido/campo
reservado de credenciais e token vazio/inválido. Cabeçalho customizado válido do
servidor é preservado; não é fixado um nome no código.

Falha de validação usa mensagem estática sem payload e percorre a limpeza de
credenciais já existente. Geração de sessão checada antes do próximo GET e antes
de guardar CSRF impede que tentativa antiga estabeleça estado em outra sessão.
Nenhum storage/log, token público, JWT/OTP ou endpoint novo. UUID foi extraído para
utilitário sem dependência de domínio; reexportação do catálogo mantém API existente.

Fixtures antigas usavam IDs abreviados ou conta incompleta. Atualizadas somente
as respostas sintéticas para DTO real, incluindo as novas consultas do PR #36;
expectativas de comportamento, permissões e erros não foram relaxadas.

## Testador

npm ci reproduzido nesta sessão com package/lockfile inalterado; sete moderados
existentes. Lint, typecheck, 422 testes (23 novos + 399 da main atualizada), build
e diff --check passaram após rebase. Testes anteriores de sessão/401/races e todos
os fluxos de eventos/segurança executados novamente com fixtures compatíveis.

Casos novos: projeção sem campos extras, header CSRF customizado, corpo null/lista/
incompleto, IDs inválidos, tipos/limites de conta, status sem enum preservado sem
concessão, CSRF sem token/cabeçalho, header inválido/reservado e CRLF, limpeza de
Basic/CSRF, ausência de GET CSRF quando conta é inválida e UI que não autentica
com resposta incompatível em nenhum dos endpoints. Senha é limpa pelo formulário.

Respostas controladas conforme contrato e Headers real; não houve backend vivo,
contas reais, ensaio visual/AT ou banco de uso. O trabalho não homologa UI-RIO.

## Revisor

Papéis sequenciais no mesmo agente, sem revisão independente. Conferidos DTOs,
projeção e precedência da geração de sessão. Nenhum achado crítico/alto identificado.
Parecer favorável com validação visual/AT e ponta a ponta pendentes; revisão humana
do PR necessária. Entrega parcial da #1, sem concluir discovery/sessão técnica.

Resumos locais não rastreados preservados. Sem merge/deploy/infraestrutura e sem
alteração de credenciais ou concessões reais. Evidência final da CI registrar no PR.
