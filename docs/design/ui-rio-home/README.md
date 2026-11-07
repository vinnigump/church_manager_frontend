# Home pública, autenticação e navegação

Complemento de #29/#30, solicitado expressamente pelo usuário em 07/11/2026: a tela de acesso deve ser a Home sem sessão, sem menu lateral; após login, menu e Home logada. Essa decisão posterior substitui a composição anterior que exibia navegação anônima e usava Minha conta como destino padrão. Não altera as regras de autenticação ou autorização.

Base final: main `02617b1`, com #50/#51 de apresentação de participação integradas sem conflitos. Checks finais locais: npm ci nesta sessão, lint, typecheck, **588 testes em 30 arquivos**, build e diff --check aprovados. Oito casos novos de Home; casos existentes atualizados para a mudança expressa de comportamento. Suíte inicial antes da atualização da base: 586 testes.

## Implementador

- `/` renderiza LoginPage quando não há conta. `/entrar` e `/entrar/` continuam como entradas compatíveis para guardas, marcadores e avisos existentes.
- AppLayout remove a navegação do DOM inteiro quando não autenticado (desktop e mobile). O shell público tem uma coluna, sem reservar espaço lateral/inferior para um menu inexistente. A marca e o skip link permanecem; acesso centralizado na largura útil completa.
- Com sessão, `/` apresenta uma Home simples com login real e atalhos a Eventos/Minha conta, reutilizando somente rotas já disponíveis. Navegação lateral/inferior retorna após autenticar. Sem KPIs, igrejas, perfis ou contagens inventados; #32 continua bloqueada.
- Login comum em `/` ou `/entrar` termina na Home `/`. Retorno interno válido de um link protegido é preservado; destinos inválidos/externos agora recaem na Home em vez de Minha conta. Query/fragmento não são incorporados. Guards e backend continuam autorizando cada recurso.
- Ambos os botões de saída levam à Home pública, sem preservar o destino antigo. Uma rota transitória local `/sair`, fora de Guard, limpa a autenticação em memória antes de voltar a `/`; isso evita a corrida da guarda da página anterior que recapturava `/conta`. Não é endpoint backend, logout remoto ou persistência. Efeito protegido por ref evita dupla execução em StrictMode. Avisos da alteração de senha e reautenticação por 401 mantêm o fluxo próprio existente.
- Título/foco também respondem à mudança entre sessão presente/ausente na mesma URL. Login na Home usa título “Entrar”, Home autenticada usa “Início”, sem login/identificadores no título.

Basic em memória, cookies/CSRF, cliente HTTP, invalidação de sessões e contratos existentes preservados. Nenhuma API ou dependência nova. Reconsultados AGENTS.md, papéis, README, código auth/rotas e comentários #29/#30. Contrato atual de autenticação reaproveitado; sem necessidade de backend adicional.

## Testador

Windows/Node 24.22.1, npm 12.2.2 externo temporário. npm ci executado nesta sessão; package/lockfile intactos; sete alertas moderados preexistentes de ferramentas.

Novos testes de Home cobrem `/`, aliases, ausência de menu e de consultas antes de entrar, login normal para Home, retorno da navegação, título/foco na mesma rota, ambos os botões de saída e expiração. Testes existentes de retorno foram atualizados somente na mudança intencional de fallback `/conta` → `/`; casos de deep link autorizado/negado e sanitização permanecem. Testes de 401 em catálogo/template aguardam a mensagem de expiração (a Home agora já apresenta o heading Entrar antes do login do helper). O teste de saída da conta monta a rota transitória para validar limpeza de sessão real.

Durante implementação os testes e o navegador reproduziram a corrida de logout entre navegação e Guard; a rota de transição corrigiu esse defeito. A ausência de menu decorre de sessão, não de uma concessão inferida nem apenas CSS.

### Navegador

Chrome headless/Playwright externo ao projeto. GETs de conta/CSRF interceptados com fixtures sintéticas; não houve escrita nem backend real. Sete larguras: 320, 360, 390, 768, 1024, 1440 e 1920 px.

- Home pública sem navegação e sem requests de API; centro horizontal do conjunto na página e vertical no main (tolerância 1 px), sem overflow.
- Login por Enter leva à Home e mostra a navegação, mantendo `/`.
- Saída do cabeçalho e da conta volta a `/`, sem menu. Novo acesso protegido continua voltando à página solicitada.
- Sem erros de página. [Resultados](browser-results.json); script opcional [browser-check.cjs](browser-check.cjs) requer Vite na porta 4190, Chrome e Playwright externo (opcionalmente `RIO_PLAYWRIGHT_PATH`).

Capturas abertas/inspecionadas: [Home pública desktop](public-home-1440.png), [Home logada desktop](authenticated-home-1440.png), [Home pública mobile](public-home-390.png). Também disponível [Home logada mobile](authenticated-home-390.png). Marca, formulário e menu não se sobrepõem. Contorno de foco do main é preservado.

Não ensaiados aparelho físico, Safari/iOS, teclado virtual ou leitor de tela. Testes com fixtures não comprovam integração de backend real.

## Revisor

Revisão sequencial no mesmo agente. Conferidos diff de rotas, fluxo público/autenticado, sanitização de retorno, saída, ausência de dados privados sem sessão e inexistência de mudanças no mecanismo de autorização. Parecer APROVADO COM RESSALVAS para PR draft, pendente de revisão/homologação humana. Não iniciar outro incremento ou realizar merge/deploy automaticamente. Resultados finais locais e CI serão registrados no PR do commit final.
