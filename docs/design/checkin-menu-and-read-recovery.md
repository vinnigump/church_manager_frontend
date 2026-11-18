# Check-in, navegação e consultas — 18/11/2026

Solicitação do usuário: retirar os botões Atualizar, renomear Recepção para Check-in e eliminar submenus que repetem a mesma tela.

## Comportamento

- Consultas continuam carregando ao abrir a tela e depois das operações confirmadas pelos fluxos existentes. Nenhum polling ou reenvio automático de gravação foi adicionado.
- `ReadResult` e `Query` não exibem atualização manual no estado normal. Erros de leitura oferecem Tentar novamente, que repete somente a consulta.
- Controles explícitos de atualização foram removidos das telas. Quando uma gravação tem resultado incerto, Conferir resultado/atendimento/dados aparece somente nesse estado e permite a reconciliação existente antes de liberar outra tentativa. Não se trata de repetir o comando.
- Ações conscientes de descarte de rascunho permanecem distintas da recarga rotineira.
- Check-in é o novo nome da entrada /recepcao, do cabeçalho e do título. URLs e permissões não mudam. A entrada lateral não possui submenus; Entregar, Devolver ou registrar perda e Crachás e QR Codes continuam na própria tela.
- Início não repete Meu resumo; Pessoas não repete Consultar pessoas; Eventos não repete Calendário e lista; Ministérios não repete Ministérios e departamentos. Ações que abrem funções diferentes permanecem. Resolução de atalhos também elimina destinos duplicados quando permissões reduzidas fazem duas opções apontarem à mesma criação.

## Verificação

Os testes existentes que utilizavam atualização manual como espera ou disparador foram adaptados à nova interação. Recuperação após falha, autorização, cancelamento de consultas antigas, paginação e bloqueio de repetição continuam verificados. Não há testes removidos ou ignorados por essa alteração.

Typecheck, lint e build passaram. Verificações focadas cobrem as telas alteradas; CI completo e SHA integrado serão registrados no PR. Conferência visual local: nome e entrada únicos, ausência de Atualizar no estado normal, operações internas e contadores preservados. Sem alteração de backend, banco, dependências ou regras de check-in/presença.
