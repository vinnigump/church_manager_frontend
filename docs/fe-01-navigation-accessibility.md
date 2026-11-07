# FE-01 — orientação de foco e título na navegação

## Implementador

Branch `fix/fe-01-navigation-accessibility`, baseada em `origin/main` 9a6b75e. Independente dos PRs #15 (ferramentas) e #16 (agenda). Issue #1, comentários, instruções, layout e testes existentes consultados.

Problema: a troca de página via React Router mantinha o foco no link da navegação e o título genérico do documento, sem orientar para o conteúdo novo. O layout agora foca o main programaticamente e atribui título estático por rota após mudar pathname. Mantém o link para pular navegação e tabindex=-1 no destino.

Títulos não incorporam login, query, IDs ou caminho desconhecido. Alterar estado de formulário sem navegar não aciona novamente o efeito. Não muda autenticação, permissões, APIs ou visibilidade de dados; Evento continua indisponível para integração real.

## Testador

Lockfile da base principal instalado com `npm ci` na atividade independente anterior e preservado nesta branch; não depende da atualização de ferramentas do PR #15.

- `npm run lint`, `npm run typecheck`, `npm run build`: passaram.
- `npm test`: 109 testes passaram, quatro novos + 105 regressões, sob Vitest 3.2.7 da base.
- Casos: troca conta→eventos, redirecionamento ao login, página inexistente→início, título sem dados privados e foco preservado enquanto se edita formulário.

Testes jsdom verificam document.title/activeElement e estrutura do destino de foco; não substituem ensaio manual com leitor de tela, teclado real ou navegador. Nenhum contrato backend é consumido por esta correção.

## Revisor

Papéis executados sequencialmente. Diff pequeno, efeito restrito a pathname, sem listeners persistentes ou dependências novas. Foco fora da ordem de Tab continua acessível programaticamente, sem adicionar parada extra. Textos de título controlados pela aplicação; sem dados pessoais em título/URL/log.

Parecer: **APROVADO para a correção com ressalva de ensaio manual de tecnologia assistiva pendente**. Sem achado crítico/alto introduzido. Alertas preexistentes de ferramentas da base são tratados no PR #15; não integram esta correção.

Sem merge/deploy. Conferir revisões e merges dos PRs anteriores ao finalizar esta atividade.
