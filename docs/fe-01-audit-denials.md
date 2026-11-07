# FE-01 — consulta explícita de recusas administrativas

Refs #1. Contrato backend `audit-query-v1.openapi.json` 1.2.0, integrado
em `6b05075` (#98), incluindo a extensão 1.1 (#94). Conferidos controller,
AuditQueryService e appenders tipados de recusa. Não modifica o backend.

O filtro de tipo oferece AUDIT_LOG como “Recusas administrativas de consulta
e gestão”. Só consulta após seleção e aplicação explícita; consulta padrão
mantém os sete tipos de domínio sem esse parâmetro. Paginação preserva filtro,
período UTC e o tenant. Retornar ao padrão limpa o opt-in e volta à página zero.
Rotas contextuais fixam o tipo como nos recursos já existentes, sem UUID digitado.

Cliente aceita AUDIT_LOG somente quando solicitado explicitamente, com outcome
DENIED e as ações publicadas AUDIT_QUERY_DENIED, PROFILE_MANAGEMENT_DENIED e
ASSIGNMENT_MANAGEMENT_DENIED. Resposta incompatível bloqueia a exibição, sem
apresentá-la como vazio. Projeção preserva somente os metadados autorizados,
incluindo resourceId null; descarta metadata, texto livre, razões e dados extras.
Não concede acesso por registrar recusa nem usa gestão de perfis como permissão
de auditoria: security:audit:read/DENOMINATION continua própria e obrigatória.

Aviso explica que a cobertura inclui somente recusas tipadas de consulta e do
gate inicial de gestão central. Não abrange todas as negativas do sistema,
fluxo delegado ou toda revalidação após espera. Ausência de registros não prova
ausência de tentativas. Leitura autorizada continua registrando tentativa no
servidor, sem alegar recibo do cliente. Nenhuma nova escrita, polling ou retry.

Papéis Implementador, Testador e Revisor executados sequencialmente pelo mesmo
agente. Revisão estática confere opt-in, compatibilidade padrão, allowlist de
ação/resultado, escopo, privacidade e preservação de Basic/cookie/CSRF/sessão.
Não representa revisão independente nem aprovação humana.

Validação: npm ci executado nesta sessão e dependências/lockfile preservados;
lint, typecheck, testes, build e diff --check executados. 14 testes novos cobrem
três ações, rejeição sem filtro, pares incompatíveis, projeção, seleção sem
requisição, aplicação/paginação/retorno ao padrão e rota contextual autorizada.
Teste existente de título aguarda o efeito de navegação antes da asserção.

Resultado completo: 664 testes passaram com `npm test -- --maxWorkers=2`.
A primeira execução padrão teve timeout de busca no teste preexistente do
catálogo denominacional (carregamento ainda visível no limite de espera).
Os 24 testes desse arquivo passaram isoladamente; a regressão integral
passou com concorrência reduzida, sem enfraquecer asserções, ignorar casos ou
alterar timeout/configuração do projeto. CI deve confirmar a execução padrão.

Ressalvas: fixtures/jsdom, sem backend vivo, teclado/AT ou ensaio visual.
Browser Use permanece bloqueado por permissão salva/política da origem após
tentativa autorizada; nenhum contorno ou captura. Sem homologação visual,
merge/deploy, mudanças de infraestrutura ou armazenamento de credenciais.
