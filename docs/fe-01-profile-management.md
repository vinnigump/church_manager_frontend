# FE-01 — gestão administrativa de perfis

## Implementador

Issue #1, branch codex/fe-01-profile-management. Iniciada sobre main 3af86b4,
independente do PR #37 então aberto/sem comentários/CI em execução. Ao concluir,
#37 merged externamente, parecer favorável lido e CI 42379862126 success. Rebase
sobre main 2778d57; composição com validação de sessão testada, sem conflitos.

Instruções, README, papéis, issue #1/comentários e contexto vigentes lidos. Não
executa nem homologa o redesign UI-RIO, cujo registro não despacha implementação.
Contratos profile-drafts-v1 e profile-lifecycle-v1 1.0.0, guia security-admin,
controladores Draft/Lifecycle, AuthenticatedProfileManagementService,
ProfileManagementService e ProblemHandler inspecionados na principal backend.
Arquivos usados sem alterações entre c4616d7 e origin/master 7a1872c.

Operações reais sob /security/denominations/{denominationId}/profiles:
POST cria com code/scopeType/name/permissionCodes; GET /{id}/draft;
POST /{id}/draft copia com revisão do perfil; PUT /{id}/draft usa revisão do draft
e draftVersionId no corpo; POST /{id}/publish usa revisão lógica e identidade/revisão
do draft; POST /{id}/deactivate e /reactivate usam revisão lógica, sem corpo.
Nenhum If-Match ou ETag convertido em número. Basic/cookie/CSRF existentes mantidos.

Rotas /seguranca/denominacoes/:denominationId/perfis/novo e
/perfis/:profileId/gerenciar, acessíveis a partir da listagem/detalhe integrado.
security:profile:manage/DENOMINATION antes de carregar catálogo/perfil/rascunho;
ator e decisão finais do servidor. Hook acima da guarda impede duplo envio mesmo
no foco. Sucesso e atualização manual remontam a guarda para decisão atual antes
das novas leituras; perda de acesso retira dados/ações. Mudança de conta/recurso
ignora respostas antigas, sem afirmar que abort desfaz transação no servidor.

Picker usa disponibilidade e scopeTypes reais. Alterar escopo não elimina seleções;
permissão incompatível/retirada precisa ser removida conscientemente. Campos código
80/nome 160, até 100 códigos únicos; conjunto vazio é permitido pelo contrato.
Código/escopo são fixos após criar; rascunho não muda autorizações efetivas. Status
legado/escopo não suportado ficam somente leitura. Não há concessão implícita nem
atribuição a pessoa. Publicação de DISABLED mantém DISABLED; reativação separada.

Publicar/desativar/reativar exigem confirmação. Versão/nome salvo são apresentados,
e dirty impede publicação. Desativação preserva versões/atribuições e backend protege
último acesso de recuperação. A interface não calcula essa proteção por login ou
perfil local. Erros usam mensagens uniformes por status, sem refletir ProblemDetail
ou diagnosticar códigos técnicos como concessão; explica-se a proteção do servidor.

Resultados de comando são validados/projetados para mesmo perfil/versão e estado
esperado quando aplicável. PUT não presume que o estado lógico do perfil não possa
ter mudado concorrencialmente: sua revisão contratual é a do rascunho. GETs posteriores
reconciliam perfil/draft/catálogo; navegação de consulta preserva histórico. Sucesso
confirmado não vira falha por erro posterior de leitura. Rede/5xx/schema são resultado
incerto; nenhuma escrita automática é repetida e comandos ficam bloqueados até refresh.

## Testador

npm ci reproduzido nesta sessão; package/lockfile inalterados, sete moderados existentes.
Após rebase: lint, typecheck, 457 testes (35 novos + 422 da main), build e diff --check
passaram. Uma primeira execução de lint encontrou import de teste não utilizado;
removido. O teste de ciclo completo foi corrigido para aguardar publicação confirmada
antes de tentar o próximo comando, respeitando a trava existente, sem relaxar regra.

Casos: seis escritas e leitura de draft, métodos/headers/revisões/corpos exatos,
Basic/CSRF/no If-Match, dados inválidos e legado, resultado incompatível, ciclo completo,
publicação desativada sem reativação, escopo sem remoção silenciosa, código retirado,
dirty, acesso negado, 403/404/409/422, rejeição LAST_RECOVERY_ACCESS mantendo ativo,
rede/500/schema, duplo envio/foco, outra denominação, reautorização pós-comando e 401.
Clientes/componentes reais com respostas controladas conforme contrato; sem backend
vivo, banco de uso ou contas reais. Ensaio visual/AT continua pendente.

## Revisor

Papéis sequenciais no mesmo agente, sem revisão independente. Conferidos snapshots,
revisões, estados de publicação/ativação, negação por padrão e resultado incerto.
Sem achado crítico/alto identificado. Parecer favorável com ressalvas de backend vivo,
visual/AT e aprovação humana pendentes. Não conclui discovery/sessão técnica ou toda #1.
Sem merge/deploy/infraestrutura pelo agente. Resumos locais não rastreados preservados.
