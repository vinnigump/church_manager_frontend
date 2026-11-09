# Onda 1 - UI-RIO-04 D1/D2/D4

Issue canônica #31; relacionada #4/#34. Eventos/UI-RIO, P1. Codex, 2026-11-08 UTC.
Branch `codex/wave1-template-presentation`; base a58e2a8. SHA/PR/CI finais no PR.
Prontidão da fatia READY; issue integral PARTIAL. Implementação da fatia VALIDATED
tecnicamente, aceite visual manual ao término da Onda 1 e revisão externa pendentes.

## Fontes e diferenças comprovadas

AGENTS, README, papéis, governança e Onda 0 consultados. Issues FE01..06/UI01..08,
backend64 CF/AP e comentários31 reconsultados. Referência aprovada D4 versionada
em `rio-v1/rio-template-lifecycle.html`, cópia binária idêntica ao arquivo informado:
SHA256 a5c47da124a63034d99b078480797cf5336a3e252c9bdf2c134ba82e6993ec0e.
Referência é demonstração documental, não nova rota ou máquina de estados.

| Item | Antes observado no código | Correção limitada |
| --- | --- | --- |
| D1 | CSS global primário em atualizar/paginar/cancelar; sem variante secundária aplicada | Variante explícita secundária no catálogo, template e calendário; atenção textual na descontinuação |
| D2 | Referência publicada somente nos itens da página de histórico | Identificação/estado/referência ID acima do rascunho; histórico continua paginado |
| D4 | Descontinuação dentro do mesmo gerenciador da edição, antes do histórico | Região de disponibilidade após histórico, confirmação junto da ação, efeito irreversível textual |
| Acessibilidade | Cancelar removia confirmação sem devolver foco | Foco retorna ao botão acionador sem escrita ou perda da edição |

Nome primeiro nos cartões, origem/obrigatoriedade, estados separados, nome de
versão e UTC já existiam: preservados. O DTO raiz de template não oferece nome
publicado; identificação usa ID real e não inventa nome a partir de rascunho ou
versão fora da página. Nomes/números reais permanecem no rascunho/histórico.

## Contratos e segurança

`event-template-version-v1`1.0.1, catálogo1.0.1 e calendário1.0.0 no backend
efc5990003534c72b7a2b55db100e08edbdf7a23. Sem alteração de API/DTO/permissões.
EVENT_TEMPLATE_MANAGE/DENOMINATION, ResourceAccess, cliente Basic/CSRF, revisões,
dirty/stale, trava compartilhada de mutação e isolamento preservados. Duas
seções usam o mesmo controle de mutação, não duas escritas independentes.
Descontinuado não oferece edição/publicação/reativação; nenhuma cascata criada.

## Testador

Windows/Node24.22.1: npm ci/lint/typecheck/test/build PASSARAM.1282 testes/50
arquivos,0 falhos/ignorados,8 novos em TemplatePresentation.test.tsx. Rodada
direcionada prévia133/4 passou antes dos oito testes adicionais.
Novos testes verificam regiões nomeadas e ordem DOM, referência fora da página
de histórico, nomes180, estados draft/publicado sem/com rascunho/descontinuado,
cancelamento sem escrita com foco e edição preservada, revogação oculta dados.
Regressão existente cobre CAS/CSRF/concorrência/negação/publicação/descontinuação.
Instalação mantém7 alertas moderados preexistentes de ferramentas; sem mudanças
de dependências ou correção forçada fora de escopo.

| Critério | Resultado | Evidência |
| --- | --- | --- |
| T01 hierarquia explícita de ações | PASSOU | controles secundários/atenção; efeitos descritos textualmente |
| T02 identificação/referência independente do histórico | PASSOU | teste com histórico vazio e referência autorizada |
| T03 disponibilidade separada e estados reais | PASSOU | ordem DOM e estados, regressão de comandos |
| T04 cancelar preserva edição/foco, sem escrita | PASSOU | dois casos publicação/descontinuação |
| T05 autorização/concorrência/CSRF preservados | PASSOU | suíte existente + revogação nova |
| T06 regressão técnica | PASSOU | lint/typecheck/1282 testes/build |
| T07 geometria/zoom/dispositivos e aceite visual | NAO_TESTADO | homologação manual do produto ao final da onda |

Flex com wrap e coluna mobile também nas ações fora de form, larguras limitadas,
quebra de texto e foco existentes preservados. Testes DOM não comprovam geometria
renderizada; nenhuma captura/validação visual intermediária foi solicitada.

## Revisor

Revisão técnica sequencial do mesmo agente, sem achados críticos/altos no escopo;
não é aprovação independente/humana. Sem merge/deploy, Run local automático,
inscrição/fila/check-in ou consumo do backend122 pendente. PODE_CONCLUIR31: NAO.
Próxima ação: revisão externa e validação manual final, sem impedir outra entrega
independente da Onda 1. Não iniciar Onda 2.

```yaml
atividade: W1-UI-RIO-04-D1-D2-D4
issue: https://github.com/vinnigump/church_manager_frontend/issues/31
status: EM_REVISAO
criterios_total: 7
criterios_comprovados: 6
testes_aprovados: 1282
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: []
proxima_acao: "Revisão externa; validação visual manual ao final da Onda 1"
pode_concluir: false
aceite_humano: PENDENTE
```
