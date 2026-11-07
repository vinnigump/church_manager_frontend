# FE-01 — preservar campos locais da gestão de perfis

Issue canônica [#1](https://github.com/vinnigump/church_manager_frontend/issues/1),
Segurança / FE-01, prioridade não definida. Data: 2026-11-07 UTC.
Branch `codex/fe-01-preserve-profile-drafts`, base `86f0821`.
Responsável: agente da atividade; papéis sequenciais, sem revisão independente simulada.

## Problema e correção

Ao revalidar autorização por foco, ResourceAccess desmontava ProfileControls.
Nome, código, escopo e permissões não salvos eram reinicializados. Isso podia
apagar escolhas e remover o bloqueio de publicar alterações não salvas.

Os campos ficam agora na memória do workspace acima da guarda, associados ao
snapshot original de perfil/rascunho. Nenhuma permissão de acesso é conservada:
a guarda continua ocultando o formulário durante verificação/negação. Conta,
denominação e perfil continuam delimitando o workspace e limpando os campos ao
desmontar. Sem storage, envio por foco ou alteração dos grants da conta.

Revisão, versão, estado ou escopo divergente do snapshot mantém os campos locais
e bloqueia gravação/publicação. Submit também verifica a condição, sem usar
silenciosamente uma revisão nova para sobrescrever dados. Descarte e atualização
têm ação explícita; atualização normal preserva o campo. Comando próprio
confirmado limpa o editor e reconsulta os dados. Erro conserva campos e trava
até leitura explícita; confirmação transitória não sobrevive à remontagem.

O catálogo de permissões é sempre o recém-consultado, nunca o snapshot dos campos.
Seleção que se torna indisponível permanece marcada com aviso para remoção
explícita; salvar/publicar seguem bloqueados. Selecionar códigos não atribui
perfis nem concede autoridade. Contratos profile-drafts/profile-lifecycle e
permission-catalog existentes preservados, sem novos endpoints/payloads/regras.

## Critérios do incremento

Não representa o inventário integral da issue #1.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| PERF-01 | Criar/editar mantém campos e escolhas após foco | PASSOU | ProfileManagement.test.tsx, criação e edição sem escrita |
| PERF-02 | Catálogo novo exige remover explicitamente seleção indisponível | PASSOU | alteração de catálogo sem alteração do rascunho persistido |
| PERF-03 | Mudanças concorrentes não rebaseiam revisão silenciosamente | PASSOU | revisão de versão e raiz/estado, submit direto bloqueado e descarte |
| PERF-04 | Negação oculta dados, contexto novo limpa e erro não repete | PASSOU | perda/restauração, outra denominação e erro500/foco/atualização |
| PERF-05 | Ensaio visual/AT e backend vivo desta correção | NAO_TESTADO | solicitar ativação ao usuário quando necessário |

## Testador e revisor

Node24/Windows/Vitest5.1.0; npm ci executado neste worktree, lockfile inalterado.
Antes da correção:7 falhas em43 testes direcionados, demonstrando perda de campos
e ausência de bloqueio por snapshot. Depois:43 direcionados e **658 testes em32
arquivos aprovados**,8 novos, sem ignorados. Lint, typecheck, npm test, build e
diff --check passaram; sem ajuste de timeout ou enfraquecimento de asserções.

Revisão estática sequencial sem achados críticos/altos remanescentes. Conferidos
isolamento por workspace, descarte na saída/troca de contexto, reautorização,
catálogo fresco e ausência de grants/storage novos. Parecer independente PENDENTE.
Campo preservado não é concessão; backend continua reautorizando toda operação.

Sem backend vivo, leitor de tela ou aceite visual desta correção. Quando
necessário, solicitar ativação da aplicação ao usuário, conforme instruído.
Sem backend/infraestrutura, merge/deploy ou exposição de credenciais.

PODE_CONCLUIR: NAO — issue #1 parcial e aceite humano pendente.
Próxima ação: PR draft, CI/revisão e homologação necessária com ambiente ativado
pelo usuário.

```yaml
atividade: FE-01-PRESERVE-PROFILE-DRAFTS
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 658
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
