# Presença nominal e inscrição da etapa

Consome backend #179 já integrado. Tela `/eventos/igrejas/:churchId/ocorrencias/:occurrenceId/check-in`, acessível pelo detalhe de evento com inscrição/check-in e `EVENT_ATTENDANCE_MANAGE`. Busca paginada de inscritos, identificação explícita do participante, justificativa estruturada sem opção pré-selecionada, confirmação manual e hora retornada pelo servidor. Nenhuma leitura QR é sugerida. Registro legado sem prova validada é distinguido.

Cliente projeta somente campos autorizados e valida escopo/IDs/páginas. Sessão/contexto remontam o formulário; aborta chamadas ao sair. Bloqueia submissão repetida e resultado ambíguo até consulta explícita. Autoridade/janela/idade são verificadas pelo backend.

`EventTaskRegistration` exporta componente isolado para a etapa própria disponível: `{churchId,eventTypeId,taskInstanceId,onRegistered?}`. Escolha e confirmação explícitas de uma ocorrência elegível; inscrição não marca etapa concluída. A interface de Trilhas montará esse componente após integração de seu engine. Não exige EVENT_VIEW administrativo para o participante.

Verificação local: build TypeScript/Vite e lint aprovados. Nenhum teste unitário novo ou executado localmente, conforme instrução do usuário. Não realizado E2E, check-in real no navegador, concorrência, acessibilidade assistiva ou conclusão integrada de trilha. CI existente preservado.

Próximo: descoberta própria de igrejas/calendário e consulta de inscrições após contrato backend adicional; cancelamento depende de recorte aprovado. Sem QR/crachá, cancelamento, check-out ou correção nesta tela.
