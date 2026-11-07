# UI-RIO — pacote de design v1

## UI-RIO — Registro autorizado em 07/11/2026

Pacote de design preparado e registrado; não autoriza despacho de implementação nem aprova indistintamente todas as telas.

| Demanda / módulo | Requisito | Issue | Status | Dependências / riscos | Próxima ação |
|---|---|---|---|---|---|
| UI-RIO-01 Identidade e logo | FE-01 | vinnigump/church_manager_frontend#28 | READY técnico | Aprovação de tokens/marca; estilos globais | Aprovar revisão visual |
| UI-RIO-02 Desktop/mobile | FE-01 | vinnigump/church_manager_frontend#29 | READY técnico | #28; destinos restritos e teclado mobile | Aprovar shell |
| UI-RIO-03 Login/conta | FE-01 | vinnigump/church_manager_frontend#30 | READY técnico | #28/#29; sessão/retorno | Revisar design específico |
| UI-RIO-04 Eventos integrados | FE-04 / EVT-005/006/007 | vinnigump/church_manager_frontend#31 | PARTIAL | #28/#29; APIs e publicação independente | Liberar por tela e contrato |
| UI-RIO-05 Painel | MASTER/RPT | vinnigump/church_manager_frontend#32 | BLOCKED | Backend #71; KPIs e escopo indefinidos | Refinar cálculo/contrato |
| UI-RIO-06 Cadastro | FE-02/ID/MEM | vinnigump/church_manager_frontend#33 | BLOCKED | Backend #15/#66/#72; pessoa não é membro | Refinar fluxo e permissão |
| UI-RIO-07 Participação | FE-05/06 | vinnigump/church_manager_frontend#5 e vinnigump/church_manager_frontend#6 atualizadas | PARTIAL | Contratos EVT-013..026; inscrição não é presença | Aprovar fatias de apresentação |
| UI-RIO-08 Homologação | FE-01/04 | vinnigump/church_manager_frontend#34 | READY técnico | Incremento visual aprovado | Validar cada PR |

Agentes previstos em todas as entregas executáveis: Implementador → Testador → Revisor → aprovação humana. Sem despacho nesta rodada.

Ordem: #28 → #29 → #30 → fatias liberadas de #31; #34 acompanha todas as entregas. #32/#33 não são encaminhadas ao implementador. UI-RIO-07 foi incorporada às issues #5/#6, sem duplicação funcional.

Cada issue inclui critérios verificáveis de responsividade, acessibilidade, privacidade, concorrência aplicável, CI e PR draft. Referências desktop/mobile com logo original em branch de documentação: https://github.com/vinnigump/church_manager_frontend/tree/codex/ui-rio-planejamento-v1/docs/design/rio-v1 . Dados dos protótipos são fictícios; tema escuro e novas regras funcionais não foram aprovados.

Lacunas funcionais: definição dos indicadores e contrato do painel; cadastro de pessoa versus vínculo/ativação de membro; novas consultas/agenda de ocorrências além das telas integradas. Nenhuma nova demanda backend de implementação foi criada para contornar essas lacunas.


## Aprovações

O usuário autorizou o registro do pacote (“aprovado prossiga”), após apresentação do planejamento. Aprovação visual e autorização de execução permanecem por tela/fatia. Requisito mobile e logo original solicitados expressamente; raio 17 px é preferência registrada.

## Referências

- [Desktop](rio-prototipo.html)
- [Mobile](rio-mobile.html)

Fragmentos ilustrativos mantidos fora de src e dist, sem integração ao aplicativo. Não executar como base de autenticação ou regra de negócio. O logo PNG original do projeto Dia de Serviço está incorporado. As referências incluem JavaScript de interação local e dependências do ambiente de visualização; não são aplicações publicadas. A apresentação mobile não prova comportamento de barra fixa, teclado virtual ou safe-area.

## Verificação desta rodada

Busca de issues e PRs do frontend, incluindo estados abertos/fechados, sem demanda equivalente de redesign identificada. Corpos e comentários recentes reconsultados. Sete issues criadas; UI-RIO-07 detalhada nas duas issues funcionais existentes. Apenas documentação e backlog alterados. Testes de aplicação e CI não executados como evidência de design; o PR desta branch é documental e não encerra as demandas.
