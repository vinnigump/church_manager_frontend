# FE-CAD-FICHA-UI — evidência local

Execução `845464e8-0982-425c-bc3a-7fbe3dbbed87`, 2026-11-09 UTC.
Issue canônica: https://github.com/vinnigump/church_manager_frontend/issues/33.
Módulo Pessoas, UI-RIO-06/CAD-01/02/03 e D01, onda 2, ordem 102.
Responsável: Implementador (Codex). Branch
`codex/wave-2-fe-cad-ficha-ui-845464e8`; base/HEAD conferido:
`c7dd3b674f473333e39d721b4efce4cfad2a0e54`.
Alterações sem commit; esse SHA identifica a base, não um SHA publicado com o diff.
PR: nenhum, conforme instrução da execução. Nenhuma alteração de fila.

## Fontes e escopo

Lidos AGENTS.md, README, development-reporting.md, rota App.tsx e componentes/testes
isolados existentes de inscrições. Issue #33 e comentários consultados no snapshot
local `church-review/wave-2-readiness-sources.json`; consulta web não disponível e
`gh` ausente. Briefing READY recebido do host delimita esta fatia, prevalecendo
sobre o bloqueio histórico da integração completa da issue.
Consultados WAVE-2-CONTRATOS-E-ACEITES.md e WAVE-2-D01-D10.md da orquestração,
e identity-v1.openapi.json do checkout backend
`0f640e19f2c1310d80056392c73baf39c9a6e41e` (CreatePerson/Person).

Implementados PersonForm, PersonRecord e PersonView com modelos de apresentação
e callbacks TypeScript. Nome obrigatório (limite 200 do contrato existente),
CPF com limite 20, sem validação/normalização local de documento.
O chamador fornece uma alternativa já aceita; nenhum catálogo ou tipo é criado.
Ficha exibe somente nome completo e nome de preferência, sem documentos.
Convite, conta, autorização e membresia não recebem controles nesta fatia.
Não há rota de produção, transporte HTTP, fixture em produção ou API simulada.
Estilos reutilizam access-panel e tokens existentes, com quebra de texto longo.

## Contrato de composição

- `onSubmit(draft)` retorna Promise de `confirmed` com a pessoa confirmada,
  `error` ou `conflict`. Resolver a Promise sem confirmação não abre ficha.
  O chamador só deve devolver `confirmed` após confirmação autoritativa.
- Enquanto aguarda, os campos e envio ficam bloqueados; trava síncrona impede
  submissões duplicadas. Só o resultado confirmado substitui o formulário.
- Erro, rejeição e conflito usam mensagens fixas, preservam a edição e bloqueiam
  reenvio. O chamador deve reconciliar o resultado antes de remontar o formulário;
  não há retry automático. Erros brutos não são exibidos.
- O chamador deve desmontar ao perder acesso e usar nova `key` ao trocar contexto.
  PersonView recebe loading/error/unavailable/ready e deixa de exibir a ficha
  anterior imediatamente quando sai de ready. Props não concedem autorização.
- A persistência, consulta contextual, catálogo e validação autoritativa dependem
  de BE-ID-ESCOPO e BE-ID-DOCUMENTOS. Não conectar antes da integração desses contratos.

## Critérios e testes do implementador

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CA1 | Nome obrigatório; CPF ausente apenas com alternativa aceita; sem catálogo inventado | PASSOU | PersonViews.test.tsx: nome em branco, documento ausente, alternativa aceita e rótulo vazio |
| CA2 | Carregamento, erro, conflito e ficha apenas após confirmação; convite/membresia separados | PASSOU | Promise pendente, envio duplicado, dados retornados, erro/conflito/rejeição sem ficha, estados de consulta e descarte por contexto |
| CA3 | Componentes isolados, fixtures só nos testes e reutilização acessível | PASSOU | nove testes de componente com labels/roles/estados disabled; App.tsx e cliente HTTP sem alteração; inspeção do diff |

Ambiente: Windows/PowerShell, Node v24.22.1. `node` e `npm` não estavam no PATH.
Foi acrescentado à sessão o diretório
`C:\Users\vinni\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin`.
Comandos npm abaixo executados efetivamente como
`node C:\Users\vinni\Documents\Codex\2026-11-07\clone-os-reposit-rios-vinnigump-church\work\package\bin\npm-cli.js <argumentos>`.

| Argumentos/comando | Resultado real |
| --- | --- |
| `ci --cache .npm-cache` | Interrompido após falhas ENOTFOUND no registro npm |
| `ci --offline --cache .npm-cache` | Exit 0; 246 pacotes instalados, após copiar cache local para a worktree; auditoria reportou 0 vulnerabilidades |
| `run lint` | Exit 0 |
| `run typecheck` | Exit 0 |
| `test` | Exit 0; 52 arquivos, 1.352 testes aprovados |
| `test -- src/people/PersonViews.test.tsx` | Exit 0; 1 arquivo, 9 testes aprovados |
| `run build` | Exit 0; TypeScript e Vite, 114 módulos transformados |
| `git diff --check` | Exit 0 |

Sem testes falhos ou ignorados reportados. Exclusão do cache recusada pela política
do ambiente; cache movido para `node_modules/.npm-install-cache` (ignorado pelo Git).
CI: NAO_EXECUTADO; nenhuma publicação autorizada. Validação visual não executada,
conforme instrução explícita. Testador e Revisor independentes: PENDENTE;
estas evidências pertencem somente ao Implementador.

## Handoff

Fatias locais implementadas e testes técnicos aprovados. Revisão: PENDENTE,
sem autoaprovação. Risco remanescente: integração deve respeitar escopo/autorização,
reconciliação e confirmação real; o componente isolado não comprova backend.
PODE_CONCLUIR: NAO para a issue completa, cujos contratos contextuais permanecem
dependências. Próxima ação: host revisar o diff, encaminhar Testador/Revisor e
publicar conforme sua política; CI deve validar o futuro SHA publicado.
Nenhum commit, push, PR, merge, deploy, aceite humano ou encerramento de issue.

## Retomada pelo host

Base atualizada por fast-forward para `149292a38770fb725b3f292304a1291fe0773b7c`. Issue #33 e seus comentarios recentes conferidos. Lint, TypeScript, build e 1.356 testes passaram na base atualizada.
