# Eventos do participante e inscrições próprias

Consome backend179 e181 integrados. Em Eventos, a área de participação descobre igrejas por associação persistida via `/accounts/me/event-churches`, sem depender de EVENT_VIEW ou concessões RBAC. A seleção abre `/eventos/participar/igrejas/:churchId` e usa o calendário público/participante real, que protege a audiência no servidor. Igreja inativa não oferece novas participações pela descoberta.

Lista paginada de todos os períodos mostra nome, horários, local, estado e entrada livre/inscrição. Consulta individual das opções reais antes de confirmar a própria inscrição. Não reserva vaga na leitura nem presume presença. O servidor revalida identidade, audiência, janela e capacidade no comando. Não monta tarefa/trilha extra no cliente.

`/minhas-inscricoes` mostra histórico persistido do titular, sem depender da igreja ou audiência atual, incluindo estado e presença mínima confiável/legada. Nenhuma lista de terceiros é retornada. Sem cancelamento, reinscrição ou efeitos novos sobre membresia.

Paths são relativos ao ApiClient (base padrão `/api/v1`); não repetem o prefixo. Respostas projetadas e validadas por escopo/página/IDs, sem campos pessoais extras. Componentes remontados por sessão/igreja; chamadas pendentes abortadas, tentativa duplicada bloqueada e resultado ambíguo orienta consultar o histórico. Datas representam instantes do servidor; apenas a apresentação usa o fuso do dispositivo, explicitamente indicado.

Build TypeScript/Vite e lint locais aprovados. Sem unitários novos/executados localmente conforme instrução. Não realizado E2E, inscrição real pelo navegador, teste assistivo ou concorrência/virada de janela. CI existente preservado. A paginação não promete snapshot entre pedidos distintos.
