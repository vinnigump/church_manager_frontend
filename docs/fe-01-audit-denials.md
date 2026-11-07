# FE-01 — consulta explícita de recusas administrativas

## Rastreabilidade e critérios do incremento

Data: 2026-11-07 UTC. Módulo Segurança; épico FE-01; prioridade não definida
na issue. Responsável: agente desta atividade (papéis sequenciais).
Branch `codex/fe-01-audit-denials`, PR #58. Issue #1 permanece parcial;
esta tabela não é o inventário completo de seus critérios.

| ID | Critério deste incremento | Resultado | Evidência |
| --- | --- | --- | --- |
| AUD-01 | Consultar recusas somente com filtro explícito, preservando consulta padrão | PASSOU | AuditPage.test.tsx, grupo auditoria 1.2.0; CI 42390411985 no SHA a96fada |
| AUD-02 | Exigir permissão específica e preservar tenant/contexto | PASSOU | AuditPage.test.tsx: nega auditoria mesmo com gestão e rota explícita |
| AUD-03 | Validar três ações/DENIED e projetar sem metadata/texto livre | PASSOU | Casos parametrizados de ação, ator, resultado e campos extras |
| AUD-04 | Aplicação/paginação/retorno ao padrão conservam filtros UTC | PASSOU | Testes aplicar/paginar/voltar e intervalo UTC da auditoria |
| AUD-05 | Aceite visual desktop/mobile e teclado/AT | NAO_TESTADO | Origem bloqueada no Browser Use; sem capturas |
| AUD-06 | Ensaio ponta a ponta com backend vivo | NAO_TESTADO | Apenas fixtures de contrato e jsdom nesta atividade |

Revisão independente: PENDENTE. Revisão estática sequencial não substitui
parecer externo ou aceite. Sem achados críticos/altos próprios; lacunas
de ambiente acima permanecem. PODE_CONCLUIR: NAO (issue #1 parcial e aceite
humano pendente). Próxima ação: CI/revisão do head final, liberação real do
ambiente para homologação e entrega dos contratos ainda ausentes da #1.

```yaml
atividade: FE-01-AUDIT-DENIALS
issue: https://github.com/vinnigump/church_manager_frontend/issues/1
status: EM_REVISAO
criterios_total: 6
criterios_comprovados: 4
testes_aprovados: 664
testes_falhos: 0
testes_ignorados: 0
ci: PASSOU_NO_HEAD_ANTERIOR
ci_url: https://github.com/vinnigump/church_manager_frontend/actions/runs/42390411985
sha_validado: a96fada7c2d9ec74f66a180f873b1e7118bfff97
revisao: PENDENTE
prs: [58]
bloqueios: [homologacao_visual, backend_vivo, aceite_humano]
proxima_acao: Validar CI e revisao do head final; homologar em ambiente liberado
pode_concluir: false
aceite_humano: PENDENTE
```

CI acima confirmou a execução padrão (664 testes) do head funcional anterior.
Rebase posterior inclui somente governança integrada em fd592aa e este relato;
o CI do novo SHA deve ser conferido separadamente no PR.

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
