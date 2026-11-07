# Governança de execução e prestação de contas

Este padrão complementa `AGENTS.md` e as instruções dos agentes; não altera a política de aprovação humana para merge/deploy.

## Fonte de verdade e estados
A issue canônica define escopo e critérios de aceite. O PR documenta incrementos; o CI comprova execução de testes; a revisão valida riscos. **PR merged não implica issue concluída.**

Estados mutuamente exclusivos: `NAO_INICIADA`, `EM_DESENVOLVIMENTO`, `BLOQUEADA`, `EM_TESTES`, `EM_REVISAO`, `PRONTA_PARA_ACEITE`, `CONCLUIDA`, `CANCELADA`. Uma issue só é `CONCLUIDA` após todos os critérios comprovados, aprovação humana quando aplicável, integração autorizada e registro do aceite. `CANCELADA` exige justificativa e não conta como entrega.

## Relatório obrigatório por atividade
- **Identificação:** issue canônica, módulo, épico, prioridade, responsável, branch, PR(s), SHA, data UTC.
- **Escopo:** o que foi implementado, o que não foi, mudanças de escopo aprovadas.
- **Critérios:** tabela `ID | descrição | PASSOU/FALHOU/NAO_TESTADO | evidência verificável (teste, log, endpoint, commit)`. Não inferir PASSOU por existir código.
- **Testes:** comandos realmente executados, ambiente, aprovados/falhos/ignorados, run de CI e SHA; declarar testes não executados e motivos.
- **Revisão:** `APROVADO/APROVADO_COM_RESSALVAS/REPROVADO/PENDENTE`, achados CRITICO/ALTO/MEDIO/BAIXO, riscos remanescentes.
- **Dependências:** bloqueio, responsável, ação concreta e issue vinculada.
- **Decisão:** `PODE_CONCLUIR: SIM/NAO`, justificativa e aceite humano quando requerido.

## Resumo legível por máquina (preencher sem inventar)
```yaml
atividade: EVT-XXX
issue: https://github.com/OWNER/REPO/issues/NUMBER
status: EM_DESENVOLVIMENTO
criterios_total: 0
criterios_comprovados: 0
testes_aprovados: 0
testes_falhos: 0
testes_ignorados: 0
ci: NAO_EXECUTADO
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: []
proxima_acao: "Descrever ação concreta"
pode_concluir: false
aceite_humano: PENDENTE
```

## Papéis e atualização
1. **Implementador:** atualiza escopo, critérios que acredita atender, PR e pendências; não se autoaprova.
2. **Testador:** confirma ou rejeita cada critério com testes reproduzíveis, evidências e SHA.
3. **Revisor:** confere diff, critérios, segurança, riscos e parecer independente.
4. **Coordenador:** reconcilia issue/PR/CI, aponta divergências e atualiza painel; não inventa evidências nem concede aceite.
5. **Humano:** aprova o aceite e merge conforme fluxo vigente.

Atualizar o resumo na issue a cada handoff e no encerramento do PR. Se houver vários PRs, vincular todos à mesma issue, sem duplicar atividade.

## Métricas
- `conclusao_formal = issues CONCLUIDAS / issues canonicas validas` (excluir canceladas e duplicatas, mostrar denominador).
- `cobertura_implementacao = issues com PR relevante / issues canonicas validas` (não é conclusão).
- `criterios_comprovados = soma CA PASSOU / soma CA definidos` (apenas quando auditados).
- Mostrar por módulo e épico: não iniciadas, em desenvolvimento, testes, revisão, bloqueadas, prontas para aceite, concluídas.
- Nunca transformar quantidade de PRs ou testes em porcentagem de produto pronto.

## Segurança e operação
Não publicar segredos, dados pessoais, logs sensíveis ou artefatos de produção. Não fazer merge/deploy nem encerrar issues automaticamente sem autorização humana explícita. Se CI/ambiente estiver indisponível, registrar `NAO_EXECUTADO` e bloqueio.
