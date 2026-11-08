# FE-04 — gerar nova série anual de rascunhos

Issue canônica frontend #4; backend EVT-008/#28 e PR101 integrado.
Eventos / FE-04, prioridade não definida na issue frontend. Data2026-11-08 UTC.
Branch codex/fe-04-annual-generation, base frontend b7525b6. Papéis sequenciais
no mesmo agente; revisão independente/aceite humano PENDENTES.

## Implementador

Contrato event-planning-v1 1.0.0, EventPlanningController/Models/Service,
backend integrado86db43b78afb944841bd4ab6d73f21c3f11efad0. Comentários canônicos
da issue backend28 registram decisão posterior do usuário: diária/semanal/mensal
dentro do ano e avanço de datas/horários inexistentes. Não interpretar o texto
histórico frontend como autorização de recorrência infinita ou edição de série.

Nova rota `/eventos/igrejas/:churchId/planejamento/gerar`, entrada no catálogo
autorizado sob EVENT_CREATE. A tela compõe EVENT_VIEW (para selecionar tipos
do catálogo real) e EVENT_CREATE antes do GET/POST. Backend generate exige
EVENT_CREATE real; a exigência adicional de leitura é da seleção no catálogo,
não um novo grant ou regra de autorização do servidor. Não há campo de UUID.

Escolha de tipo paginado e configuração explícita: ano1–9999, três frequências,
intervalo1–366, primeiro início civil sem offset com até microssegundos,
última data nominal inclusiva, duração1–527040 minutos, capacidade/modalidade/
participação/check-in. OPEN_EVENT exige false. Capacidade vazia significa null.
Cliente valida formato/ano/limites conhecidos; servidor calcula o planejamento
no fuso persistido da igreja e valida limites efetivos. Não simula RRULE nem
calcula datas, quantidade ou ajustes no navegador. Resumo antes do envio não é
prévia de ocorrências e não faz chamadas de escrita.

Confirmação explícita envia POST /planning/generate, JSON projetado, CSRF
compartilhado; sem cabeçalho de revisão inexistente. Cada POST cria lote novo.
Trava acima das guardas permanece após a tentativa, sucesso ou erro; não há
retry automático ou liberação por foco. Campos preservados em erro, aviso de
possível duplicação e link à lista antes de abrir nova geração. Mudar campos
cancela confirmação; foco descarta confirmação; contexto desmontado aborta a
requisição e ignora resultado atrasado (aborto não promete rollback do servidor).

Sucesso somente após validar churchId/ano/fuso não vazio/regra UUID e1–366 itens
distintos DRAFT/revisão0/origemnull/duração exata/flag adjusted. Projeta extras.
Apresenta fuso, instantes e ajuste retornados, links autorizados de detalhes.
Não publica ocorrência/calendário, não altera séries existentes, inscrições,
presenças ou dados do template. Não cria idempotência fictícia. Cópia manual
e edição seletiva de séries continuam atividades próprias, não entregues aqui.

## Testador

Node24/Windows. npm ci, lint, typecheck, npm test, build e diff --check passaram.
**900 testes/39 arquivos,50 novos** contra base850. Nenhum ignorado/timeout ou
dependência/lockfile alterados. Primeiro ensaio50:48 passaram/2falharam: matcher
de texto não considerava texto composto do aviso e parametrização [] passava
undefined ativando o default da fixture. Corrigidos os testes, sem relaxar
autorização;50 direcionados e regressão completa900 passaram.
CI do head publicado registrado posteriormente no PR. Fixtures/jsdom; backend
vivo/fuso real não ensaiados nesta sessão. Testes do cliente não comprovam
algoritmo de recorrência/ajuste no banco. Validação visual dispensada como
requisito dos PRs por instrução atual do usuário.

| ID | Critério deste incremento | Resultado | Evidência |
| --- | --- | --- | --- |
| GEN-01 | Seleção real/configuração explícita/três frequências | PASSOU | AnnualGenerationPage.test.tsx: payloads, catálogo, inválidos |
| GEN-02 | Sem converter hora civil; resultado/fuso/ajustes do servidor | PASSOU | microssegundos, minutos, duração exata, projeção/DTO inválido |
| GEN-03 | Confirmação/CSRF sem duplicação automática | PASSOU | revisão sem POST, voltar, clique duplo/foco, cinco HTTP e resposta inválida |
| GEN-04 | Permissões e contexto sem dados de origem anterior | PASSOU | três negações, contexto inválido, campos/foco, resposta antiga após troca |
| GEN-05 | Backend vivo / geração de datas em zona real | NAO_TESTADO | contrato e serviço integrados inspecionados; sem ensaio local |

## Revisor

Revisão estática sequencial de rota/guardas, catálogos, JSON/CSRF, limites,
resposta, travas/aborto, precisão e ausência de efeitos de participação.
Sem achado crítico/alto remanescente identificado; revisão independente PENDENTE.
Riscos: endpoint não idempotente; usuário deve conferir lista antes de nova
tentativa/geração. Servidor decide disponibilidade de tipo, fuso, limites
efetivos e quantidade. Sem alterações backend/infraestrutura, merge em main,
deploy ou operação no banco do usuário. Não conclui toda a issue4/28.
Próxima ação: CI/revisão e Run local; continuar cópia manual independente.
PODE_CONCLUIR issue: NAO, aceite humano PENDENTE.

```yaml
atividade: FE-04-ANNUAL-GENERATION
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 900
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao e solicitar Run local; continuar copia manual independente
pode_concluir: false
aceite_humano: PENDENTE
```
