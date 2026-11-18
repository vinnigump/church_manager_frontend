# Implementação da revisão UX

Base aprovada: revisão e plano de17/11/2026 no workspace. Sem troca de framework ou biblioteca visual.

- Eventos: início+duracão em passos de30min, término calculado para a API, duração histórica/microssegundos preservados, opção acima de24h; agenda/detalhe/listas mostram duração e datas brasileiras. Criação com repetição, período de inscrição e visitante usa envio atômico idempotente quando essas opções são utilizadas.
- Publicação legada e mutação de calendário retiradas da operação; consultas históricas e contratos de API preservados. Casos de UI obsoletos foram substituídos por checks de leitura/autorização/ausência de gravação.
- Escala começa pelo vínculo com evento; campos herdados continuam bloqueados. Ações de atualização ficam secundárias. Submenu/página/contexto têm sinalização mais clara.
- Recepção responsiva com contadores legíveis, pendências alinhadas e uma confirmação de entrega/devolução após leitura. Perda continua explícita; foco do leitor é contextual; nenhuma repetição automática de gravação incerta.
- Pessoas/equipes/tarefas com textos mais diretos, CPF opcional, copiar primeiro acesso, contexto nominal e responsáveis reais fornecidos pela API.
- Guard de rascunho por router e beforeunload; roteador de produção usa DataRouter. Não persiste rascunhos privados no navegador.
- Trilhas com percurso/atividades unificados, abas de modelos/participantes e etapas recolhíveis; questionários com organização e prévia sem gabarito.
- Acessos nominais e concessão central/delegada pelos contratos existentes. Sessão restaurável por cookie HttpOnly; não persiste senha/Basic no navegador. Relatórios mantêm distinção entre previsto, presença e atuação.
- Home apresenta tarefas e percursos para acompanhar, além de eventos e escalas; resumo incompleto é identificado.

Typecheck/lint e1531 testes passaram antes do PR. Backend e smokes isolados de sessão/acessos, nomes de tarefas/trilhas e cadastro atômico passaram. CI e QA visual final do ambiente atualizado são registrados no checkpoint do workspace. Leitor físico e aceite com usuários finais permanecem validações operacionais.
