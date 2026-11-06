# FE-01 — revisão de integração

## Evidência dos contratos

Revisão realizada em 05/11/2026. A issue frontend #1 não possui comentários adicionais. Consultadas as issues backend #10/#11 e a proposta `docs/api/rbac-proposta-5a.md`, além dos controladores e configuração de segurança locais.

O documento declara expressamente que a API RBAC é uma proposta não implementada. `/api/v1/accounts/me/authorization?denominationId=...` não está exposto. O [PR backend #20](https://github.com/vinnigump/church_manager/pull/20) também registra serviços internos sem endpoints ou mudança de HTTP Basic/CSRF. O motor de decisão interno do [PR #19](https://github.com/vinnigump/church_manager/pull/19) não constitui um contrato HTTP consumível.

Não habilitar a administração usando os exemplos da proposta. O bootstrap técnico não é uma conta eclesiástica e não recebe automaticamente capacidades denominacionais.

## Dependências necessárias para concluir a integração

- Contrato implementado para identificar o sujeito autenticado, incluindo o comportamento do bootstrap técnico.
- Descoberta de contextos autorizados e resposta de capacidades que preserve permissão e escopo da mesma atribuição; sem ampliar concessão local para denominação.
- Semântica de atualização/revogação das capacidades na interface; autorização sempre revalidada pelo servidor.
- Decisão documentada sobre encerramento remoto de sessão Basic/CSRF. O botão Sair atual encerra somente o estado em memória da interface.
- Ambiente sintético com backend, contas e concessões de teste para ensaio ponta a ponta. Não utilizar dados de produção nem criar concessões no banco de uso.

Esses itens são dependências, não novos endpoints aprovados por este frontend. Permanecem sob o trabalho backend #10/#11. Nenhum arquivo ou banco do backend foi modificado nesta revisão.

## Revisão do frontend

Corrigida concorrência de sessão: a resposta de um login anterior não pode autenticar novamente após saída; um 401 anterior não pode limpar credenciais de um login novo. O controle também cobre leitura assíncrona do corpo da resposta.

Cobertura adicional exercita navegação login → conta → saída, remoção de conteúdo privado após 401 e respostas atrasadas entre sessões. As respostas de erro continuam sem refletir conteúdo recebido do servidor; credenciais ficam em memória.

Inspeção estática: campos possuem labels e autocomplete; loading desabilita envio; erros usam alert; há link para pular navegação, foco visível, viewport e layout flexível. Inspeção visual em navegador, teclado/leitor de tela e ensaio real com backend ainda não foram executados; não considerar essa inspeção uma certificação de acessibilidade ou de responsividade.

## Sequência

A #1 continua em rascunho até resolver essas dependências e revisar a integração real. A #2 depende adicionalmente de OTP/sessão pública e APIs de Jornada do backend #14/#15; não substituir contratos pendentes por sucesso simulado. Preservada a ordem das issues.
