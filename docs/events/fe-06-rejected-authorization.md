# FE-06 — aviso de autorização rejeitada

## Implementador

Branch `fix/fe-06-rejected-authorization`, base `origin/main` 7cd4c81 após merge humano do PR #15. Independente dos PRs #16/#17. A issue #6 reconciliada passou a explicitar NOT_REQUIRED/PENDING/APPROVED/REJECTED/REVOKED. Corpo da issue e comentários consultados; sem comentários adicionais.

O componente isolado ainda não possuía apresentação de rejeição. Adiciona `rejected` ao modelo interno e uma mensagem de bloqueio, sem modificar a situação de inscrição fornecida. Não inventa uma regra de cancelamento, liberação de vaga ou retenção documental após rejeição. Essas decisões continuam sendo do backend e de seus contratos.

Modelo continua sendo de apresentação, não DTO nem permissão. `recorded` informa registro sem inferir que uma aprovação anterior libera a operação atual. Nenhuma API é conectada: sem upload, câmera, assinatura, QR, ação de check-in, dados nominais ou links privados.

## Testador

- `npm ci`: passou com Vitest 5 da principal; sete moderados remanescentes de desenvolvimento, sem críticos sinalizados.
- `npm run lint`, `npm run typecheck`, `npm run build`: passaram.
- `npm test`: 110 testes passaram, cinco novos + 105 regressões.
- Novos casos: rejeição com inscrição confirmada, em espera, cancelada ou desconhecida preserva o estado informado; rejeição de outro sujeito não é mostrada. Sem botões/links de operação.

Fixtures somente de componente; nenhum backend vivo ou coleta de dados reais. Layout/acessibilidade manual não executados. Não se alega integração funcional da #6.

## Revisor

Papéis executados sequencialmente. Mudança mínima, compatível com estados anteriores e com a reconciliação funcional. Não promove rejeição a acesso nem altera inscrição localmente; mantém comparação de contexto igreja/ocorrência/sujeito. Mensagem usa alert e não reflete motivo privado fornecido por usuário ou servidor.

Parecer **APROVADO para a correção isolada**, sem achado crítico/alto introduzido. Aceite funcional continua bloqueado por APIs EP-06/07; não utilizar a apresentação como autorização de backend. Pendências backend #14/#15/#25/#32/#37/#48 foram reconsultadas e continuam abertas; nenhuma API presumida a partir de issue planejada.

Sem merge/deploy. Conferir PRs anteriores ao final da atividade. PR #15 já integrado por ação humana; #16/#17 seguem independentes.
