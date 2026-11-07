# FE-01 — consulta estruturada de auditoria

Contrato audit-query-v1 1.0.0 em backend origin/master 8ff1f10, AuditQueryController,
AuthenticatedAuditQueryService, AuditQuery/AuditQueryService e SecurityConfiguration
conferidos. GET /security/denominations/{denominationId}/audit exige
security:audit:read/DENOMINATION, código técnico security-2 não delegável.
Gestão de perfis/atribuições não substitui essa permissão; servidor resolve ator.

Rota autenticada /seguranca/denominacoes/:denominationId/auditoria, mais variante
/:resourceType/:resourceId. Catálogo denominacional oferece acesso condicionado à
permissão específica. Detalhes de perfil, atribuição e fonte oferecem links
contextuais também condicionados; IDs vêm de DTOs validados, sem formulário de UUID.
As rotas contextuais validam tipo/identidade antes da rede e mantêm recurso fixo.

Filtros por tipo e período UTC são aplicados explicitamente e reiniciam a página.
Início inclusivo e fim exclusivo; fim deve ser posterior ao início. Campos vazios
omitem filtro. UI aceita horário UTC com precisão de segundos; API preserva nanos
nas comparações para não arredondar limites submilissegundo do contrato Java.
Tipo/ID/intervalo recebidos são conferidos quando há filtro. Sem filtro por ator,
exportação, mensagens brutas ou recuperação de metadata/legado livre.

DTO contém somente ID/instante/ator/ação/tipo/ID de recurso nullable/outcome. Valida
UUIDs, datas, enum de tipo/outcome, paginação/revisão de página, duplicatas e projeta
campos conhecidos. Códigos de ação são textos do contrato, sem reproduzir política
de allowlist no cliente; servidor exclui pares tipo/ação não publicados.

Lista paginada, loading/erro/vazio, atualização e retorno de página vazia. Falha
de autorização ou de registro de tentativa de leitura não vira lista vazia. Guarda
reconsulta foco/contexto/sessão e descarta contexto anterior; cliente usa no-store.
Backend registra tentativa autorizada, inclusive consulta vazia, antes de liberar
DTO. Tela não afirma que esse registro prove recebimento pelo usuário. Não grava
auditoria no frontend nem usa leitura para fabricar gestão ou bootstrap.

Papéis Implementador/Testador/Revisor sequenciais pelo mesmo agente. Revisão
conferiu permissão separada, filtros, privacidade, projeção e ausência de políticas
inventadas. Lint/typecheck/546 testes (18 novos sobre base 528)/build/diff --check
passaram. npm ci nesta sessão, lockfile intacto. Testes com respostas controladas;
Após integração externa de #44, rebase em 1675e04 preservou consultas por fonte,
revogações e identidade RIO. Lint/typecheck/558 testes/build/diff --check passaram.
Registro de rotas separado em linhas para facilitar revisão e conciliações.
backend vivo e ensaio visual/AT pendentes. Browser Use recusou origem local, sem
contorno. Identidade RIO integrada preservada, sem homologação das novas telas.
Sem merge/deploy/infraestrutura, resumos locais não rastreados preservados.
