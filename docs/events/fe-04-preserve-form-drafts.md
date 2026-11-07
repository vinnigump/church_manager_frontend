# FE-04 — preservar nomes locais durante reautorização

Issue canônica [#4](https://github.com/vinnigump/church_manager_frontend/issues/4),
Eventos / FE-04, prioridade não definida, 2026-11-07 UTC.
Branch `codex/fe-04-preserve-event-drafts`, base `86f0821`.
Responsável: agente da atividade; papéis sequenciais, revisão independente pendente.

## Problema e comportamento

ResourceAccess oculta/desmonta o conteúdo ao reconsultar autorização por foco.
Os nomes dos formulários estavam nesse conteúdo e eram reinicializados: alternar
janela e voltar podia apagar o que não havia sido salvo. No editor de template,
isso também removia o aviso de nome alterado e voltava a habilitar publicação.

Nomes de criação local, criação denominacional e edição de template agora ficam
na memória do workspace acima das guardas. A guarda continua negando por padrão,
ocultando os campos enquanto verifica ou nega permissão. Nenhuma concessão é
preservada. Os limites existentes de conta/igreja/denominação/template continuam
desmontando o workspace e limpando esses valores. Sem storage, logs ou envio do
nome apenas por voltar ao foco.

Ao começar a editar um template, mantém-se o snapshot original da raiz/rascunho.
Após nova leitura, revisão, versão ou estado divergente bloqueiam salvar/publicar
e mantêm o nome local com aviso. A submissão também verifica a condição, além
do botão desabilitado. “Descartar alterações locais e atualizar template” é uma
ação explícita separada; a atualização normal conserva o nome local. Sucesso
de comando próprio limpa o editor e reconsulta a versão confirmada. Erro conserva
nome e trava até conferência, sem repetição automática. Confirmações transitórias
continuam sendo canceladas quando as guardas remontam, para exigir nova confirmação.

Não altera endpoints, payloads, permissões, revisões enviadas ou regras do servidor.
Usa event-type-catalog-v1 e event-template-version-v1 1.0.0 já integrados, com
controle de concorrência por revisão. Não depende dos PRs de confirmação #60–#62.

## Critérios do incremento

Esta matriz não conclui a issue #4.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| FORM-01 | Preservar nomes nos três formulários durante foco | PASSOU | LocalTypeManagement/TemplateCreation/TemplateManagement.test.tsx |
| FORM-02 | Ocultar formulário sem permissão e não transportar nomes entre contextos | PASSOU | negação/restauração de EVENT_CREATE e três testes de troca de contexto |
| FORM-03 | Não publicar nome não salvo ou sobrescrever revisão/versão concorrente | PASSOU | testes de foco, duas alterações concorrentes e submissão direta bloqueada |
| FORM-04 | Descarte/recarga explícitos e erro preservam reconciliação sem replay | PASSOU | descarte e erro500 seguido de foco, contagem de escritas |
| FORM-05 | Ensaio visual/AT e backend vivo desta correção | NAO_TESTADO | solicitar ativação do ambiente ao usuário quando necessário |

## Testador e revisor

Node24/Windows/Vitest5.1.0. npm ci executado neste worktree, lockfile inalterado.
Primeira rodada direcionada:5 falhas de reprodução em86 testes (os novos casos
de isolamento já passavam). Após correção,86 direcionados passaram; acrescentado
mais um cenário de erro/foco e fortalecida a submissão direta durante conflito.
Regressão final: **659 testes em32 arquivos aprovados**,9 novos, sem ignorados.
Lint, typecheck, npm test, build e diff --check passaram. Sem ajuste de timeout,
dependências ou enfraquecimento de asserções.

Revisão estática sequencial sem achados críticos/altos remanescentes. Risco
principal revisto: cache de campo não é cache de permissão; dados permanecem
ocultos na perda de acesso e isolados pelos workspaces existentes. A memória
é descartada na troca de contexto/saída. Revisão independente PENDENTE.

Validação visual, leitor de tela e backend vivo não executados nesta atividade.
Conforme orientação do usuário, solicitar ativação quando a etapa visual for
necessária; não parar/reiniciar aplicações como requisito para desenvolvimento.
Sem backend/infraestrutura, merge/deploy ou exposição de credenciais.

PODE_CONCLUIR: NAO — issue parcial e aceite humano pendente.
Próxima ação: PR draft, CI/revisão e homologação necessária com aplicação ativada
pelo usuário.

```yaml
atividade: FE-04-PRESERVE-FORM-DRAFTS
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 659
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [homologacao_visual, backend_vivo_nao_ensaiado, revisao_independente, aceite_humano]
proxima_acao: Conferir CI e revisao; solicitar ativacao para homologacao quando necessaria
pode_concluir: false
aceite_humano: PENDENTE
```
