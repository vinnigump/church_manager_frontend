# Onda 1 - especificação de identidade, acesso e Jornada

Issue canônica frontend #2; relacionada #3, #5, #6 e #33. Planejamento FE-02/03,
P0 reconciliação. Codex, 2026-11-08 UTC. Branch `codex/wave1-identity-spec`,
base a58e2a8; SHA/PR/CI no PR. Somente especificação; nenhuma tela/serviço novo.
Prontidão documental PARTIAL; implementação dos fluxos NOT_STARTED/BLOCKED por
contratos e lacunas nomeadas abaixo. Esta especificação não é contrato de API.

## 1. Fontes e precedência

AGENTS, README, Onda0 e issues FE01..06/UI01..08 consultados. Fontes funcionais:
- backend #64 CF-2026-11-08 e AP-2026-11-08;
- #72 ID-DEC-037/038/039/040/041/042/043/045 e ID-01..05;
- #66 MEM-DEC-011/012/013 e MEM-01..07, C1/C2/C3/C6;
- #67 TRI-01..05 e #72 ID-DEC-019/021/022;
- #14/#15: texto inicial histórico deve ceder às reconciliações posteriores.

Links: https://github.com/vinnigump/church_manager/issues/64,
https://github.com/vinnigump/church_manager/issues/72,
https://github.com/vinnigump/church_manager/issues/66,
https://github.com/vinnigump/church_manager/issues/67.

OTP-only não é mecanismo definitivo aprovado. Código/link de confirmação de
canal não é, por si só, um login OTP-only. Basic permanece como mecanismo real
do frontend até contrato aprovado de evolução; não trocar por JWT/cookies/token
presumidos. Convite manual ID-01 resolve a pendência antiga ID-DEC-044.

Identidade funcional é única: não pedir segundo cadastro de pessoa para criar
conta ou tornar visitante membro. Separação técnica atual Person/UserAccount
não autoriza duplicar identidade funcional (ID-DEC-039). Cadastro, conta ativa,
membresia, concessão RBAC e inscrição são resultados diferentes.

## 2. Contratos realmente disponíveis e lacunas

Backend master efc5990003534c72b7a2b55db100e08edbdf7a23:

| Contrato existente | Uso comprovado | Não comprova |
| --- | --- | --- |
| identity-v1 0.3.0 | contas existentes: GET accounts/me, CSRF e própria senha; pessoas/contas administrativas com identity:manage | autocadastro público, convite, ativação, recuperação ou sessão técnica compatível com accounts/me |
| self-authorization-v1 1.0.0 | decisão pontual CHURCH/DENOMINATION | enumeração de igrejas, dependentes ou sujeitos autorizados |
| organization-v1 0.4.0 | administração global organization:manage | descoberta contextual para secretaria/usuário comum |
| group-memberships-v1 1.0.0 | vínculos próprios de grupos, consulta/histórico/saída | criação/ativação da membresia formal ou descoberta de pessoas |
| event-registration-window-v1 1.0.0 | configuração administrativa de janela | inscrição, capacidade, fila, responsáveis ou Jornada |

Sem contratos integrados de autocadastro/ativação/convite/recuperação/Jornada/
versões/migração/SSE. Backend122 público é dependência separada ainda pendente
de integração na inspeção; não fornece os escritores destes fluxos.

Identidade administrativa atual permite CPF opcional; decisões futuras exigem
documento aceito e identidade única. Não mudar obrigatoriedade do formulário
existente nem escolher documentos/tipos pela especificação; backend precisa
reconciliar DTO, permissões, cadastro incompleto e deduplicação antes da UI.

## 3. Autocadastro contextual

Ator: pessoa ainda sem conta, iniciando funcionalidade pública autorizada.
Origem: evento selecionado, preservado como destino interno autorizado, sem
copiar dados pessoais/segredos para URLs ou aceitar redirecionamento externo.

Sequência funcional aprovada:
1. Consultar recurso público real; iniciar cadastro quando necessário, sem
   transformar componente demonstrativo em inscrição.
2. Identificar pessoa única/documento aceito e dados exigidos pelo contrato;
   documento já associado não cria nova identidade nem revela outra pessoa.
3. Definir senha durante cadastro (ID-DEC-042). Política operacional deve vir
   do contrato; não transportar limites da troca de senha por suposição.
4. Informar pelo menos um canal exclusivo de recuperação e confirmar posse
   por código/link temporário antes de concluir cadastro/inscrição (045).
5. Somente após confirmação do backend, continuar no evento original com
   sessão segura, sem login separado imediato. Reavaliar elegibilidade/janela/
   capacidade/menores antes da inscrição; cadastro não garante vaga.
6. Evento avulso não atribui trilha/membresia. Evento associado a trilha
   acessível atribui execução após inscrição, conforme contrato idempotente;
   não presumir que trilha privada seja acessível.

