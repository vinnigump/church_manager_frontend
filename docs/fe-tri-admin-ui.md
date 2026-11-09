# FE-TRI-ADMIN-UI — evidência da worktree

Execução: `75e0becf-3d28-421e-9a39-f66ee4aea114`.
Issue canônica: https://github.com/vinnigump/church_manager_frontend/issues/3.
Módulo: Trilhas; onda 2; ordem 104; responsável: Implementador frontend.
Branch: `codex/wave-2-fe-tri-admin-ui-75e0becf`.
Base indicada no briefing: `release/homolog`; HEAD conferido contra o SHA recebido:
`f8cc5ec462a99390fef8278ca2b5c503c0142482`.
Data da verificação: 2026-11-09 UTC.
PR: nenhum, conforme instrução da execução. Alterações sem commit.

## Fontes e limites

Lidos AGENTS.md, README, governança, template de PR, rota App.tsx e componentes/testes
de apresentação existentes. Issue #3 e comentários consultados no snapshot local
`church-review/wave-2-readiness-sources.json`; consulta web falhou e `gh` não está
instalado no PATH. A orientação `orchestration/WAVE-2-PARALELISMO.md` r11 autoriza
esta fatia desacoplada; D08/TRI-02/03/P09 foram conferidos nas consolidações
`WAVE-2-D01-D10.md`, `WAVE-2-CONTRATOS-E-ACEITES.md` e fontes de prontidão.
O planejamento integrado `docs/planning/wave1-identity-journey.md` explicita
dependências. Backend local inspecionado no snapshot `40edeaa21e70a1a2a9272e6dd48f1beee5a46b91`:
`trails/package-info.java`, `trails/persistence/TrailVersion.java` e inventário
de arquivos; persistência não constitui contrato HTTP para integração.

## Implementação

`src/trails/TrailAdminViews.tsx`: versões, histórico e resultados de migração
por participante. Modelos locais de apresentação, sem DTO, endpoint, rota,
equivalência, transição ou cálculo de permissão. Estados textuais de versão e
migração vêm do chamador. Dispensa e conclusão manual podem ser descritas no
histórico sem serem fundidas pelo componente. Não há concessão de membresia.

Capacidades explícitas controlam callbacks por item e comando geral. Ausência,
negação, carregamento ou erro não oferecem comandos. Comando pendente fica
desabilitado. Callbacks não alteram resultados otimisticamente; seleção,
confirmação, justificativa, transporte e tratamento de operação pertencem à futura
integração. Nenhuma ação é inferida de versão, resultado ou perfil.

Coleções são controladas: o chamador fornece os registros preservados em loading
e erro; negação oculta todos os registros e comandos. Falha individual não remove
sucessos. A UI não mantém cache nem recupera progresso remotamente. O chamador
deve fornecer somente a projeção autorizada do contexto atual, rótulos seguros
para exibição e callbacks que respeitem a autorização do servidor.

Reutiliza listas, painéis, resumos e estilos globais existentes, regiões nomeadas,
status/alerta, aria-busy e botões nativos. Fixtures somente nos testes. Sem
alterações em App.tsx, previews, serviços, autenticação ou armazenamento.

## Critérios e evidências

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CA-01 | Versões, histórico, resultados, vazio/loading/erro e capacidades explícitas | PASSOU | `src/trails/TrailAdminViews.test.tsx`, 15 testes aprovados |
| CA-02 | Negação e preservação de sucessos diante de falha parcial | PASSOU | Testes de capacidade revogada, consulta negada, callback seletivo e atualização falha |
| CA-03 | Isolamento de produção, fixtures em testes, reutilização e acessibilidade | PASSOU | Teste sem rede/storage/links, regiões nomeadas; inspeção dos três arquivos novos e ausência de import nas rotas/previews |

## Verificação técnica

Ambiente: Windows/PowerShell, Node 24.22.1 e npm 11.19.1. Runtime adicionado
ao PATH apenas dos processos de verificação:

```powershell
$env:PATH = 'C:/Users/vinni/AppData/Local/JetBrains/IntelliJIdea2026.3/acp-agents/.runtimes/node/24.22.1;' + $env:PATH
```

| Comando executado | Resultado real |
| --- | --- |
| `node --version`, `npm.cmd --version` | v24.22.1 / 11.19.1 |
| `npm.cmd ci` | Interrompido sem resultado após espera; não contabilizado como sucesso |
| `npm.cmd ci --offline --cache C:/Users/vinni/AppData/Local/npm-cache --no-audit --no-fund --loglevel error` | Exit 0; 246 pacotes instalados em 52 s, cache local |
| `npm.cmd run lint` | Exit 0; repetido após os dois testes adicionais |
| `npm.cmd run typecheck` | Exit 0; repetido após os dois testes adicionais |
| `npm.cmd test -- src/trails/TrailAdminViews.test.tsx` | Exit 0; 15 aprovados, 0 falhos/ignorados; 1 arquivo |
| `npm.cmd test` (duas execuções) | Exit 0 em ambas; 1388 aprovados em 55 arquivos, 0 falhos/ignorados; última execução após os dois testes adicionais |
| `npm.cmd run build` | Exit 0; tsc e Vite 7.3.7; 114 módulos transformados |
| `git diff --check` | Exit 0 |

As tentativas iniciais de `node`/`npm` no PATH padrão falharam (comando ausente);
o runtime Codex contém Node, mas não npm na localização tentada. Resolvido com
o runtime JetBrains acima. Não houve alteração de dependências/lockfile.
CI não executado: sem publicação de SHA nesta sessão. O SHA informado é a base,
não um commit contendo as alterações. Nenhuma validação visual executada.

## Handoff

Parecer independente: PENDENTE; não há autoaprovação do Implementador.
Integração depende de BE-TRI-VERSOES, BE-TRI-NOVOS e BE-TRI-DISPENSA (APIs,
permissões, equivalências e estados integrados). Próxima ação: host revisar o diff,
publicar conforme política e encaminhar Testador/Revisor e CI no SHA publicado.
PODE_CONCLUIR issue #3: NÃO; esta fatia não implementa a atividade pai nem
substitui homologação humana. Não houve commit, push, PR ou alteração da fila.

```yaml
atividade: FE-TRI-ADMIN-UI
execucao: 75e0becf-3d28-421e-9a39-f66ee4aea114
issue: https://github.com/vinnigump/church_manager_frontend/issues/3
status: EM_TESTES
criterios_total: 3
criterios_comprovados: 3
testes_aprovados: 1388
testes_falhos: 0
testes_ignorados: 0
ci: NAO_EXECUTADO
ci_url: null
sha_base: f8cc5ec462a99390fef8278ca2b5c503c0142482
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: []
dependencias_integracao: [BE-TRI-VERSOES, BE-TRI-NOVOS, BE-TRI-DISPENSA]
proxima_acao: Host encaminhar alterações para Testador/Revisor e CI no SHA publicado
pode_concluir: false
aceite_humano: PENDENTE
```
