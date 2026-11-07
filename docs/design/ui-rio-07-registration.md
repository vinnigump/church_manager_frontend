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
snapshot anterior. Exemplos sintéticos continuam somente nos testes. Não há import
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
O primeiro resumo do retorno desse build tratou array como objeto; corrigido o
script de verificação, a saída JS/CSS foi inspecionada com sucesso. Não é render.
Busca dos imports confirmou que a única referência fora dos testes é a definição
do componente. npm ci nesta sessão, lockfile intacto.

Contraste calculado a partir das cores sRGB, sem captura: atenção6,48; confirmação
6,90; texto auxiliar sobre branco4,92; erro sobre branco7,86. Esses números cobrem
apenas combinações declaradas e não equivalem a homologação visual/AT.

Browser Use continua bloqueado por permissão salva/política da origem local mesmo
após autorização explícita de nova tentativa. Sem contorno. Não houve renderização,
matriz de larguras, zoom200%, teclado real ou captura destes cartões. Homologação
visual e revisão humana pendentes; entrega parcial de apresentação em PR draft.
Contratos de inscrição operacional continuam ausentes, sem integrar produção por
conveniência visual. Sem merge/deploy/infraestrutura; alterações locais preservadas.
