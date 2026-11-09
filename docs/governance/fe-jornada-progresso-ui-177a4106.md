# FE-JORNADA-PROGRESSO-UI — evidência local

- Execução: `177a4106-ea09-47dd-834e-b26c4fb06ed3`, onda 2, 2026-11-09 UTC.
- Issue: https://github.com/vinnigump/church_manager_frontend/issues/2.
- Módulo: Minha Jornada, atividade pai FE-ID-ACESSO-JORNADA, D04/D05, ordem 105.
- Responsável: Implementador, Codex. Estado da fatia: EM_REVISAO.
- Branch: `codex/wave-2-fe-jornada-progresso-ui-177a4106`.
- Base `release/homolog`; HEAD conferido: `8bf5bbb35c7647e85b4f01591e56ef0620f1f563`, igual ao briefing.
- Alterações sem commit: esse SHA identifica a base, não contém a implementação.
- PR: nenhum; CI: NAO_EXECUTADO, por instrução da sessão. Fila inalterada.

## Fontes e escopo

Lidos AGENTS.md, README, development-reporting.md, App.tsx, componentes e testes
de pessoa, trilhas, inscrição e dependentes, estilos compartilhados e
docs/planning/wave1-identity-journey.md. Consultados EXECUTORES.md e
WAVE-2-D01-D10.md em `C:/Users/vinni/.codex/church-review/orchestration/` e a
issue #2 com comentários em `C:/Users/vinni/.codex/church-review/wave-2-readiness-sources.json`.
`gh issue view 2 --repo vinnigump/church_manager_frontend --json title,body,comments`
falhou: gh ausente do PATH. Issue não revalidada online; briefing READY recebido
e decisões locais delimitam a entrega isolada autorizada. Sem claim/next/finish.

JourneyProgress recebe estado discriminado e projeção tipada de contexto,
trilha, versão, situação, progresso textual e tarefas. O progresso vem do
chamador: não é calculado a partir da lista. Ausência de progresso não vira zero.
Contextos de ator, sujeito, igreja e execução divergentes ocultam a projeção.
Não há snapshot em estado local: mudanças de estado removem os dados anteriores.
Reutiliza estilos de painéis/listas e regiões, títulos, status e alertas acessíveis.
Sem ações operacionais, login, rota, API, storage ou fixtures em produção.

## Critérios e evidências

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| A1 | Somente projeção autorizada por props; loading, erro, vazio, negação e limpeza | PASSOU | 11 testes em src/journey/JourneyProgress.test.tsx; transições a partir de ready, quatro divergências de contexto, substituição de projeção, campos extras privados omitidos |
| A2 | Sem calcular elegibilidade, membresia ou presença; preservar sessão/conta #95/#96 | PASSOU | Testes de progresso fornecido independente da lista e progresso ausente; diff sem alterações de sessão/conta/rotas; suíte completa aprovada |
| A3 | Fixtures apenas em testes, sem rota ou API simulada, reutilizar acessibilidade/estilos | PASSOU | rg -n JourneyProgress src encontra somente definição e testes; testes por região/lista nomeadas, status, alert e aria-busy; imports de estilos existentes |

## Comandos e resultados reais

Windows/PowerShell, Node v24.22.1, npm 11.19.1; dependências previamente instaladas,
sem npm ci ou alteração de cache.

| Comando | Resultado |
| --- | --- |
| npm test -- src/journey/JourneyProgress.test.tsx | Exit 0; 11 testes, 1 arquivo, 1,90 s |
| npm run lint | Exit 0 |
| npm run typecheck | Exit 0 |
| npm test | Exit 0; 1399 testes, 56 arquivos, 40,45 s; zero falhos/ignorados |
| npm run build | Exit 0; TypeScript e Vite; 114 módulos; Vite 4,93 s |
| git diff --check | Exit 0 |
| git diff --no-index --check -- NUL src/journey/JourneyProgress.tsx (e teste) | Exit 1 por arquivos novos/diferença; nenhum erro de whitespace; avisos LF/CRLF |

Sem validação/evidência visual ou aplicação/backend iniciado.

## Handoff e limites

Revisão independente: PENDENTE; Testador/Revisor não executados como agentes
independentes e nenhum parecer independente atribuído. Sem decisão funcional
adicional necessária nesta fatia. Backend e integrador futuros devem fornecer
projeções autorizadas e invalidar estado em mudança de acesso/contexto; o
componente não detecta revogação remota por conta própria. APIs reais de acesso
e trilhas continuam dependências do pai FE-ID-ACESSO-JORNADA/#2.

Próxima ação: host revisar alterações, publicar SHA e executar CI conforme fluxo.
PODE_CONCLUIR issue #2: NAO; revisão, integração e aceite permanecem pendentes.
Não houve commit, push, PR, mudança de fila, merge ou deploy.
