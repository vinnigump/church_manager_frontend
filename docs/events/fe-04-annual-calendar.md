# FE-04 — calendário anual administrativo EVT-007

## Implementador

Issue frontend #4 e backend #27. Branch codex/fe-04-annual-calendar iniciada sobre
main 6c751ca, independente dos PRs #25/#26 então abertos, sem comentários e com
CIs success. Enquanto avançava, ambos tiveram merge externo. Pareceres favoráveis
lidos e branch atualizada por rebase sobre main 8a4eead, sem conflitos. Não houve
merge/deploy pelo agente nem alteração dos resumos locais não rastreados.

Verificado backend origin/master 93612be, com PR #81 efetivamente integrado
(5a06fe0): OpenAPI event-calendar-v1 1.0.0, EventCalendarController/Service,
SecurityConfiguration e docs/reports/evt-007-calendar-publication.md lidos via
Git diretamente da referência integrada, pois checkout local estava em outra base.
Issue #27/reconciliações e issue frontend #4/comentários consultados novamente.

Contrato administrativo sob /api/v1/events/churches/{churchId}/calendars/{year}:
GET consulta; POST sem corpo cria; POST /publish e /unpublish sem corpo usam
X-Expected-Revision lógico. ETag opaco não é convertido em revisão nem If-Match.
Basic em memória, CSRF, cookie e no-store existentes preservados. Operações exigem
EVENT_CALENDAR_MANAGE/CHURCH; backend revalida autorização e revisão em cada comando.

Rotas frontend /eventos/igrejas/:churchId/calendarios e /:year permitem seleção de
ano 1–9999, sem UUID solicitado nem ano/fuso inventado. Contexto vem do acesso da
igreja. Link no catálogo é mostrado somente após decisão própria de calendário;
EVENT_VIEW não equivale a EVENT_CALENDAR_MANAGE. Título/foco usam layout existente.

Somente GET 404 confirmado oferece criação explícita; erro de rede/403/500/schema
não é reinterpretado como ausência. Publicação e retirada exigem confirmação que
explica independência de ocorrências/inscrições/check-in. São apenas metadados do
planejamento anual; nenhuma agenda, entrada, público anônimo ou link privado foi
simulado. A landing Eventos e README distinguem disponibilidade administrativa da
agenda de ocorrências pendente. Datas exibidas explicitamente em UTC.

DTO é projetado e validado em runtime: identidade, igreja/ano solicitado, enum,
revisão segura, datas com fuso e coerência status/publicação. Escritas confirmam
identidade e estado esperado. Hook acima da guarda mantém trava por ref durante
foco; trocar conta/igreja/ano ignora resposta antiga e aborta transporte sem afirmar
rollback no servidor. Sucesso confirmado dispara GET separado. Rede/5xx/schema são
resultado incerto, sem retry automático. 4xx também exige atualizar antes de repetir;
se a consulta falha, nenhum controle de escrita é disponibilizado.

## Testador

npm ci reproduzido nesta sessão com mesmo package/lockfile, sem dependências alteradas;
sete moderados existentes reportados. Após integração de #25/#26, lint, typecheck,
350 testes (43 novos + 307 da base atualizada), build e diff --check passaram.
Uma execução inicial de lint apontou import não utilizado no novo teste, corrigido
antes das verificações finais. Nenhuma regra de domínio alterada para testes.

Casos: métodos/payloads/header exatos, Basic/CSRF/cookie/no-store, sem If-Match,
ano/IDs/DTOs/datas inválidos, resposta de outro recurso, acesso negado, título/foco,
seleção de ano, criação somente após 404, confirmação/cancelamento, publicar/retirar,
403/409/422/500/rede/schema sem retry, erro de leitura sem criação, trava durante
foco/duplo clique, escrita de igreja antiga, leitura de ano antigo, link condicionado
à permissão específica e 401 com AuthProvider real. Suíte completa inclui versões,
criação denominacional e normalização de erros JSON integradas anteriormente.

Cliente/componentes reais com respostas controladas conforme OpenAPI; sem backend
vivo, banco de uso, ensaio visual responsivo ou tecnologia assistiva. Nenhuma escrita
em dados reais. CI deste head deve ser conferida após abrir o PR em rascunho.

## Revisor

Papéis sequenciais pelo mesmo agente, sem revisão independente. Revistos contrato,
identidade/contexto, negação por padrão e separação de estados. Sem achado crítico/alto
identificado. Parecer favorável com limites de visual/AT e ponta a ponta pendentes;
revisão humana do PR permanece necessária.

Entrega parcial da #4/#27. Entradas detalhadas, agenda de ocorrências, projeção pública,
cópia anual e inscrição/presença continuam sem integração neste contrato. Nenhuma
recorrência semanal/mensal/personalizada, inscrição ou check-in foi introduzido.
