# FE-NAV-CONTEXTO-SEG — evidência local

Marcador: `2513578c-4bab-40d9-8148-3ec55acbccff` · NAV-02 · onda 2 · frontend.
Issue canônica: https://github.com/vinnigump/church_manager_frontend/issues/2.
Relacionadas: backend #64, frontend #33. Data: 2026-11-10 UTC.
Responsável: executor frontend, implementação e verificação técnica local.
Branch: `codex/wave-2-fe-nav-contexto-seg-2513578c`.
Base conferida: `release/homolog`, HEAD `1b41f3d50a23fe1e6e5a93397a90b1fad2db2db4`.
Estado: EM_REVISAO; revisão independente e aceite humano PENDENTES.
Alterações sem commit; o SHA identifica a base, não a implementação.
Sem commit, push, PR, alteração de fila, merge ou deploy, conforme solicitação.

## Fontes e contrato

AGENTS.md, README e governança lidos antes da implementação. Briefing READY
fornecido pelo host, NAV-02/P11/D10 e snapshots locais das issues #2/#33
consultados em `wave-2-readiness-sources.json`. A CLI `gh` não está instalada;
não houve consulta remota às issues nesta sessão.

Contrato backend `docs/api/self-authorization-contexts-v1.openapi.json` 1.0.0
e documento `docs/waves/backend-wave2/nav-d10-descoberta-v1.md` inspecionados no
checkout `72dbf1a80b3db8b27afdfe95eaaa49ad6c8cf6c4` mantido pelo host.
Registro local `integrations/church_manager-152.json` confirma MERGED no SHA
`40bbcbb747b1021f6a3840eff3c107f937536367`, com verify aprovado no head avaliado.
O contrato pontual existente continua sendo a autoridade para cada destino.

## Implementação

- Home autenticada consulta GET `/api/v1/accounts/me/authorization/contexts`,
  sem filtros, conta-alvo, persistência ou seleção obrigatória.
- Validação integral do snapshot: objeto exato, tipos CHURCH/DENOMINATION,
  UUID, rótulo não vazio e ausência de pares duplicados. Falha suspende opções;
  não transforma indisponibilidade em lista vazia nem aceita lista parcial.
- Recursos usam nomes reais do servidor. Links só aparecem após ResourceAccess
  confirmar a permissão própria. Igreja oferece catálogo, ocorrências e calendário;
  denominação oferece templates, perfis, atribuições e auditoria conforme permissão.
  A descoberta não infere permissões, parentesco, administração global ou grupos.
- ContextOperation integrado cancela e descarta resultados antigos na atualização,
  foco, troca/encerramento de sessão e desmontagem. Nova sessão da mesma conta
  invalida o snapshot anterior. Estados de carregamento, erro e vazio são acessíveis;
  a atualização explícita permanece disponível por botão.
- Rotas reais continuam verificando recurso/permissão antes de buscar dados.
  Teste integrado comprova revogação durante leitura do catálogo: limpa conteúdo,
  aborta leitura e ignora resposta tardia. Recursos ainda autorizados continuam
  oferecendo seus destinos após a nova descoberta, sem redirecionamento forçado.

## Critérios e evidências

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CA1 | Descoberta integrada e navegação sem seletor geral | PASSOU | AuthorizedResources.test.tsx: contrato GET, Home sem combobox, permissões independentes e lista vazia |
| CA2 | Revalidar, limpar/cancelar ao perder acesso e preservar demais recursos | PASSOU | testes de foco A/B, nova sessão, encerramento e revogação na rota com AbortSignal; ResourceAccess e ContextOperation existentes |
| CA3 | Vazio, falha, revogação, resposta tardia e acesso direto indevido | PASSOU | AuthorizedResources.test.tsx e regressões authorization.test.tsx/ContextOperation.test.tsx |

## Verificação técnica

Windows, Node v24.22.1, npm 11.19.1; dependências preparadas pelo host, sem npm ci.

- `npm test -- src/AuthorizedResources.test.tsx src/authorization.test.tsx src/components/ContextOperation.test.tsx src/HomePage.test.tsx`: 58 aprovados, 4 arquivos (antes dos dois cenários finais).
- `npm test -- src/AuthorizedResources.test.tsx`: 20 aprovados, incluindo os dois cenários finais.
- `npm run lint`: primeira execução após novos testes encontrou quatro parâmetros
  não usados nas fixtures; corrigidos com assinatura tipada de vi.fn. Reexecução aprovada.
- `npm run typecheck`: aprovado.
- `npm test`: primeira suíte completa aprovada, 1446 testes em 59 arquivos.
  Após os dois cenários adicionais, houve uma execução com 1447 aprovados e
  uma falha por timeout em teste existente de OccurrenceTransitionPage.test.tsx,
  linha 65 (link Cancelar ocorrência). Sem mudança nesse arquivo ou no produto,
  `npm test -- src/events/OccurrenceTransitionPage.test.tsx` passou com 54 testes.
  Reexecução final de `npm test`: **1448 aprovados em 59 arquivos**, zero falhos
  ou ignorados. Falha intermitente registrada, sem ajuste de timeout ou de regra.
- `npm run build`: aprovado, Vite 7.3.7, 116 módulos.
- `git diff --check`: aprovado.

CI: NAO_EXECUTADO; sem SHA publicado nesta execução. Nenhuma validação visual
executada ou solicitada. Backend não foi alterado; Maven não se aplica.

## Riscos e handoff

O snapshot representa o instante da consulta. Revalidação ocorre na entrada da
Home, atualização explícita, nova sessão e foco; rotas verificam permissão antes
do conteúdo, ao foco e em retry. Não há assinatura de revogação em tempo real.
AbortSignal cancela o trabalho local quando suportado; não desfaz efeitos já
confirmados no servidor. Cada operação continua sujeita à autorização backend.
Recursos sem destino frontend implementado continuam identificados pelo nome,
sem inventar rotas ou conceder operações.

Revisão: PENDENTE, sem parecer independente nesta sessão. Nenhuma decisão
funcional ou contrato pendente identificado para esta fatia. Próxima ação:
host revisar/publicar as alterações e executar CI no SHA publicado.
PODE_CONCLUIR: NAO quanto ao aceite formal; issue #2 não foi encerrada nem
classificada como concluída.

```yaml
atividade: FE-NAV-CONTEXTO-SEG
issue: https://github.com/vinnigump/church_manager_frontend/issues/2
status: EM_REVISAO
criterios_total: 3
criterios_comprovados: 3
testes_aprovados: 1448
testes_falhos: 0
testes_ignorados: 0
ci: NAO_EXECUTADO
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: []
proxima_acao: "Revisão independente e publicação pelo host; CI no SHA publicado"
pode_concluir: false
aceite_humano: PENDENTE
```
