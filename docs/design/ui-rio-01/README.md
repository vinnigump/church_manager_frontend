# UI-RIO-01 — Identidade RIO e estilos comuns

Refs #28. Base inspecionada: `2778d57` (main após #37). Autorização de execução: resposta “sim” do usuário em 07/11/2026 à pergunta explícita de iniciar #28.

## Implementador

- `src/components/Brand.tsx`: imagem original RIO e nome do produto no link de início. Dimensões intrínsecas e `height: auto` preservam proporção; alt `RIO` compõe o nome acessível do link.
- `src/assets/rio-logo.png`: cópia sem transformação do `src/main/resources/static/assets/logo.png` do anexo `dia-de-servico-rio-main.zip`. PNG 1108×505, 24.796 bytes. SHA-256 `c44a519471819da30ff4bc0bebe63a9b6007aaacc5dcf7f708bc7febdfd17789`.
- `src/styles/tokens.css`: fonte Segoe UI/system-ui, superfícies claras, verde escuro de ação, bordas, erro/foco, espaçamento, raios de controles 8 px e cartões 17 px. O verde claro da marca permanece no ativo original; texto de ação usa verde escuro com contraste.
- Classes `app-header`, `app-navigation`, `app-content` e `access-panel` delimitam estilos. O limite genérico de largura de `section` foi substituído pelo painel de acesso; header/nav/main internos não herdam o layout do shell.
- Eventos e Segurança reutilizam tokens nas superfícies, bordas e cartões existentes, mantendo grids, rotas, paginação e controles reais.
- Navegação continua no formato atual. Menu lateral/mobile pertence à #29; composição completa de acesso à #30; redesenho de Eventos à #31. A classe do painel de acesso aplica apenas a superfície comum desta fundação.

Referência aprovada: [registro consolidado](https://github.com/vinnigump/church_manager_frontend/blob/8ddfd6b080914530a6bc226f56007d721cfdd01f/docs/design/rio-v1/aprovacoes.md). Não foram transportados KPIs, igreja, pessoas, funcionalidades ou menus fictícios do protótipo.

Contratos reconsultados: README, cliente/auth atuais e OpenAPI identidade 0.3.0 do backend local. A mudança não altera payloads/endpoints, Basic em memória, cookies/CSRF, autorização, persistência ou dependências. Não foi necessário backend novo. Worktree isolado preservou o checkout anterior e seus documentos não rastreados.

## Testador

Ambiente: Windows, Node 24.22.1. npm 12.2.2 obtido em pasta temporária porque não havia npm no PATH. Lockfile preservado; CI usa seu próprio npm com Node 24.

| Comando | Resultado |
|---|---|
| `npm ci` | 246 pacotes instalados; sete alertas moderados já presentes; lockfile intacto |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm test` | 19 arquivos, 422 testes aprovados |
| `npm run build` | Aprovado; logo emitido em `dist/assets/rio-logo-*.png` |
| `git diff --check` | Aprovado |

Os testes existentes verificam navegação, título/foco, login/retorno, sessão, guardas, catálogos, conflitos e telas de segurança. Não foi criada suíte que apenas espelha valores CSS.

### Navegador

Chrome headless 156.0.8078.80 via Playwright externo ao projeto: 18 combinações (Login, catálogo da igreja e perfis de Segurança × 320/360/390/768/1024/1440 px). Verificados logo carregado e proporção, cartões de 17 px, campos de pelo menos 16 px em mobile, ausência de overflow horizontal e ausência de restrição global de section nos painéis de domínio. Textos longos sintéticos incluídos. Nenhum pageerror.

Foco/skip link percorridos pelo teclado; foco no main ao navegar preservado. Zoom CSS de 200% ensaiado sem overflow na tela de acesso desktop. Não equivale a ensaio de zoom nativo em todos os navegadores.

Contraste calculado pela luminância relativa: ação branco/verde `#155c50` 7,84:1; texto/fundo 11,05:1; secundário/branco 4,92:1; borda de campo/branco 4,47:1; foco/branco 5,26:1. Marca gráfica preserva a cor original. Controles desabilitados permanecem distinguíveis e usam a exceção de contraste de controles inativos.

As APIs GET foram interceptadas com fixtures sintéticas de contratos existentes; nenhuma escrita ou contato com backend/produção. Não alegar integração real. Resultado detalhado: [browser-results.json](browser-results.json).

Ensaio reproduzível opcional: ter Playwright disponível externamente, Chrome instalado e Vite na porta 4188; executar `node docs/design/ui-rio-01/browser-check.cjs`. Se Playwright não estiver na resolução do projeto, configurar `RIO_PLAYWRIGHT_PATH` para o módulo instalado. Script não adiciona dependência ao aplicativo. A saída sobrescreve apenas as evidências desta pasta.

### Evidências inspecionadas

Capturas de acesso mobile e catálogo desktop foram abertas e inspecionadas. O contorno de foco do main permanece visível após navegação (comportamento de acessibilidade existente).

| Tela | Desktop | Mobile |
|---|---|---|
| Acesso | [1440 px](login-1440.png) | [390 px](login-390.png) |
| Catálogo | [1440 px](catalog-1440.png) | [390 px](catalog-390.png) |
| Segurança | [1440 px](security-1440.png) | [390 px](security-390.png) |

Não houve ensaio em Safari/iOS, aparelho físico, teclado virtual ou leitor de tela. Estados de erro/busy/negação e concorrência são cobertos pelos testes de componentes existentes; a matriz de capturas cobre conteúdo e login inicial. Essas limitações permanecem para homologação humana/#34.

## Revisor

Revisão sequencial pelo mesmo agente, sem alegação de revisão humana ou independente. Conferidos diff, referências, origem do ativo, ausência de mudança funcional, seletores, empacotamento, lockfile e resultados. Sem achado crítico/alto identificado no incremento. Parecer: **APROVADO COM RESSALVAS** para PR draft, pelas limitações de homologação descritas. Revisão humana continua necessária.

CI remota será verificada no commit do PR; não confundir os resultados locais com CI. Sem merge/deploy. Não iniciar #29 automaticamente.