Estados de UX a mapear às respostas reais: identificação, validação pendente,
posse confirmada, processamento, resultado confirmado/incerto e impedimento.
São etapas de apresentação, não enumerações ou estados persistidos inventados.
Falha de confirmação não abre inscrição; timeout de criação não dispara segundo
cadastro. Reconciliação/repetição dependem da garantia de idempotência do servidor.

Conta existente deve autenticar com suas credenciais (041), não somente CPF,
telefone ou dados pessoais. Identidade ainda não ativada segue primeiro acesso
seguro (ID-04), sem nova pessoa. Mensagens não identificam titular de documento
ou canal e não permitem enumeração. Sem storage de credenciais/documentos.

## 4. Convite administrativo e ativação

Ator administrativo com permissão/escopo a publicar no contrato, sem inferir
identity:manage global para secretaria. Novo cadastro é separado da seleção
de participante no evento (#5) e não ativa membro ou concessões implicitamente.

Administração cadastra identidade e pelo menos um canal exclusivo reservado,
sem afirmar posse verificada. Administrador envia convite de ativação
manualmente (ID-01), com expiração, uso único e auditoria. Não implementar envio
automático nem permitir que administrador conheça/escolha senha pessoal.

Titular acessa convite, estabelece credenciais e confirma posse do canal na
ativação (ID-02/C4). Até confirmação, canal não autoriza recuperação. Convite
inválido/expirado/usado e disputa concorrente não concedem sessão. Exposição,
revogação/reenvio e transporte do segredo precisam de contrato seguro; a UI
não registra token em logs, analytics ou storage. Não fixar prazo, provedor,
canal ou endpoints sem decisão/contrato.

Aceite de titular não concede automaticamente membresia ou papéis. A gestão
administrativa e a ativação devem confirmar resultado sem duplicar cadastro.

## 5. Recuperação e troca do canal

Autoatendimento é prioritário (ID-DEC-037): solicitar recuperação, provar posse
do canal exclusivo elegível, definir senha nova sem expor a antiga. CPF/data
de nascimento isolados não recuperam conta. Contato cadastral compartilhável
não é canal de recuperação automático (038). Respostas genéricas para conta
ausente/canal indisponível; uso único, expiração, tentativas e rate limits
decididos pelo servidor. Reinício/repetição não podem reutilizar segredo usado.

Sem acesso ao canal, administrador autorizado é último recurso: conferência
de identidade fora do sistema pela igreja, operação auditada; não inventar
upload documental, dupla aprovação ou OTP administrativo obrigatório. Tela
administrativa futura reúne recuperação segura, atualização do canal e
desbloqueio, somente quando cada operação tiver contrato/permissão real.

Troca de canal pelo titular só substitui o anterior após posse do novo canal,
exclusividade, autenticação e auditoria (ID-03). Backend define invalidação de
sessões/credenciais antigas; frontend não promete logout remoto inexistente.
Troca da própria senha já integrada permanece fluxo distinto e preservado.

## 6. Minha Jornada e representação

Consulta do sujeito autenticado e contexto autorizado; alternância de dependente
somente quando servidor publicar concessão válida, nunca por sobrenome,
parentesco ou contato compartilhado. Resposta deve delimitar actor/subject/
igreja/execução, versão, tarefas aplicáveis, situação, evidências e progresso.
Fórmula/denominador/dispensas/projeção pessoal devem vir do backend, não da
contagem local de uma página. Resultado indisponível não é progresso zero.

Exibir versão e histórico separadamente, loading/vazio/erro/negação e impedimento
de membresia sem perder evidências. Inscrição não conclui tarefa; participação
em evento só contribui mediante evidência válida. Sem check-in não gerar
evidência automática. Cancelamento de evento mantém tarefa de presença pendente
(TRI-05); atraso sinalizado não bloqueia automaticamente atividade (TRI-04).

Conta própria de menor depende de idade mínima configurável, consentimento e
responsáveis (ID-05): critérios pendentes bloqueiam essa fatia. Não coletar
documentos ou criar formulário de responsável antes dos contratos e retenção.

## 7. Versões, progresso e migração de trilhas

| Situação | Regra vigente | Exibição/aceite futuro |
| --- | --- | --- |
| Trilha comum com execução ativa | nova versão migra automaticamente (019/C3) | origem/destino e progresso recalculado pelo servidor; não criar nova execução ativa |
| Trilha oficial de membresia | conserva versão inicial (MEM-07/013) | identificar tipo/versão real; migração somente controlada/auditada |
| Conclusão anterior | não reabre na publicação; adesão voluntária à versão atual cria nova execução (021) | histórico anterior intacto, aproveitamento só por identidade/equivalência válida |
| Unicidade | uma execução ativa por pessoa/trilha lógica, não por versão (022) | conflito não gera duplicação; não bloquear trilhas lógicas distintas |
| Dispensa/conclusão manual | exceção autorizada com justificativa/auditoria (TRI01/02) | efeitos, permissões e reversões ainda pendentes; não reescrever evidências nem conceder membro automaticamente |
| Desligamento sem transferência | encerra administrativamente execuções ativas, preserva histórico (MEM05/C1) | não confundir com transferência/cancelamento voluntário; retomada pós-desligamento pendente |

Membresia automática exige critérios próprios de novo membro elegível na trilha
oficial, obrigatórias concluídas, unicidade e auditoria. Ex-membro requer
reativação administrativa; não restaurar cargos/permissões. Regra posterior de
uma igreja formal ativa globalmente (C6) prevalece sobre exclusividade apenas
por denominação; frontend não calcula ou concede vínculo.

Preview de migração administrativa não executa. Backend deve publicar snapshot/
revisão/validade, diferenças e consequências para rejeitar preview obsoleto;
UI confirma com justificativa e contexto. Lote continua sem navegador, resultado
por pessoa; cancelamento para novos itens, não reverte concluídos. Progresso
recuperável por REST e SSE com retomada segura conforme contrato, sem inventar
URL, eventos, token, polling ou limite de lote. Reprocessamento seletivo manual
de falhas não está aprovado em #14; não criar botão por conveniência.

## 8. DoR de contratos e matriz de aceite

Antes de implementação: contrato aprovado/integrado com ator/escopo, schemas,
validações/erros públicos seguros, CSRF/sessão, idempotência/concorrência, leitura
de reconciliação, paginação/progresso, auditoria e minimização. Não propomos
endpoints, DTOs normativos, permissões, TTLs, percentuais ou parâmetros ausentes.

| ID | Cenário a executar após contratos | Resultado esperado |
| --- | --- | --- |
| I01 | autocadastro válido e confirmação de canal | identidade única, sessão segura, retorno ao evento, sem login extra |
| I02 | documento/canal duplicado ou duas criações concorrentes | sem segundo cadastro/canal; mensagem sem titular revelado |
| I03 | desafio inválido/expirado/usado ou excesso de tentativas | sem ativação/sessão/inscrição; limite autoritativo |
| I04 | conta existente e identidade ainda não ativada | login/ativação apropriados, nunca pessoa duplicada |
| I05 | convite administrativo | administrador sem senha; titular confirma canal; uso único/expiração/auditoria |
| I06 | recuperação e troca de canal | posse/exclusividade, sem dados pessoais como autenticação; sem canal geral automático |
| J01 | sujeito/igreja/dependente trocados ou acesso revogado | abortar/ignorar resposta antiga, limpar projeção e negar operação |
| J02 | mera inscrição, evento cancelado ou evidência invalidada | não inventar conclusão/presença/membresia; reavaliação do servidor |
| T01 | nova versão comum versus oficial | automática somente comum; oficial conserva versão original |
| T02 | adesão voluntária/concorrência | histórico intacto; uma execução ativa por trilha lógica |
| T03 | preview obsoleto/lote em execução | rejeitar execução indevida; progresso retomável, cancelamento sem rollback |
| T04 | dispensa/manual/desligamento/ex-membro | não conceder membro por atalho; não restaurar privilégios/execução pendente de decisão |

Todos os cenários acima: NAO_TESTADO funcional, contratos ausentes. São plano
de testes, não testes falsamente aprovados. Em cada tela futura incluir loading,
erro/vazio/negação, confirmação/cancelamento quando aplicável, foco, mobile e
perda de contexto; validação visual final manual pelo produto.

## 9. Critérios desta entrega documental e revisão

| Critério documental | Resultado | Evidência |
| --- | --- | --- |
| S01 precedência de autenticação e convite | PASSOU | #64/#72 037/038/040..045 e ID01/02; sem OTP-only |
| S02 seis áreas especificadas com aceite/dependências | PASSOU | seções3..7 e matriz de12 cenários |
| S03 versões/membresia preservam exceções atuais | PASSOU | C1/C2/C3/C6 e MEM/TRI; limites explícitos |
| S04 contratos ausentes não viram integração | PASSOU | inventário e DoR, sem código de aplicação/endpoints novos |

Revisão textual sequencial do mesmo agente; revisão independente PENDENTE.
Sem achados críticos/altos documentais identificados; não constitui aceite de
contratos futuros. Diff check executado antes do commit. Checks de aplicação/CI
do SHA serão registrados no PR; não atribuir testes de features ausentes.
PODE_CONCLUIR2/3: NAO. Próxima ação da onda seguinte somente com autorização,
contratos e critérios refinados; Onda 2 não iniciada.

```yaml
atividade: W1-IDENTITY-JOURNEY-SPEC
issue: https://github.com/vinnigump/church_manager_frontend/issues/2
status: EM_REVISAO
criterios_total: 4
criterios_comprovados: 4
testes_aprovados: 0
testes_falhos: 0
testes_ignorados: 0
ci: PENDENTE
ci_url: null
sha_validado: null
revisao: PENDENTE
prs: []
bloqueios: ["Contratos futuros ausentes; menores, dispensa e retomada ainda dependem de critérios"]
proxima_acao: "Revisão da especificação; autorização separada da próxima onda"
pode_concluir: false
aceite_humano: PENDENTE
```
