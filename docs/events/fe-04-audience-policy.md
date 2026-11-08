# FE-04 — política administrativa de audiência

Issue canônica frontend #4(parcial), Eventos/FE-04; backend EVT-011/#31.
Prioridade frontend não definida. Data2026-11-08UTC.
Branch codex/fe-04-audience-policy; basecbb2836 (PRs86/87 integrados externamente).
Responsável: agente em etapas sequenciais; revisão independente/aceite PENDENTES.
SHA/CI finais no PR. Backend120 integradof46a7adf2b9a6688463588fd2b2ea7f726c64d13
antes do código; inspecionados event-audience-v1 1.0.0 e Controller/Models/Service.

## Implementação

Rota /eventos/igrejas/:church/ocorrencias/:id/audiencia, entrada no detalhe
autorizado. EVENT_VIEW protege consulta; EVENT_EDIT próprio protege configuração.
EVENT_PUBLISH não concede edição. Não restringe a rascunhos, pois o contrato
permite política após publicação preservando inscrições/campos operacionais.

GET ausência=200/configuredfalse/policynull preservado; nenhum default PUBLIC.
PUT substitui política completa: visibilidade PUBLIC/CHURCH/ELIGIBLE_AUDIENCE,
flags explícitas, idades inclusivas opcionais e conjuntos de referências.
Valida contexto/IDs/revisão/booleans, limites inteiros não negativos/máximo>=mínimo,
até100 UUIDs únicos por categoria, canonizados/ordenados para igualdade de sets.
Campos extras/fatos pessoais não são propagados. Idades opcionais omitidas no DTO
normalizadas para null. Não calcula idade/eligibilidade ou coleta nascimento.

Confirmação mostra política completa e revisão compartilhada da ocorrência.
Cliente envia somente configuração com CSRF e X-Expected-Revision; confirma
resposta exata configurada, revisão+1 ou no-op com revisão igual, independente
da ordem dos conjuntos. Relê após sucesso. Configuração não publica ocorrência/
calendário nem abre inscrição; modalidade/modo/check-in e inscritos não são enviados.

Antes/revisão originais e campos ficam acima das guardas. Foco conserva rascunho,
descarta confirmação e reautoriza/relê; revisão nova exige descarte/releitura sem
rebase silencioso. Trava impede duplo envio/replay após tentativa, inclusive erro
ou foco. Resultado incerto exige conferir dados antes de nova intenção. Contexto
conta/igreja/ocorrência aborta/ignora resposta antiga sem prometer rollback.
Sem storage, logs sensíveis, novo endpoint ou fatos de pessoa fornecidos pelo cliente.

## Limite específico de seleção

Política autorizada fornece as referências existentes. UI permite manter/remover
explicitamente cada uma, com resumo completo antes de salvar. Não preenche nomes
ou referências ausentes, não apaga categorias silenciosamente e permite resolver
referência que servidor passou a recusar. Uma categoria vazia permanece sem
seleção restritiva naquela categoria; demais exigências continuam explícitas.

Incluir novas funções/ministérios/departamentos exige catálogo de opções autorizado,
ainda não publicado para este fluxo. Organization global técnico não é diretório
da secretaria; não introduz UUID digitado, nome inventado ou permissão inferida.
Essa parte continua pendente, sem declarar toda audiência ou issue4 concluída.
Visibilidade é configuração do fator, não projeção pública ou autorização completa
de inscrição; AND entre categorias/OR dentro das seleções é aplicado no servidor.

## Testador

Node24.22.1/Windows: npm ci/lint/typecheck/test/build/diff --check passaram.
1274 testes/49 arquivos,50 novos. Primeira rodada direcionada46/46 passou;
regressão final inclui quatro casos adicionais. Zero falhas/ignorados finais;
dependências/lockfile preservados. Não houve backend vivo nesta atividade.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| AUD-F01 | Ausência sem default, três visibilidades e flags/idades explícitas | PASSOU | nulos, flags ausentes, limites/100–101/duplicados e UI |
| AUD-F02 | Referências preservadas/removidas explicitamente | PASSOU | corpo mínimo, checkbox e igualdade de sets/no-op |
| AUD-F03 | Permissões/CSRF/revisão e edição após publicação | PASSOU | VIEW/EDIT/PUBLISH, detalhe publicado e resposta estrita |
| AUD-F04 | Foco/erro/contexto sem replay/falso sucesso | PASSOU | revisão nova, dupla confirmação, HTTP403/409/422/500, aborto e resposta incerta |
| AUD-F05 | Backend vivo/inscritos/escopo de referências reais | NAO_TESTADO | fixtures/jsdom e serviço inspecionado, sem ensaio vivo |

Visual dispensado como requisito; Run local somente por necessidade concreta,
não solicitado por rotina. Revisão estática sequencial sem críticos/altos
identificados; revisão independente/aceite PENDENTES. Limite: novos seletores
aguardam catálogo, sem impedir configuração suportada. Sem merge/deploy/infraestrutura.
Próxima ação: conferir CI/revisão e selecionar demanda independente disponível.
PODE_CONCLUIR issue4: NÃO, escopo parcial e dependências explícitas.

```yaml
atividade: FE-04-AUDIENCE-POLICY
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1274
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao e selecionar demanda independente disponivel
pode_concluir: false
aceite_humano: PENDENTE
```
