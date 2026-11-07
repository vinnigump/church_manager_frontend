# FE-01 — consultas administrativas de segurança

## Implementador

Issue #1. Branch codex/fe-01-security-read, base main 36a55bb após merge externo do
PR #27. Antes de iniciar: PR #27 merged, revisão favorável lida e CI 42378414394
confirmada success. Resumos locais não rastreados preservados.

Lidos AGENTS, README, papéis, execução Eventos, contexto atualizado, backlog frontend
aberto e comentários da #1 (sem novos). Backend origin/master c4616d7: contratos
permission-catalog-v1 1.0.0 e profile-read-v1 1.2.0, guia security-admin.md,
PermissionCatalogController/Service, ProfileReadController/Service, AccessRole,
ProfileModels e SecurityConfiguration. Fontes lidas diretamente da referência
integrada, sem depender de checkout/backend em branch de trabalho.

GETs sob /api/v1/security/denominations/{denominationId}:
permission-catalog, profiles?page&size, profiles/{profileId},
profiles/{profileId}/versions?page&size e /versions/{versionId}.

Novas rotas contextuais /seguranca/denominacoes/:denominationId/permissoes,
/perfis, /perfis/:profileId e /perfis/:profileId/versoes/:versionId.
ResourceAccess exige security:profile:manage no recurso DENOMINATION antes dos
GETs; backend reautoriza cada leitura. Não usa concessões globais, vínculo pessoal,
status/login ou permissão de Eventos como substituto. Link vindo do catálogo de
Eventos exige decisão administrativa separada. /admin técnico continua negado.
Sem seleção fictícia de contextos ou formulário de UUID.

Lista/histórico paginados, detalhe de snapshot preservando códigos retirados,
catálogo distinguindo disponibilidade de autorização. Status/escopo abertos do
schema Profile são apresentados sem convertê-los em concessões. LEGACY_SNAPSHOT
não é reinterpretado como nova publicação. Estado publicado de referência vem do
ponteiro do perfil; GETs separados não prometem snapshot atômico conjunto.

DTOs projetados e validados em runtime: IDs, identidade de detalhe, paginação,
revisões seguras, datas, enums de versões/catálogo, unicidade de códigos e registros.
Sem autores, pessoas, atribuições, campos extras, logs, storage ou links privados.
Basic/cookies/no-store/geração de sessão existentes preservados. Hook de leitura
usa abort/active e key para descartar respostas de outro contexto. Layout mantém
foco/títulos estáticos. Erros não refletem corpo recebido.

## Testador

npm ci passou nesta atividade, sem mudar package/lockfile; sete moderados existentes
reportados. Lint, typecheck, 399 testes (49 novos + 350 da base), build e diff --check
passaram. Uma primeira execução identificou espera prematura no teste de 401: a
consulta capturava o login inicial. Corrigida a espera pelo aviso de sessão expirada,
sem alterar comportamento de produção para fazer teste passar.

Casos: cinco GETs publicados, Basic/cookie/no-store, projeção sem autores, snapshot
com códigos retirados, escopo/status legado, schemas/IDs/datas/páginas duplicados
ou inválidos, indisponibilidade técnica, permissão negada, acesso por link próprio,
visitante/login/retorno, vazio, paginação/loading, 403/404/409/422/500, retry de rede,
revogação no foco, resposta tardia de outra denominação, 401, título/foco e ausência
de escritas automáticas. Testes executam componentes/cliente reais e Responses
controladas; sem backend vivo/banco real, validação visual responsiva ou AT.

## Revisor

Papéis sequenciais no mesmo agente, sem revisão independente. Conferidos contratos,
negação por padrão, isolamento, metadados e separação entre catálogo/snapshot e
autorização efetiva. Nenhum achado crítico/alto identificado. Parecer favorável com
ressalvas de visual/AT e ponta a ponta pendentes; decisão humana do PR pendente.

Entrega parcial da #1. Descoberta de contextos, sessão técnica, comandos de perfis
(publicação/rascunhos) e atribuições são incrementos próprios. Nenhum endpoint novo,
regra funcional pendente, alteração backend, merge, deploy ou infraestrutura.
