# Codex — Church Manager Frontend

Fluxo semiautônomo com três papéis em `.github/agents/`: Implementador, Testador e Revisor. **As instruções não executam agentes automaticamente.**

## Stack e verificação
React 19, TypeScript 5.9, Vite 7, React Router 7, Vitest, Testing Library, ESLint; Node 24.
`npm ci && npm run lint && npm run typecheck && npm test && npm run build`.

## Regras
- Ler README, issues e contratos reais do backend antes de codificar. Não inventar endpoints, payloads, permissões ou autenticação.
- Backend é a autoridade de autorização. Frontend oculta ações sem permissão, mas não substitui controles do servidor.
- O login atual usa HTTP Basic em memória, GET /api/v1/accounts/me e GET /api/v1/csrf; respeitar cookies e CSRF nas escritas. Não presumir JWT/OTP nem guardar credenciais em storage.
- Não expor links restritos, documentos de menores, dados pessoais ou segredos em logs, localStorage ou URLs públicas.
- Reutilizar componentes, estilos, serviços e rotas existentes. Acessibilidade, estados de loading/erro/vazio e responsividade.
- Trabalhar por issue em branch própria; PR **draft**; sem merge, deploy ou alterações em main.
- Não avançar sem contrato backend validado; documentar bloqueios.

## Dependências de Eventos
Backend: `vinnigump/church_manager`, backlog EVT-001..EVT-032 e PRs #55/#56 (em rascunho, não presumir merge). Frontend: issues #4 (catálogo/calendário), #5 (inscrições), #6 (menores/presença). Backend EP-01 (#21..#24) prepara RBAC, auditoria e isolamento.

## Fluxo
Implementador -> Testador -> Revisor -> aprovação humana. Não iniciar o próximo incremento automaticamente.

## Prestação de contas e rastreabilidade (obrigatório)

Antes de iniciar, em cada handoff e antes de declarar conclusão, seguir `docs/governance/development-reporting.md`. Todo PR deve preencher `.github/pull_request_template.md` com issue canônica, critérios de aceite individualizados, evidências de testes/CI/SHA, riscos, bloqueios e próxima ação. Implementador, Testador e Revisor devem produzir suas próprias evidências; o Coordenador apenas consolida. Não classificar uma issue como CONCLUIDA pelo simples merge de um PR; exigir critérios comprovados e aceite humano conforme fluxo vigente. Não encerrar issues, realizar merge ou deploy automaticamente.
