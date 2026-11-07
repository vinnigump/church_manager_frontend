# FE-04 — espaço e sobreposições de planejamento

Refs frontend #4 e backend #27/#97. Contrato real `event-spaces-v1.openapi.json`
1.0.0 e `EventSpaceController`, `EventSpaceModels`, `EventSpaceService`,
`ScheduleConflictPolicy` em backend `c195ae8`, preservados em `6b05075`.

## Implementador

Atividade iniciada como consulta independente na base `c6f11cf`, enquanto #55
aguardava revisão. Após merge externo de #55 em `9343987`, branch rebaseada
nessa base e completada com configuração de espaço usando o cliente de ocorrência
efetivamente integrado. Conflito mecânico de imports/rotas em App resolvido
preservando ambas as funcionalidades. Não depende do PR visual #54.

O detalhe da ocorrência abre `/planejamento`, com GET de espaço e avaliação
paginada de sobreposições, ambos sob EVENT_VIEW/CHURCH. Dados de outras
ocorrências se limitam a ID, intervalos, estado persistido, avaliação e duração
ISO 8601 exata; projeção descarta nomes, links e dados pessoais extras.
Resumo global vem do servidor, não é recalculado pela página atual. Inclui
PREVENTIVE sem tratá-lo como reserva/bloqueio/exceção. Espaços indefinidos,
UNDETERMINED e página vazia não comprovam ausência de conflitos. NONE também
não comprova disponibilidade. Limite exibido é o informado pelo servidor.
Os dois GETs são consultas independentes, sem garantia inventada de snapshot
conjunto; UI informa possibilidade de mudança concorrente entre eles.

`/planejamento/espaco` exige EVENT_VIEW e EVENT_EDIT próprios antes de ler o
rascunho/espaço. Acesso pelo detalhe somente em DRAFT sem primeira publicação.
Campos de código exato e nome opcional; não cria cadastro de locais. MAIN/main
são distintos, código não é normalizado. Nome perde espaços nas extremidades,
conforme aviso. Ambos vazios enviam null/null e retornam A definir.
PUT usa CSRF compartilhado e X-Expected-Revision numérico da ocorrência. No-op
conserva revisão; mudança incrementa uma vez. Resposta precisa confirmar
contexto/ID/código/nome/revisão; conflicts ausente/null é aceito sem divulgar
candidatos ou inferir autorização. Não publica, reserva ou concede override.

As duas leituras iniciais do editor precisam ter a mesma revisão. Campos,
snapshot e trava ficam acima das guardas; foco não limpa campos nem libera
envio duplo. Revisão concorrente bloqueia salvar até recarga explícita com
descarte de alterações e reautorização. Erro ou escrita incerta bloqueia
repetição até conferir novamente. Contexto desmontado aborta leituras/comando.

Entrada Eventos/README deixam de dizer que ocorrências administrativas estão
indisponíveis após #55. Agenda pública continua pendente. Teste da Home espera
o efeito assíncrono de título/foco, em vez de ler antes de sua execução;
nenhuma lógica de login/Home foi alterada.

## Testador e revisor

Papéis sequenciais pelo mesmo agente, sem revisão independente/humana simulada.
`npm ci` executado nesta sessão; dependências/lockfile inalterados entre as
atividades. Lint, typecheck, testes, build e diff --check executados na branch.
74 testes novos de contrato/fluxo, além dos 650 integrados após #55.

Cobertura: projeção/isolamento, schema e duração exata, paginação/global,
indefinidos/legado, permissões antes de GET/PUT, erro parcial/retry, contexto
atrasado/foco, CSRF/revisão/no-op, código sensível a caixa, limpeza null/null,
rascunho/primeira publicação, snapshot divergente, envio duplo/foco pendente,
erros 409/422/500 e reconciliação de campos sujos.

Revisão estática sem achados críticos/altos: sem contrato inventado, dados
pessoais/links privados, storage de credenciais ou decisão local de autorização.
Sem alteração de infraestrutura/backend, merge ou deploy.

**Ressalvas:** testes usam fixtures e jsdom; backend vivo e aceite visual,
teclado/AT não executados. Browser Use continua bloqueado por permissão
salva/política apesar da tentativa autorizada, sem contorno ou capturas.
Não afirmar homologação visual, disponibilidade de espaço ou implementação
do motor operacional de publicação/exceção. Sete vulnerabilidades moderadas
preexistentes de tooling permanecem, sem atualização forçada.

## Atualização de integração — 2026-11-07 UTC

Issue #4, FE-04, branch `codex/fe-04-planning-overlaps`, PR #56.
A base main `86f0821` integrou externamente os estilos do PR #54 e a
governança do #57. A atualização desta branch preserva esses commits.
O único conflito foi no README: mantidos o relato visual e a informação
atual de ocorrências administrativas disponíveis. Sem alteração funcional
adicional, contratos novos ou integração de PRs ainda pendentes.

| ID | Critério desta atualização | Resultado | Evidência |
| --- | --- | --- | --- |
| INT-01 | Preservar estilos integrados e descrição de planejamento | PASSOU | diff contra origin/main, README e event-admin.css |
| INT-02 | Regressão após atualização da base | PASSOU | npm ci, lint, typecheck, 724 testes/35 arquivos, build, diff --check |
| INT-03 | Visual, backend vivo e aceite humano | NAO_TESTADO | solicitar ativação da aplicação ao usuário quando necessário |

Node24/Windows; sem testes ignorados, alterações de timeout ou lockfile.
Revisão estática sequencial sem achados críticos/altos nesta resolução;
revisão independente PENDENTE. A ressalva anterior de origem bloqueada é
histórica: localhost:5173 foi acessível em ensaio posterior do PR #59,
sem comprovar homologação desta branch. Seguir orientação atual do usuário
e solicitar ativação para a validação visual necessária.

```yaml
atividade: FE-04-SPACE-PLANNING-INTEGRATION
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 3
criterios_comprovados: 2
testes_aprovados: 724
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: [56]
bloqueios: [homologacao_visual, backend_vivo, revisao_independente, aceite_humano]
proxima_acao: Conferir CI do novo head e revisao; solicitar ativacao para homologacao
pode_concluir: false
aceite_humano: PENDENTE
```
