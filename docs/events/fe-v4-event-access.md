# FE-V4-EVENT-ACCESS — entrada útil para Eventos

Referência: #4, com precedência das simplificações v4 aprovadas em 16/11/2026.
Branch: codex/v4-eventos-acessos. Base: release/homolog, 4db291be80658b471ba07025ba1b9519f18be453.

## Comportamento

Antes, /eventos terminava em uma mensagem de agenda pública indisponível e orientava
o usuário a procurar outro acesso. Agora consulta os contextos reais da conta,
verifica EVENT_VIEW em cada igreja e oferece o acesso à listagem administrativa
já integrada. Não obriga seleção global de igreja, não publica calendário nem
apresenta dados fictícios. Igreja descoberta sem EVENT_VIEW não aparece.

## Contratos reutilizados

- GET /api/v1/accounts/me/authorization/contexts, self-authorization-contexts-v1.
- GET /api/v1/accounts/me/authorization com EVENT_VIEW / CHURCH / resourceId.
- Destino existente /eventos/igrejas/:churchId/ocorrencias, que revalida acesso;
  o backend continua autorizando cada operação real.

Se uma decisão falhar, não apresentar snapshot parcial. Atualização explícita,
retorno do foco e troca da sessão invalidam opções antigas. Solicitações obsoletas
são canceladas e seus resultados ignorados. Sem mudar autenticação ou guardar
credenciais em storage.

## Aceite e testes

| ID | Critério | Evidência automatizada |
| --- | --- | --- |
| CA-01 | Contexto não concede EVENT_VIEW automaticamente | EventAccess.test: igreja autorizada versus igreja sem concessão. |
| CA-02 | Falha/negação mantém acesso fechado | Snapshot parcial rejeitado; estado vazio sem permissão. |
| CA-03 | Revogação/sessão não conserva opções antigas | Retorno do foco, nova sessão, cancelamento e resposta tardia. |
| CA-04 | Entrada útil e recuperação | Link para listagem existente, atualizar após falha, visitante redirecionado. |
| CA-05 | Qualidade e regressões | lint, typecheck, testes completos e build, com resultados no PR. |

Testes usam fixtures exclusivamente na suíte. Não representam prova de integração
ponta a ponta com banco/API em execução. Revisão independente e aceite: PENDENTES.

## Limites

Entrega incremental de acesso. Não é a tela final de calendário/lista v4 nem
cadastro disponível sem publicação. Essa evolução depende da mudança consistente
de contrato, serviço, migração e projeção pública; não inventar sucesso na interface.
Não introduz novas permissões, endpoints, dados ou dependência de PR backend pendente.
Sem merge/deploy. Não conclui a issue #4 inteira.
