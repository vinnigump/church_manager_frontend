# Continuidade diante de bloqueios locais

Issue canônica frontend #1, Governança / FE-01, prioridade não definida.
Solicitação expressa do usuário em08/11/2026: procurar outra atividade disponível
quando uma demanda estiver bloqueada e registrar essa regra.
Branch codex/governance-independent-work; baseacc650b. SHA/CI finais no PR.
Responsável: agente em etapas sequenciais de edição/verificação/revisão estática;
revisão independente e aceite humano PENDENTES.

## Entrega

A meta existente já exige continuar demandas independentes. O AGENTS.md ainda
continha a frase contraditória "Não iniciar o próximo incremento automaticamente".
Substituída por orientação explícita de continuidade: conferir PRs/regras antes
de cada atividade, registrar bloqueio local e procurar trabalho independente no
backlog inteiro antes de declarar bloqueio global. Não autoriza merge/deploy,
uso de API pendente como integrada ou invenção de requisitos/defeitos.

Governança exige fontes atuais por dependência, incluindo código e entregas já
existentes; status/títulos de issues não comprovam por si sós disponibilidade.
Registra também as orientações atuais: visual não bloqueia PR; Run local apenas
por necessidade concreta. Relatórios históricos continuam históricos.

## Verificação

Mudança exclusivamente documental; git diff --check passou. Revisão textual
conferiu consistência com as instruções atuais e preservação de branch/PR,
revisão humana e proibições de merge/deploy. Não executados testes de aplicação
localmente: código, contratos e dependências não foram alterados. CI do PR será
acompanhado, sem atribuir testes históricos a esta atividade.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CONT-01 | Remover contradição e exigir procura de trabalho independente | PASSOU | AGENTS.md/Continuidade e bloqueios |
| CONT-02 | Diferenciar bloqueio local/global com evidência atual | PASSOU | development-reporting.md/Bloqueio de demanda |
| CONT-03 | Preservar limites e orientações atuais de validação | PASSOU | sem merge/deploy; visual dispensado; Run local por necessidade |

Revisão estática sequencial sem achados críticos/altos no texto. Revisão
independente/aceite PENDENTES. Próxima ação: publicar PR draft, conferir CI e
continuar triagem do backlog. Não representa entrega de API ausente ou conclusão
formal de toda issue1.

```yaml
atividade: FE-01-INDEPENDENT-WORK
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 3
criterios_comprovados: 3
testes_aprovados: 0
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI e continuar triagem do backlog
pode_concluir: false
aceite_humano: PENDENTE
```
