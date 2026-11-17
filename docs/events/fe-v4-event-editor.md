# FE-V4-EVENT-EDITOR — cadastro sem publicação

Issue canônica: frontend #4, vinculada ao mestre backend #64. Decisões v4 do
usuário prevalecem sobre publicação e planejamento anual descritos historicamente
na issue. Branch: codex/v4-event-editor, base release/homolog cef0bcd.
Backend pré-requisito comprovado: PR #168 integrado em 8e6e1cdb1fbe2d95aa52d24896fcc5bfe8dda3c4.
Contrato consumido: event-records-v1 1.0.0; catálogo event-type-catalog-v1 e janela
de inscrição existentes. Nenhum endpoint novo inventado neste frontend.

## Entrega

O acesso principal de Eventos abre `/eventos/igrejas/:churchId/cadastro`.
Lista paginada com nomes, locais e estados; detalhe; criar/editar com público,
nome/local, datas, modalidade e participação. Capacidade e requisitos adicionais
ficam recolhidos. Salvar rascunho e Salvar e disponibilizar enviam um único comando
com audiência. O formulário não oferece publicar, coordenação ou calendário anual.
Referência de apresentação: Stitch v4 01.06 desktop/mobile; adaptações respeitam
os componentes existentes e a capacidade real do backend. Não é cópia integral
do protótipo nem entrega do calendário/recorrência completo.

Datas têm deslocamento UTC escolhido explicitamente; edição inicia em UTC e pode
ser convertida sem mudar o instante. Microssegundos originais são conservados se
o horário não mudar. A consulta exibe UTC explicitamente: o contrato ainda não
fornece fuso/hora do servidor para implementar Hoje/Semana/Mês com segurança.
Não usar o fuso do aparelho silenciosamente como fuso da igreja.

Público exige escolha, sem default público. Restrições existentes, inclusive IDs
de ministérios/departamentos/funções, são conservadas; novas seleções dependem de
catálogos autorizados. A inscrição tem um acesso ao período já integrado, com
retorno ao novo detalhe. Salvar não inscreve, não registra presença nem cria trilha.

## Segurança e compatibilidade

RBAC/CSRF continuam no cliente existente; nenhuma credencial em storage. EVENT_VIEW
para consulta, EVENT_CREATE/EVENT_EDIT para comandos. Catálogo de tipos requer
EVENT_VIEW no backend: criar via API só exige CREATE, mas um operador que tenha
apenas CREATE não consegue selecionar tipos por este catálogo. Não conceder
VIEW implicitamente nem aceitar UUID digitado para contornar esse limite.

Trava de envio sobrevive à reautorização por foco. Falha/resultado ambíguo exige
conferência antes de repetir; resposta é validada em contexto, revisão, dados e
estado, inclusive avanço imediato do ciclo de horário. Revisão concorrente não
substitui campos locais silenciosamente. Sessão/igreja diferentes descartam
dados e cancelam respostas pendentes. O servidor continua autoridade final.

Rotas antigas de ocorrências/subtelas permanecem para compatibilidade com registros
e operações anteriores. O novo acesso não oferece publicação. Este incremento
não afirma remoção global dos endpoints/telas antigos. Séries mantêm tipo/datas;
estados iniciados/finalizados não oferecem edição neste cadastro. Legados DRAFT
com histórico de publicação ainda podem ser recusados pelo servidor, pois o novo
DTO não expõe esse marco; mensagem exige reconciliação, sem simular sucesso.

## Critérios e evidências

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CA-01 | Principal abre lista real com nome/local/estado e paginação | PASSOU | EventAccess / EventRecordPages testes |
| CA-02 | Cria rascunho/disponível, com audiência e CSRF em um POST | PASSOU | EventRecordPages.test.tsx |
| CA-03 | PUT preserva restrições, revisão e precisão do horário | PASSOU | record-api / EventRecordPages testes |
| CA-04 | Permissões, revogação e troca de igreja/sessão | PASSOU | EventRecordPages.test.tsx |
| CA-05 | Falhas/concorrência/envio duplo não causam repetição cega | PASSOU | EventRecordPages.test.tsx |
| CA-06 | Respostas divergentes são rejeitadas e lifecycle é reconhecido | PASSOU | record-api.test.ts |
| CA-07 | Estados finais, vazio/erro e retorno da janela | PASSOU | EventRecordPages / RegistrationWindowPage testes |

Testes são de contrato/cliente/componente com transporte simulado. Não constituem
E2E navegador/backend, aprovação visual humana ou aceite do módulo inteiro.
Execução local inicialmente passou 1504 testes; correções posteriores só de tipos
nos testes e um cenário de retorno da janela são conferidos na validação final/CI.
Logs no workspace pai: output/event_save_v4/frontend-editor-*.log. Consultar PR
para SHA, total final e CI. Revisão independente e aceite humano PENDENTES.

Risco residual: bundle gera aviso de tamanho >500 kB; otimização não é escopo desta
fatia. Sem mudança no backend, merge, deploy ou reinício de aplicações nesta execução.
PODE_CONCLUIR issue #4: NÃO. Próximo passo: revisão do editor e incremento de agenda/
recorrência apenas após fechar contratos pertinentes e conferir integração.
