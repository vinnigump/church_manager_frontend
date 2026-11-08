# FE-04 — consulta e desvinculação de participantes de grupos

Issue canônica frontend #4 (parcial), Eventos/FE-04; backend EVT-011/#31,
AUD-001/002/008, retificação009 e011. Prioridade frontend não definida.
Data2026-11-08UTC; branch codex/fe-04-group-memberships; base frontend
6e83fc19dc2a843f065febd8ee2bda86c016d336. SHA/CI finais no PR.
Responsável: agente em etapas sequenciais, sem revisão independente simulada.

## Contrato e implementação

Backend119 integrado em07495839d50d57fa4a72740d91bc21a74f7eaef3 antes do código.
Inspecionados group-memberships-v1 1.0.0, controlador/Models/Service, autorização
de gestor/líder e motivo restrito ao histórico. Vínculo próprio não é cargo,
permissão, presença ou membresia formal. Não expira por data histórica.

Rotas /igrejas/:church/grupos/:kind/:group/vinculos e /:membership oferecem lista,
filtro ACTIVE/INACTIVE aplicado explicitamente, detalhe/histórico paginados e
desvinculação direta. MINISTRY/DEPARTMENT e UUIDs/contexto/IDs são validados.
Parser projeta DTO, valida estado/revisão/datas/atores, página/total coerentes,
duplicados e filtro. Não filtra página inválida para simular sucesso parcial.

GroupAccess reusa consultAuthorization: GROUP_MEMBERSHIP_MANAGE na igreja ou,
somente após recusa explícita, GROUP_MEMBERSHIP_MANAGE_LED. Falha na decisão
mantém fechado. A decisão LED é apenas candidata: o endpoint confirma atribuição
eclesiástica ACTIVE no grupo exato. Não presume liderança por cargo genérico,
participação ou permissão de Eventos. Detalhe deve corresponder ao grupo da rota
antes de iniciar histórico. Motivo aparece somente no histórico autorizado,
sem copiar extras/contatos/documentos para listagem, logs ou storage.

POST de saída envia JSON {reason}, CSRF e X-Expected-Revision do vínculo.
Confirmação informa pessoa/revisão/efeito. Motivo opcional até500 caracteres;
mudança invalida confirmação. Resposta confirma mesmo vínculo/pessoa/grupo,
campos de ingresso preservados, INACTIVE/revisão+1 ou no-op já inativo.
Relê detalhe/histórico após sucesso. Não existe solicitação/aprovação/rejeição
de saída, comprovante eletrônico ou notificação. Membresia formal, cargos,
permissões, outros grupos e inscrições não são alterados.

Comando/trava acima da guarda sobrevive ao foco e evita envio duplo. Foco
reautoriza e limpa motivo/confirmação. Erro HTTP/resposta incompatível não vira
sucesso e bloqueia nova tentativa até atualização explícita/releitura. Mudança
de conta/igreja/grupo/vínculo aborta e descarta resultado antigo, sem prometer
rollback. Consultas de detalhe/histórico são independentes e podem refletir
alteração concorrente; servidor revalida revisão na escrita.

## Limites específicos

Não implementa inclusão: POST existe, mas descoberta/seleção autorizada de pessoas
formais locais não foi publicada. Não substitui por UUID manual ou diretório
global identity:manage. Descoberta de grupos para usuário comum também ausente;
rotas recebem contexto autorizado, como os demais módulos contextuais, sem menu
com IDs presumidos. Não cria Person/membresia nem resolve o cadastro bloqueado
da issue33. Audiência pública, inscrição e transferência continuam separadas.

## Testador e revisão

Node24.22.1/Windows: npm ci/lint/typecheck/test/build/diff --check passaram.
Regressão1208 testes/47 arquivos,50 novos; primeira rodada46 direcionados depois
dos ajustes passou. Primeiro typecheck detectou narrowing de action unknown,
corrigido após validação estrita. Primeiras fixtures tinham página incoerente
(um item,total21) e asserção confundia loading com sucesso; corrigidas sem
afrouxar parser/guardas. Identificação textual de igreja/grupo acrescentada
depois da regressão, com verificação direcionada final registrada no PR.
Sem falhas/ignorados finais ou mudança de dependências/lockfile.

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| GM-F01 | Gestor ou líder candidato; grupo exato no endpoint | PASSOU | MANAGE/LED,403 de grupo, falha fechada, Eventos não concede |
| GM-F02 | Lista/filtros/detalhe/histórico contextual | PASSOU | paginação coerente, estados, ministério/departamento e motivo restrito |
| GM-F03 | Saída direta/CSRF/revisão/histórico preservado | PASSOU | payload mínimo, no-op, resposta estrita e releitura |
| GM-F04 | Foco/erro/contexto sem replay/vazamento | PASSOU | envio duplo, revogação, resposta incerta, HTTP403/409/422/500 e aborto |
| GM-F05 | Backend vivo e autorização real do grupo | NAO_TESTADO | fixtures/jsdom e serviço integrado inspecionado |

Validação visual dispensada como requisito; Run local apenas por necessidade
concreta, não solicitado por rotina. Revisão estática sequencial sem críticos/altos
identificados; revisão independente/aceite PENDENTES. Sem merge/deploy/infraestrutura.
Próxima ação: conferir CI/revisão e seguir auditoria1.6 independente.
PODE_CONCLUIR issue4: NÃO, incremento parcial.

```yaml
atividade: FE-04-GROUP-MEMBERSHIPS
issue: https://github.com/vinnigump/church_manager_frontend/issues/4
status: EM_REVISAO
criterios_total: 5
criterios_comprovados: 4
testes_aprovados: 1208
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: [revisao_independente, aceite_humano]
proxima_acao: Conferir CI/revisao e seguir auditoria1.6 independente
pode_concluir: false
aceite_humano: PENDENTE
```
