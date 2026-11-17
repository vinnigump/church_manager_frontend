# FE-V4-SERVICE-ROSTERS — Gestão e consulta própria de Escalas

Issue mestre backend#64. Branch codex/v4-service-rosters-ui.
Backend173/V31 integrado em9edde018960a07af155b235bd1b68e60f6602fba antes da ativação.
Base frontend28f6508 inclui Grupos. Contrato service-rosters-v1, sem APIs simuladas.

Entrega: acesso contextual em Ministérios→Escalas, lista/detalhe, criar/editar
previsão, seletor de unidade ativa e contas associadas, evento opcional e presença
manual inicial por autorizado. Campos não incluem função, aceite, cotas ou ausência.
Presenças registradas bloqueiam editor; não há cancelamento/exclusão/correção.

Minhas escalas aparece na Home e em /minhas-escalas, com igreja/unidade/horário/fuso.
Evento visível destaca Você está escalado; evento restrito só informa associação,
sem nome/ID/detalhe. A lista própria não mostra dados de outras pessoas. O widget
é resumo de até5 itens da primeira página; a consulta completa é paginada e não
promete mostrar todo o histórico de uma vez.

SERVICE_ROSTER_VIEW/MANAGE/ATTENDANCE são conferidos por igreja; EVENT_VIEW apenas
para escolher/trocar evento. Conta sem VIEW pode criar com MANAGE, sem receber
links de consulta administrativa. Não há UUID digitado nem concessão por participação.
Cliente reutiliza Basic/CSRF existentes, sem storage; valida projeção/respostas,
contexto, revisões, conjunto de participantes e presença inicial. Travas ficam
acima das guardas; tentativa ambígua exige conferência antes de repetir.

Data/hora usam deslocamento explícito, preservando microssegundos originais quando
inalterados. Leitura usa timezone persistido retornado pelo servidor. Presença
manual é declarada separadamente: data é do registro, não check-in real de evento
ou crachá. Não concluir trilha/membresia por esse registro.

| Critério | Evidência efetiva |
| --- | --- |
| Tipos/lint/build | PASSOU localmente |
| Contrato backend integrado antes de montar rotas | CONFIRMADO173 integrado |
| Percurso novo de criar/editar/presença na interface | NÃO TESTADO funcionalmente nesta execução |
| Home/permissões/sessão/erros novos | Revisão de código; cenários específicos NÃO TESTADOS |

Por instrução EXPRESSA do usuário, não foram criados/executados rotineiramente
unitários locais. CI existente preservado; resultados finais e SHA no PR. Passagem
de testes antigos não representa cobertura específica das novas regras. Sem E2E
visual, deploy ou reinício de apps. Revisão root/CI para integração coordenada.
Logs output/parallel_mvp/round02/events/frontend-*.log no workspace pai.

Limites: sem regra de saída de integrante, correção/cancelamento, controle de perda
ou devolução de crachá; sem aprovação da arquitetura Hostinger. Não concluir MVP
ou issue só porque o incremento foi integrado.

Atualização Home: contrato1.1.0/backend175 integrado antes do uso. Widget solicita
upcoming=true e valida referenceAt/upcoming e término posterior ao NOW fornecido.
Não usa relógio do dispositivo nem recorta histórico antigo como se fosse próximo.
Consulta full mantém upcoming=false e histórico paginado. Sem novo unitário local.
