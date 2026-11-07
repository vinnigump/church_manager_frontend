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


## Continuidade automática após merge (quando o workflow estiver habilitado)

Após a aprovação humana e o **merge efetivo** de um PR, o GitHub Actions `.github/workflows/codex-continuous.yml` pode selecionar a próxima issue desbloqueada e iniciar outra execução Codex, **sem solicitar nova autorização para começar a tarefa**. A autorização humana continua obrigatória **para cada merge**; não fazer merge, deploy ou push direto na branch principal. Se a issue estiver bloqueada, testes falharem, faltarem credenciais ou houver PR pendente, parar e reportar. Não contornar dependências. Consulte `docs/events/codex-continuous.md`.
