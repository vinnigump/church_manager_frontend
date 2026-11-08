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
Implementador -> Testador -> Revisor -> aprovação humana para aceite e integração.

### Continuidade e bloqueios

- Ao abrir um PR em rascunho, continuar outra demanda autorizada e independente, sem esperar aprovação para esse trabalho independente.
- Antes de cada nova atividade, reler este arquivo e conferir comentários, revisões, CI, conflitos e integração dos PRs anteriores. Retomar dependências quando seus pré-requisitos estiverem efetivamente integrados.
- Ao encontrar um bloqueio, registrar seu motivo e procurar imediatamente outra atividade disponível no backlog inteiro. Avaliar também correções comprovadas, acessibilidade, testes necessários e documentação autorizada que não dependam do bloqueio; não criar trabalho artificial nem ampliar regras funcionais pendentes.
- Um bloqueio de uma demanda não bloqueia toda a meta. Somente solicitar intervenção ou declarar a meta bloqueada quando não houver trabalho autorizado executável, após conferir as fontes atuais e registrar as dependências específicas. Não repetir apenas o status de um PR sem reavaliar alternativas.
- Manter uma atividade por branch/PR. Não usar código ou API de PR pendente como dependência implicitamente integrada. Esta autonomia não autoriza merge, deploy ou aceite humano em nome do usuário.
- Validação visual não é requisito dos PRs nem bloqueia desenvolvimento, conforme orientação posterior do usuário. Solicitar Run local somente quando houver necessidade concreta de teste com aplicação/backend em execução; não reiniciar aplicações locais por iniciativa própria.

## Prestação de contas e rastreabilidade (obrigatório)

Antes de iniciar, em cada handoff e antes de declarar conclusão, seguir `docs/governance/development-reporting.md`. Todo PR deve preencher `.github/pull_request_template.md` com issue canônica, critérios de aceite individualizados, evidências de testes/CI/SHA, riscos, bloqueios e próxima ação. Implementador, Testador e Revisor devem produzir suas próprias evidências; o Coordenador apenas consolida. Não classificar uma issue como CONCLUIDA pelo simples merge de um PR; exigir critérios comprovados e aceite humano conforme fluxo vigente. Não encerrar issues, realizar merge ou deploy automaticamente.
