# UI-RIO — Registro consolidado das aprovações visuais

Data: 07/11/2026. Registro de design, sem despacho de implementação, merge ou deploy.

## Aprovações expressas

| Demanda | Aprovação | Referência | Limite |
|---|---|---|---|
| UI-RIO-01 / #28 — identidade | “Sim” à validação da identidade e menus | rio-prototipo.html / rio-mobile.html | Logo original RIO, paleta e tipografia apresentadas, cartões 17 px, hierarquia e dimensionamento |
| UI-RIO-02 / #29 — navegação | Mesma validação | rio-prototipo.html / rio-mobile.html | Menu lateral desktop e inferior mobile; somente destinos reais autorizados |
| UI-RIO-03 / #30 — acesso | “aprovado prossiga” à validação de Login/Minha conta | rio-acesso.html | Composições desktop/mobile, campos, visibilidade da senha, mensagens, acesso e saída; contratos existentes |
| UI-RIO-04 / #31 — Eventos | “aprovado” à validação de Eventos | rio-eventos-admin.html | Catálogos da igreja/denominação, detalhe com rascunho/histórico e planejamento anual, estados/controles exibidos |
| UI-RIO-07 / #5 e #6 — participação | “aprovado” à validação dos resumos e avisos | rio-participacao.html | Inscrição/capacidade/espera e autorização/presença separadas, cenários exibidos desktop/mobile |

Cada referência está nesta pasta. As aprovações estão registradas nos corpos e comentários das issues correspondentes e no backlog mestre vinnigump/church_manager#64. Os protótipos são demonstrações com dados fictícios; não são código integrado, homologação de dispositivo ou comprovação de contrato.

## Escopo que continua pendente

- UI-RIO-05 / #32: painel e indicadores BLOCKED por regras de cálculo, escopo e contratos. Não usar os KPIs fictícios do protótipo em produção.
- UI-RIO-06 / #33: cadastro e membresia BLOCKED por definição de operação, perfil/permissão, campos e fluxo. Pessoa, membro e conta continuam distintos.
- UI-RIO-04 / #31: prontidão integral PARTIAL; composições e comandos não mostrados, como descontinuação e demais estados do ciclo de template, não são cobertos por esta aprovação. Agenda de ocorrências não foi aprovada nesta rodada.
- UI-RIO-07 / #5/#6: prontidão integral PARTIAL; aprovação de apresentação não libera integrações de inscrições, espera, autorizações ou presença ausentes dos contratos entregues.
- Fixação/aderência da barra mobile, teclado virtual, safe-area, leitor de tela e dispositivos reais ainda exigem validação técnica; a aprovação da composição não comprova esses testes.
- Tema escuro não foi aprovado como requisito de implementação.

## Ordem para os executores

1. #28: identidade/logo/tokens.
2. #29: shell e navegação responsiva sobre destinos reais.
3. #30: Login e Minha conta com autenticação existente.
4. #31: selecionar somente fatias com código/contrato disponíveis e design apresentado aprovado.
5. #5/#6: somente apresentação aprovada de componentes existentes; integração depende das demandas funcionais e contratos.
6. #34 acompanha cada incremento: validação desktop/mobile, acessibilidade, estados, regressão de autorização e parecer.

Antes de executar cada tarefa: reconsultar issue/comentários e AGENTS.md, confirmar base/branch, contratos e autorização de execução. Implementador → Testador → Revisor → aprovação humana. Não recriar RBAC, autenticação ou regras de negócio. Abrir PR draft e executar checks proporcionais, CI e homologação exigidos pelas issues. Não avançar automaticamente para tarefa seguinte. As questões funcionais bloqueadas permanecem fora da fila de implementação.

## Estado desta rodada

A validação das propostas visuais apresentadas foi concluída. Não houve implementação de src, testes de aplicação ou homologação real nesta rodada. A autorização anterior cobriu registro do pacote e revisão dos designs, não despacho de executores. O PR #35 organiza referências e documentação; não encerra as issues de implementação.
