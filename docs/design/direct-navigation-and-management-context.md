# Navegação pelo item e contexto de gestão — 18/11/2026

Origem: feedback do usuário sobre o cartão de evento da Home e a troca de igreja. Esta rodada corrige interação; não declara todas as telas homologadas pelo público.

## Navegação principal

`ItemLink` mantém um link HTML real e estende sua área ao cartão com CSS. Suporta teclado, foco visível, menu de contexto e nova aba. Não há `onClick` genérico no contêiner nem links envolvendo outros controles. Links e botões secundários ficam acima da área principal e continuam independentes.

Aplicado a Home/eventos, calendário semanal/mensal, lista administrativa e lista do participante; Pessoas com edição autorizada; ministérios/departamentos; grupos; tarefas; próximas ações da Home; percursos pessoais; escalas administrativas; questionários/respostas; perfis, atribuições centrais/delegadas, fontes de delegação e modelos de evento. Linhas informativas sem destino e ações de gravação, presença, perda ou exclusão permanecem explícitas. Editores com várias ações não ganham navegação implícita no espaço do formulário.

O cartão da Home abre `/eventos/participar/igrejas/:churchId/eventos/:occurrenceId`. O detalhe usa o GET público de detalhe já existente, preservando audiência, inclusive a restrição do visitante. A disponibilidade de inscrição continua consultada e confirmada separadamente. O detalhe oferece calendário administrativo para quem tem EVENT_VIEW; os demais recebem o retorno aos eventos visíveis para seu cadastro. Não há fallback para uma API administrativa caso a leitura pública seja negada.

## Contexto

As áreas de gestão mostram um seletor de igreja quando existem alternativas autorizadas; um único contexto é apresentado pelo nome. Configurações denominacionais usam seletor de denominação. Opções vêm da descoberta de contextos e da autorização da operação, com falha fechada. A seleção não concede permissões.

A igreja própria é o padrão inicial. A escolha explícita é mantida somente em memória na sessão da conta e usada pelos atalhos e entradas dos módulos. Trocar de igreja leva à raiz equivalente ou à criação autorizada; nunca reaproveita o ID de uma entidade da igreja anterior. A proteção de rascunho continua responsável por cancelar ou confirmar a saída. Sem gravação de domínio ao selecionar contexto. Nova sessão/recarregamento volta ao padrão da conta, salvo o contexto explícito da URL atual.

## Evidências

- Typecheck, lint e build aprovados.
- Suíte existente:1534 testes aprovados; três casos novos cobrem contexto sem permissão, falha de descoberta e usuário com somente criação.
- Navegador local de revisão: cartão resolve detalhe público; calendário completo abre agenda; segunda igreja mostra dados próprios e atualiza atalhos; tarefas mantêm a igreja escolhida; troca com rascunho pede confirmação e cancelar preserva os campos.
- CI e commit integrado são registrados no PR; atualização local e capturas no checkpoint do workspace. Sem mudança de backend, banco, dependências ou regras de negócio.
