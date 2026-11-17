# Frontend v4 — trilhas executáveis

17/11/2026. Branch `codex/v4-sequential-trails-ui`. Issue de referência backend67.
API real185 integrada fd29f5da47566dddef6de3248bb153aa8b9e4d84. Base frontend2befaad.

## Entrega

Em Minhas trilhas: participar de uma trilha na igreja associada e abrir atividades
do percurso. A tarefa é concluída por seu responsável em Minhas tarefas; o
questionário usa rota real vinculada à etapa; Evento usa seletor real existente.
Inscrição não é tratada como presença. Acompanhamento mostra dispensa/conclusão
administrativa e pendências sem exibir códigos técnicos ou JSON. A consulta de
legado continua disponível sem simular migração.

Acesso da equipe descobre recursos/capacidades reais. Modelos têm editor de nome,
instruções, tipos e ordem; rascunho/finalização/nova versão preservam conteúdo em
andamento. Modelos denominacionais não fixam UUIDs locais: configuração da igreja
escolhe quatro destinos ou Questionário publicado conforme API. Só modelos locais
próprios podem ser editados pela igreja. Gestão mostra nome mínimo do participante.

Autorizações de ingresso podem ser registradas durante o percurso, sem criar uma
confirmação final da secretaria. A conclusão válida é automática pelo backend.
Dispensa individual de Evento/Questionário exige justificativa e capacidade
distinta; tarefa manual segue a gestão de tarefas. Nome mínimo do participante
também aparece na tarefa atribuída ao acolhedor/responsável.

Rotas adicionadas em App.tsx; navegação principal e Home preservadas. Mudança
compatível em EventTaskRegistration: callback opcional de busy para impedir que o
pai atualize/desmonte inscrição pendente. Sessão nova/rota encerra sinais pendentes;
resposta incerta bloqueia novos comandos até leitura atualizada. IDs/escopos,
titular, DTOs e resposta de gravação são validados no cliente; backend autoriza.

## Validação e limites

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Lint | PASSOU | trails-ui-lint.log |
| Tipos | PASSOU | trails-ui-typecheck.log |
| Build | PASSOU | trails-ui-build.log; aviso de chunk JS>500kB |
| Unitários novos/locais | NÃO EXECUTADOS | Instrução expressa do usuário; testes/CI existentes preservados |
| UI visual/HTTP/E2E | NAO_TESTADO | Não inferir de compilação; revisão/CI pendentes |

Logs no workspace `output/parallel_mvp/round02/tasks`. O percurso backend de
serviços/SQL foi validado e documentado em185; isso não comprova UI/E2E.
Não houve instalação de dependências, deploy, grants de perfil ou mudança de regra.

Status: EM_REVISAO. PODE_CONCLUIR issue: NÃO. Próxima ação: revisão independente,
CI e integração autorizada pelo root, depois teste do MVP pelo usuário.
