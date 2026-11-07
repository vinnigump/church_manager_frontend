# UI-RIO-07 / #5 — apresentação isolada de inscrições

Fatia aprovada de #5, independente do shell #29: depende da identidade #28 já
integrada. Executada sob a ordem atual de desenvolver backlog aprovado. Referência
rio-participacao.html em origin/codex/ui-rio-planejamento-v1, commit
8ddfd6b080914530a6bc226f56007d721cfdd01f, explicitamente aprovado na issue #5.
O arquivo de referência está nessa branch documental, não na principal histórica.

RegistrationOverview recebe cartão com tokens RIO/raio17, contexto, capacidade em
dl e avisos com hierarquia visual de confirmação/espera/erro/conflito. Rótulos e
textos existentes continuam explícitos: cor não determina estado. Desconhecido
não vira ilimitado; fila não confirma vaga; inscrição não comprova presença/trilha.
CSS próprio com seletores de inscrição, min-width:0/quebra de texto e capacidade
flexível. Tons de atenção #77510b/#fff4dc vêm da referência aprovada. Especificidade
local preserva o tom de conflito sem ser substituído pelo estilo global de alert.

Sem mudança de modelos, validações ou regras. OPEN_EVENT mantém ausência de resumo
nominal/capacidade/fila. Mudança de igreja/ocorrência ou estado indisponível remove
snapshot anterior. Exemplos sintéticos ficam nos testes e na prévia documental
explicitamente identificada. Não há import
de RegistrationViews nas rotas de produção, endpoint, storage, botão de inscrição,
promoção, QR, documento, presença ou promessa de integração. ParticipationNotices
permanece na fatia própria #6; nenhuma alteração nesse componente.

Implementador/Testador/Revisor executados sequencialmente pelo mesmo agente.
Revisão estática e testes existentes cobrem estados, posição inválida, capacidade
inconsistente, contexto, dados privados e ausência de rede/storage/ações. Não foram
criados testes que apenas espelham CSS; não houve alteração de comportamento.
Lint/typecheck/566 testes/build/diff --check passaram antes da atualização de base.
Após integração externa de #48, base96e9558: lint/typecheck/573 testes/build/
diff --check passaram. Build adicional da entrada RegistrationViews com Vite,
write:false, validou compilação do JS/CSS isolado sem montá-lo ou alterar dist.
A saída JS/CSS foi inspecionada com sucesso. Não é render.
O componente não é importado pelas rotas do aplicativo. npm ci nesta sessão,
lockfile intacto.

Após pedido da revisão externa, preparada prévia documental do componente real
em docs/design/ui-rio-07/registration-preview.html, com entrada exclusiva
src/previews/RegistrationPreview.tsx. Declarada como dados sintéticos, sem API/vagas/
inscrições reais. Select controla somente demonstração de confirmação, espera,
cancelamento, capacidade desconhecida/inconsistente, textos longos, evento aberto,
loading/erro/conflito/indisponível. Não é rota nem entrada do build de produção.
Permite homologação humana em ambiente autorizado; não foi aberta nesta sessão e
não atende por si só ao pedido de capturas/matriz/zoom da revisão.
Base b8096d5 após #49: lint/typecheck/578 testes/build/diff --check passaram; build
isolado write:false da prévia validou também seus imports/CSS. Busca de imports e
marcador no bundle principal confirmou que não entrou no aplicativo de produção.

Contraste calculado a partir das cores sRGB, sem captura: atenção6,48; confirmação
6,90; texto auxiliar sobre branco4,92; erro sobre branco7,86. Esses números cobrem
apenas combinações declaradas e não equivalem a homologação visual/AT.

Browser Use continua bloqueado por permissão salva/política da origem local mesmo
após autorização explícita de nova tentativa. Sem contorno. Não houve renderização,
matriz de larguras, zoom200%, teclado real ou captura destes cartões. Homologação
visual e revisão humana pendentes; entrega parcial de apresentação em PR draft.
Contratos de inscrição operacional continuam ausentes, sem integrar produção por
conveniência visual. Sem merge/deploy/infraestrutura; alterações locais preservadas.
