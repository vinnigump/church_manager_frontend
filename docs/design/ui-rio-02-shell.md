# UI-RIO-02 — shell e navegação responsiva

Origem: issue #29, design desktop/mobile aprovado e identidade #28/#40 integrada.
Execução sob a ordem atual do usuário de desenvolver o backlog com requisitos
aprovados. Não se considera aprovação de design como homologação de dispositivo.
Referências: docs/design/rio-v1/rio-prototipo.html e rio-mobile.html; este último
posiciona aside após o conteúdo com order:2, no fluxo, sem barra fixa.

AppLayout extraído de App.tsx, mantendo um único nav Principal e os mesmos guardas,
retorno do login, fluxo de saída, foco no main e títulos por rota. NavLink marca
destino ativo com aria-current; Início usa correspondência exata, conta/eventos
mantêm contexto em rotas filhas. Estado ativo usa sublinhado além da cor.

Destinos reais: Início, Minha conta, Eventos autenticado e Entrar para visitante.
Sair permanece ação explícita no cabeçalho. Não foram incluídos Membros, painel de
indicadores, seletor de igreja, dados ou perfis demonstrativos. Links administrativos
continuam contextuais e condicionados às permissões já existentes. Layout não
infere autorização a partir do login nem modifica Basic/cookies/CSRF/storage.

CSS do shell isolado: lateral desktop e navegação inferior em tela estreita, com
ícones SVG decorativos e rótulos visíveis. Um único conjunto de links evita duas
árvores focáveis e dessincronização entre viewport/sessão. Grid usa minmax(0,1fr),
conteúdo com min-width:0 e quebra de texto; logo mantém proporção e tokens RIO.
Navegação inferior no fluxo conforme referência; sem elemento fixo sobre formulário.
Safe-area usa env, alvos têm pelo menos 44 px por construção CSS. Isso não equivale
a medição real em navegador nem prova comportamento do teclado virtual.

Estilos antigos de header/nav/layout removidos do global; estilos de conteúdo
reutilizados. Formulários e campos mobile preservam tamanho mínimo de 16 px já
integrado. Sem nova dependência, API, persistência, estrutura de dados ou tema escuro.

Papéis Implementador/Testador/Revisor sequenciais pelo mesmo agente. Testes de
comportamento: navegação única/destinos reais, aria-current em rotas/filhas, histórico,
foco/título, visitante, skip link e negação administrativa. Regressões existentes
incluem login, retorno, expiração/saída, permissões e concorrência dos módulos.
Lint/typecheck/547 testes (7 novos sobre base540)/build/diff --check passaram.
Após integração externa de #46, rebase em ca29aff preservou rotas e links de
auditoria; lint/typecheck/565 testes/build/diff --check passaram na base combinada.
npm ci nesta sessão, lockfile intacto. Não foram criados testes que espelham CSS.

Homologação pendente: Browser Use recusou a origem local 127.0.0.1:5317 nesta sessão.
Não foi contornada a recusa por browser alternativo, script ou outro transporte.
Matriz 320/360/390/768/1024/1440, zoom 200%, desktop/mobile, safe-area, teclado real,
orientação e leitor de tela não executada neste incremento. Capturas de #40 são
históricas da identidade anterior e não comprovam este shell. PR permanece entrega
para revisão, sem declarar DoD visual concluído. Sem merge/deploy/infraestrutura.
