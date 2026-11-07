# UI-RIO-04 / #31 — apresentação administrativa de Eventos

Fatia aprovada de #31, sob objetivo atual de desenvolver backlog aprovado. Base
02617b1: identidade/shell/acesso integrados. Referência rio-eventos-admin.html em
origin/codex/ui-rio-planejamento-v1, commit8ddfd6b080914530a6bc226f56007d721cfdd01f.
Revalidados contratos event-type-catalog-v1, event-template-version-v1 e
event-calendar-v1 integrados (1.0.0); nenhuma alteração de API neste incremento.

Telas: catálogo da igreja, catálogo denominacional, versões/gestão de template e
planejamento anual administrativo. Wrapper event-admin e stylesheet próprio
limitam o efeito visual a essas telas: títulos, cartões/formulários, origem,
obrigatoriedade, estados textuais, histórico em coluna, mensagens, confirmação e
paginação. Tokens RIO/raio17 preservados. Estado descontinuado/desabilitado usa
atenção sem depender somente de cor. Campos e botões mantêm os mesmos rótulos.

Grid/listas flexíveis, min-width:0, quebra de texto, botões mobile flexíveis e
formulários que usam a largura disponível. Foco global e tamanhos mínimos existentes
preservados. Não são introduzidos selects/busca/categorias do protótipo que não
tenham contrato. Sem imagens fictícias, KPIs, nova navegação ou novos dados.

Sem alteração de permissões, fluxos, payloads, contexto, revisão lógica/ETag, CSRF,
bloqueio de repetição, confirmação ou tratamento de erro. A igreja não ganha ação
sobre template obrigatório. Estado e datas vêm dos mesmos DTOs, com UTC explícito;
publicar planejamento continua independente de publicar ocorrência/abrir inscrição.
Recurso de cópia anual, agenda pública e integração de novas telas não são inferidos
da composição. O CRUD de ocorrências do backend #96 já foi integrado e fica para
incremento funcional separado de #4; não é declarado inexistente nesta base.

Implementador/Testador/Revisor sequenciais pelo mesmo agente. Revisão conferiu
diff de apresentação, ausência de mudanças nos clientes/hooks e preservação de
campos/controles. Suite existente cobre autorização, contexto, estados, paginação,
criação, lifecycle, concorrência/reconciliação e calendário. Lint/typecheck/580
testes/build/diff --check passaram. npm ci nesta sessão, lockfile intacto; não
foram adicionados testes que somente espelham CSS.
Após integração externa de #53, rebase em c6f11cf preservou Home pública/login,
navegação somente autenticada, saída e demais rotas. Lint/typecheck/588 testes/
build/diff --check passaram. Pedido da revisão externa de evidências visuais
permanece não atendido pelo bloqueio de ambiente descrito abaixo.

Homologação visual pendente: Browser Use negou origem por permissão salva/política
mesmo após usuário autorizar nova tentativa. Nenhum contorno realizado. Para
validação humana em ambiente autorizado, usar rotas contextuais reais já existentes
com sessão/permissão adequadas; conferir catálogo vazio/erro/negação, textos longos,
histórico, forms/busy, confirmação/cancelamento e conflito, matriz320–1440 e zoom200%.
Nenhuma captura/medição/ensaio de teclado real ou AT foi produzida por este agente.
Testes com respostas controladas não são teste de backend vivo nem prova de layout.
Não declara DoD visual concluído. Sem merge/deploy/infraestrutura; arquivos locais
do usuário preservados.
