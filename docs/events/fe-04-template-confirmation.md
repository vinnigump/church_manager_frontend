# FE-04 — confirmar efeitos das transições de templates

Issue canônica [#4](https://github.com/vinnigump/church_manager_frontend/issues/4),
Eventos / FE-04, prioridade não definida, 2026-11-07 UTC.
Branch `codex/fe-04-template-confirmation`, base `86f0821`.
Responsável: agente da atividade; papéis sequenciais, sem revisão independente simulada.

## Escopo e contrato

Contrato real `event-template-version-v1.openapi.json` 1.0.0,
`EventTemplateVersionService` e default de revisão0 em
`V7__event_template_versions.sql`, conferidos no backend integrado28ea26d.
O lock da raiz serializa essas alterações. A confirmação anterior verificava
alguns estados/IDs, mas aceitava revisões incorretas e alterações de vínculos
ou rascunhos que o comando não realiza no serviço.

Agora cada comando confirma o efeito efetivamente implementado:

- Criar rascunho: raiz incrementa uma vez, conserva estado e versão publicada;
  nova versão começa em revisão0.
- Editar rascunho: raiz mantém estado, revisão e versão publicada; rascunho
  conserva ID/número/criação, recebe o nome enviado e incrementa uma vez.
  O servidor incrementa mesmo ao salvar o mesmo nome; não é tratado como no-op.
- Publicar: raiz incrementa uma vez, publica a versão selecionada e deixa de
  apresentar rascunho.
- Descontinuar: raiz incrementa uma vez e mantém versão publicada e eventual
  rascunho remanescente intactos. Não é descarte do rascunho.

Comparação temporal mantém precisão submilissegundo e aceita instantes
equivalentes com offset. Frações são limitadas aos nove dígitos de Java Instant.
Incompatibilidade usa o erro de confirmação e a reconciliação já existentes,
sem sucesso otimista/retry. Nenhuma nova regra backend, ação, endpoint, payload,
permissão, CSRF ou alteração de layout. Fixture de novo rascunho corrigida para
revisão0, preservando revisão3 das fixtures que representam rascunhos já editados.

## Critérios do incremento

Esta matriz não cobre toda a issue #4.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| TEMP-01 | Confirmar revisão da raiz e versão publicada por comando | PASSOU | template-confirmation.test.ts, efeitos incompatíveis parametrizados |
| TEMP-02 | Preservar identidade/número/criação e revisar rascunho corretamente | PASSOU | edição, microssegundo, offset e mesmo nome |
| TEMP-03 | Descontinuar preserva eventual rascunho sem fabricar versão | PASSOU | casos com/sem rascunho e descarte indevido |
| TEMP-04 | Resposta incompatível não anuncia sucesso/retry; preservar segurança | PASSOU | TemplateManagement.test.tsx e regressão completa |
| TEMP-05 | Ensaio da correção com backend vivo | NAO_TESTADO | respostas controladas de contrato |

## Testador e revisor

Node24/Windows/Vitest5.1.0, instalação `npm ci` neste worktree.
Antes da correção:22 novos testes de contrato resultaram em15falhas e7aprovações.
Após correção:80 testes direcionados de contrato, gestão e criação passaram.
Regressão completa: **673 testes em33 arquivos aprovados**, sem ignorados;
23 casos novos, incluindo um cenário de fluxo com revisão incompatível.
Lint, typecheck, npm test, build e diff --check passaram; lockfile inalterado,
sem ajuste de timeout, dependências ou remoção de asserções.

Revisão estática sequencial sem achados críticos/altos remanescentes. Parecer
independente PENDENTE. Não é alegação de que o backend vivo tenha retornado
dados incorretos. Risco limitado à confirmação: respostas fora do contrato
exigem conferência antes de nova escrita.

Sem necessidade de validação visual por alteração de markup nesta correção;
quando necessária, solicitar ao usuário ativação da aplicação conforme instruído.
Sem backend vivo, merge/deploy, infraestrutura ou exposição de credenciais.

PODE_CONCLUIR: NAO — issue #4 parcial e aceite humano pendente.
Próxima ação: PR draft, CI do head final e revisão externa.

```yaml
atividade: FE-04-TEMPLATE-CONFIRMATION
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 673
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [backend_vivo_nao_ensaiado, revisao_independente, aceite_humano]
proxima_acao: Conferir CI e revisao do head final
pode_concluir: false
aceite_humano: PENDENTE
```

## Atualização da base — 2026-11-07 UTC

PR #62 / issue #4. Base f72b9fec225c4ca0a41401f2bceb13330b63d6de incorporada
sem conflito; diff funcional permanece limitado à confirmação de templates.
Lint, typecheck, 761 testes/36 arquivos, build e diff --check passaram novamente.
Dependências/lockfile inalterados. Revisão estática sequencial sem críticos/altos;
revisão independente/aceite humano pendentes. CI do novo head registrado no PR.
Validação visual dispensada pelo usuário como requisito dos PRs; registros anteriores
são históricos e não se convertem em PASSOU. Backend vivo não ensaiado.
Sem merge em main, deploy ou alterações de infraestrutura.
