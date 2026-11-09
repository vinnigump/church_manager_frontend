# FE-CAD-A2-A4-RASCUNHO-MINIMO

Execução `49459e06-6016-4431-9ed8-df95ea70581d`, 2026-11-09 UTC.
Issue canônica #33, requisito vinculado #103 fornecido pelo host.
Implementador Codex, módulo Pessoas, onda 2.
Branch `codex/wave-2-fe-cad-a2-a4-rascunho-minimo-49459e06`.
Base e HEAD conferidos `d8a63f7a5c8d5a55137b5b094a53fcf9b54d9a68`.
Este SHA identifica a base. Alterações e evidências permanecem na worktree.

## Escopo e composição

Lidos AGENTS.md, README, governança de prestação de contas, requisito #103
fornecido, PersonViews e seus testes, relatório integrado de #98. Inspecionados
App.tsx e usos dos componentes. O briefing delimita componentes isolados.

PersonDraft passa a carregar email, phone e birthDate além de fullName e cpf.
O formulário exige nome não vazio, CPF ou alternativa já aceita pelo chamador
e pelo menos um contato não vazio. `birthDateRequired`, opcional e inicialmente
false, representa exclusivamente a regra fornecida pelo chamador.
A validação documental e autorização permanecem responsabilidades do serviço.

Edições incompletas ficam no estado React sem chamar onSubmit. Desmontagem
descarta o rascunho. O chamador mantém o contrato existente de desmontar em perda
de acesso e trocar key em mudança de contexto. Nenhum armazenamento persistente
é usado. Erro e conflito preservam os campos editáveis e bloqueiam reenvio até
reconciliação pelo chamador. A ficha exige retorno confirmed do callback.

## Critérios e evidências do implementador

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Nome, documento aceito e um contato obrigatórios | PASSOU | PersonViews.test.tsx, campos vazios, alternativa aceita, e-mail ou telefone isolados |
| Nascimento obrigatório somente por regra recebida | PASSOU | Teste birthDateRequired e sucesso sem nascimento nos demais cenários |
| Edição incompleta sem criação e sem storage | PASSOU | Teste de rascunho verifica callback e Storage.setItem |
| Descarte por contexto e perda de acesso | PASSOU | Troca de key, desmontagem durante confirmação pendente e remontagem vazia |
| Erro, conflito e ficha confirmada | PASSOU | Testes de erro/conflito/rejeição, preservação e edição, Promise pendente, ficha retornada |

Ambiente Windows/PowerShell, Node 24.22.1, npm 11.19.1, dependências preparadas
pelo host. Comandos reais executados na worktree com npm e cache configurado.

| Comando | Resultado |
| --- | --- |
| `npm test -- src/people/PersonViews.test.tsx` | 13 testes aprovados |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm run build` | Aprovado, 114 módulos |
| `npm test` | 57 arquivos, 1.417 testes aprovados |
| `git diff --check` | Aprovado |

Após a suíte completa, acrescentadas asserções de preservação do e-mail e edição
do telefone nos testes de falha/conflito. Suíte dirigida reexecutada.
CI NAO_EXECUTADO, dependente do futuro SHA publicado pelo host.
Revisão e evidências independentes de Testador/Revisor PENDENTES.

## Handoff

Atividade implementada localmente. Revisão PENDENTE. PODE_CONCLUIR NAO para a
issue completa, cujo aceite humano e integração contextual continuam pendentes.
BE-ID-DOCUMENTOS e BE-ID-ESCOPO permanecem dependências da integração em produção,
conforme requisito #103. Prazo técnico de expiração/limpeza antes de produção
permanece decisão pendente registrada em A4. Esta fatia usa somente memória
durante a montagem do componente.
Próxima ação do host é revisar o diff e encaminhar validação independente e CI.
