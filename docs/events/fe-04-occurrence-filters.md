# FE-04 — filtros administrativos de ocorrências

Issue canônica #4, Eventos / FE-04, prioridade não definida. Branch
codex/fe-04-occurrence-filters, base frontend b7525b6. Data 2026-11-08 UTC.
Papéis implementador/testador/revisor executados sequencialmente pelo mesmo
agente; revisão independente e aceite humano PENDENTES.

## Implementador

Contrato real event-occurrences-v1 1.1.0, EventOccurrenceController e
EventOccurrenceService integrados no backend86db43b78afb944841bd4ab6d73f21c3f11efad0
(PR104 integrado32f2cce). Não usa código de PR backend ainda aberto.
GET administrativo existente aceita from/to/modality/status opcionais, AND.
Período por interseção positiva [from,to): endsAt>from e startsAt<to.
Limites isolados aceitos; ambos exigem to>from; precisão máxima microssegundos.
Modalidade exclui legado sem configuração; estados comparados literalmente.

Lista existente recebe formulário com aplicação explícita/limpeza. Datas em UTC
sem offset no formulário; cliente aceita instantes com offset no contrato.
Campo textual preserva microssegundos, evitando descarte do campo HTML nativo.
Resumo distingue filtros aplicados dos campos ainda não enviados. Página volta
a zero ao aplicar/limpar, conserva filtros ao paginar. Total vem do servidor;
sem contar página como total, recalcular ou filtrar localmente resultados.
Resposta incompatível com filtros/contexto é recusada integralmente, sem mostrar
resultado parcial ou converter erro em zero. Campos/aplicação/página ficam acima
de ResourceAccess para sobreviver ao foco; guardas ocultam tudo durante verificação
ou negação. Troca de conta/igreja remonta workspace. Filtros duram enquanto a lista
está montada, sem storage ou transporte automático para outros contextos.

Mantém EVENT_VIEW antes do GET; não adiciona permissões, escritas, concessões,
agenda pública, visibilidade ou seleção de igreja por UUID digitado. Chamada
anterior listOccurrences mantém assinatura e comportamento sem filtros.
OPEN/CLOSED continuam estados legados, não participação OPEN_EVENT.

## Testador

Node24/Windows. npm ci, lint, typecheck, npm test, build e diff --check passaram.
**885 testes em39 arquivos,35 novos**, zero ignorados; sem dependências/lockfile
ou timeout alterados. Primeiro ensaio35:34 passaram e1 falhou porque datetime-local
descartava a entrada com seis casas. Campo ajustado para texto com formato UTC
explícito; depois35 direcionados e regressão integral885 passaram.
CI do SHA publicado será registrado no PR. Backend vivo não ensaiado: fixtures
testam serialização, projeção e comportamento da UI, não a consulta SQL real.
Validação visual dispensada pelo usuário como requisito dos PRs.

| ID | Critério do incremento | Resultado | Evidência |
| --- | --- | --- | --- |
| FILT-01 | AND, limites independentes, microssegundos e interseção positiva | PASSOU | OccurrenceFilters.test.tsx: serialização, adjacência, um microssegundo, offset |
| FILT-02 | Aplicação/limpeza/paginação com total servidor e sem regressão | PASSOU | fluxo aplicar/paginar/reaplicar/limpar; chamada antiga |
| FILT-03 | Permissões, foco, contexto e descarte de resposta antiga | PASSOU | EVENT_VIEW negado, outra igreja, foco com campo não aplicado, resposta atrasada |
| FILT-04 | Legado literal, validação e erro sem falso vazio | PASSOU | sete estados, três modalidades, inválidos e HTTP403 |
| FILT-05 | Backend vivo deste incremento | NAO_TESTADO | sem ensaio de ambiente; contrato integrado inspecionado |

## Revisor

Revisão estática sequencial de diff, contrato, precisão, contexto, abortos de
leitura, paginação e estado. Sem achado crítico/alto remanescente identificado.
Parecer independente PENDENTE. Não armazenar filtro como concessão; backend
continua autoridade. Limite residual: sem teste de backend vivo nesta sessão;
nenhuma evidência visual obrigatória. Não conclui as demais capacidades da #4.
Sem merge em main, deploy, infraestrutura, alterações backend ou banco do usuário.
Próxima ação: CI/revisão do head e solicitação Run local; seguir demanda independente.
PODE_CONCLUIR issue: NAO, aceite humano PENDENTE.

```yaml
atividade: FE-04-OCCURRENCE-FILTERS
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 885
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao do head e abrir Run local; continuar demanda independente
pode_concluir: false
aceite_humano: PENDENTE
```
