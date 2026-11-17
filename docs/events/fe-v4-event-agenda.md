# FE-V4-EVENT-AGENDA — Semana, Mês e Lista

Issue canônica: #4; mestre backend #64. Branch codex/v4-event-agenda-ui.
Contrato prerequisite integrado: backend #170 / fd17bbac338adc85a48e8fba3f8b979abd1a9d6c.
Extensão event-records-v1 1.1.0, com EVENT_VIEW real e CSRF/cliente existentes.

## Entrega

Eventos abre Semana (segunda-domingo), com Mês e Lista na mesma área. Hoje, fuso,
âncora e limites são fornecidos pelo servidor, com timezone persistido da igreja.
Anterior/Próximo seguem a unidade da visão. Hoje reconsulta o servidor mesmo sem
mudança de URL, cobrindo abas abertas durante a virada do dia.

Calendário lê todas as páginas sequencialmente e fixa a âncora da primeira resposta.
Falhas, duplicatas ou divergências não exibem resultado parcial como completo. Não
há promessa de snapshot entre requests; total/limites são confrontados e mudanças
conhecidas exigem atualização. Limite técnico de exibição:10000 eventos, com erro
em vez de truncamento silencioso; Lista paginada continua disponível.

Desktop mostra sete dias/colunas. Mobile apresenta semana em sequência; Mês mostra
quantidade por dia e lista do dia escolhido. Evento que atravessa dias aparece em
cada dia pertinente, com Continuação, preservando o mesmo ID/detalhe. Meia-noite
final é exclusiva, inclusive com microssegundos. Nenhuma ocorrência é duplicada.

URL conserva visão, âncora, dia e página ao abrir detalhe/editar e retornar, inclusive
pela janela de inscrição. Detalhe/lista consultam a referência com size1 para exibir
horários no timezone do servidor. Parâmetros de retorno são locais e validados.
Recorrência simplificada, escalas, crachás e remoção global do legado ficam separados.
Sem endpoints fictícios, dados de demonstração em produção ou publicação anual.

## Critérios de aceite

| ID | Critério | Evidência |
| --- | --- | --- |
| CA-01 | Semana/Mês/Lista com referência servidor | EventRecordPages.test.tsx |
| CA-02 | Todas as páginas, âncora fixa e mudanças rejeitadas | agenda-api.test.ts |
| CA-03 | Hoje reconsulta mesmo sem alterar URL | EventRecordPages.test.tsx |
| CA-04 | Evento atravessa dias sem contar meia-noite final | agenda-api / EventRecordPages testes |
| CA-05 | Voltar restaura período/visão/dia/página | EventRecordPages / RegistrationWindowPage testes |
| CA-06 | Timezone inválido/IDOR/dados extras/abort negados | agenda-api.test.ts |
| CA-07 | Vazio/erro e nenhum calendário parcial | EventRecordPages.test.tsx |

Resultados efetivos finais de npm ci/lint/typecheck/test/build e SHA constam no PR.
Logs locais: output/parallel_mvp/events/frontend-*.log, no workspace pai.
Testes de componente/contrato usam transporte simulado; não alegar E2E real.
Revisão central apontou limite9999/size variável e Hoje sem URL nova; corrigidos e
cobertos. Aceite/merge conforme coordenação autorizada pelo usuário, sem deploy.

PODE_CONCLUIR issue #4: NÃO. A entrega é um incremento, não o MVP inteiro.
