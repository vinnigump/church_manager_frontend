# FE-CAD-CPF-CIN-CONFIRMACAO — evidência local

## Correção do PR #107 — execução fe91421a-8315-4b0a-9f34-01c9eabddcad

Data: 2026-11-10 UTC. Issue canônica: frontend #33; Pessoas/Membresia,
Onda 2. Branch `codex/wave-2-fe-cad-cpf-cin-confirmacao-fe91421a`.
HEAD inicial conferido: `c26449f91a136b531b9acb963c45193bf8db79ea`, igual
ao target_head revisado. Merge-base conferida:
`88c2f9a0c703194bc6652dca47695415900fa1da`, igual à base informada.
AGENTS.md, README, governança, issue e pareceres fornecidos pelo host,
RegistrationPage, PersonViews, ResourceAccess, cliente API e testes relevantes
consultados. Contrato integrado permanece o descrito abaixo; nenhum endpoint,
payload ou regra de autorização alterado nesta correção.

**Implementação:** `preserveDuringRecheck` é opt-in no ResourceAccess e usado
apenas pelo cadastro. Durante revalidação da mesma sessão/recurso previamente
autorizado, conserva a instância do formulário em contêiner `hidden` e `inert`.
Não permite interação ou leitura acessível até confirmar a permissão. Assim,
rascunho, correções e trava de reenvio permanecem após retorno do foco.
Decisão negativa, falha de autorização ou mudança de sessão/recurso desmontam
o formulário; requisição pendente é abortada e resposta tardia não o restaura.
As demais utilizações da guarda mantêm o comportamento anterior.

| Critério literal do recorte em revisão | Resultado | Evidência |
| --- | --- | --- |
| Preservar edição em erro e conflito. Descartar respostas antigas após perda de contexto. | PASSOU | Regressões de foco após 400/409/500 preservam CPF, nome corrigido e trava inclusive contra submit programático; rascunho sem envio preservado; revogação e nova sessão descartam dados e confirmação pendente. |
| Tratar confirmação e ficha como fluxos distintos. Leitura posterior só pela operação autorizada, sem fallback para consulta global. | PASSOU | Testes CPF/CIN mantidos verificam confirmação após 201 e ausência de qualquer consulta posterior. |

**Testes reais desta execução** (Node v24.22.1, npm 11.19.1, dependências
preparadas pelo host, sem reinstalação):

- `npm test -- src/people/RegistrationPage.test.tsx src/authorization.test.tsx src/people/PersonViews.test.tsx`: exit 0, 3 arquivos, 52 testes aprovados na execução final (51 antes do caso adicional de troca de sessão).
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0, 60 arquivos, 1466 testes aprovados, nenhum falho ou ignorado.
- `npm run build`: exit 0, TypeScript e Vite 7.3.7, 120 módulos.
- `git diff --check`: exit 0.

**Handoff:** correção integral do recorte em revisão pronta para avaliação técnica.
Responsável: executor frontend (implementação e testes locais); revisão
independente PENDENTE, sem autoaprovação. CI deste diff: NAO_EXECUTADO;
os checks relatados pelo host pertencem ao HEAD anterior, não a estas alterações.
Nenhum novo SHA publicado. Sem commit, push, PR, alteração da fila ou validação
visual. PODE_CONCLUIR: NAO para issue/onda; aceite humano PENDENTE.
Próxima ação: host publicar o diff e executar revisão/CI no novo SHA.

A lacuna funcional preexistente permanece fora do recorte corretivo e não impede
sua entrega integral: **pergunta** qual concessão global explícita e contrato de
atribuição autorizam cadastro sem igreja? **Issue** backend #72 / frontend #33;
**parte afetada** associação opcional do cenário sintético. Opção permanece
indisponível, sem inferir permissões. Nenhuma nova decisão de produto necessária
para corrigir a preservação durante revalidação.

## Evidência histórica da implementação inicial

Execução `1c639c69-b7e4-4fcd-9cca-b2fa88660fb9`, Onda 2, frontend #33,
Pessoas/Membresia. Data: 2026-11-10 UTC. Estado: EM_TESTES (entrega parcial).
Branch: `codex/wave-2-fe-cad-cpf-cin-confirmacao-1c639c69`.
Base conferida: `88c2f9a0c703194bc6652dca47695415900fa1da`, release/homolog.
Alterações sem commit; nenhum SHA novo validado, PR, push ou alteração da fila.

## Fontes e implementação

AGENTS.md, README e development-reporting.md lidos. Briefing e cópia da issue #33
fornecidos pelo host. Contrato #154 conferido nos snapshots do host; runtime #163
confirmado no registro `integrations/church_manager-163.json`, integrado em
`6f92171678ae713d6692b758dca846d3fde86fad`, head
`5befdd86fdfefff008d27f8f113152bc422fd575`. OpenAPI
`administrative-registration-v1` 1.0.0 e `cadastro-cpf-cin-contrato.md` desse head
consultados diretamente. Acesso web ao PR não retornou conteúdo; `gh` indisponível.

Rota autenticada `/pessoas/igrejas/:churchId/cadastrar`, descoberta na Home somente
com `identity:person:contextual:create`/CHURCH. ResourceAccess revalida ao foco e
por sessão/contexto. POST exclusivo para `/api/v1/people/administrative-registrations`,
Basic em memória, cookies e CSRF existentes. CPF ou CIN_CPF explícito, nome,
contatos, nascimento opcional e associação da igreja autorizada. Validação e
normalização documental autoritativas permanecem no backend.

Confirmação exige HTTP 201 e corpo válido coerente com a igreja. Não apresenta
ficha, convite ou membresia; não faz leitura posterior nem fallback global.
Erro/conflito preservam edição e bloqueiam reenvio automático ou repetição incerta.
403 descarta o formulário. Perda de acesso/contexto desmonta os dados e aborta
a requisição; respostas tardias não restauram confirmação.

## Critérios individualizados

| Critério literal | Resultado | Evidência |
| --- | --- | --- |
| Enviar CPF ou CIN baseada em CPF, contato e associação opcional conforme contrato. Mostrar confirmação só após 201. | PARCIAL | RegistrationPage.test.tsx: CPF/CIN com igreja, CSRF, rejeição de 200 e 201 inválido. Sem igreja indisponível por lacuna funcional abaixo. |
| Preservar edição em erro e conflito. Descartar respostas antigas após perda de contexto. | PASSOU | RegistrationPage.test.tsx: 400/409/500, edição preservada, revogação 403 e resposta pendente após perda de acesso; PersonViews.test.tsx: troca de chave de contexto. |
| Tratar confirmação e ficha como fluxos distintos. Leitura posterior só pela operação autorizada, sem fallback para consulta global. | PASSOU | Confirmação sem PersonRecord, nenhuma leitura posterior. Testes verificam única chamada de cadastro, sem GET de identidade/pessoa. |

## Lacuna para fechamento da onda

**Pergunta:** qual concessão global explícita e qual contrato de atribuição autorizam
cadastro administrativo sem igreja? **Issue:** backend #72 (origem frontend #33).
**Parte afetada:** associação opcional do primeiro critério, especificamente omitir
churchId. O adaptador integrado nega essa operação com 403; não inferir
`identity:manage`. Produto/backend precisam definir e integrar a concessão antes
de habilitar a opção sem associação. Formulário contextual permanece entregável.
Nenhum trabalho técnico aprovado restante nesse critério; pendência funcional.

## Verificação e handoff

Ambiente: Windows, Node v24.22.1, npm 11.19.1; dependências preparadas pelo host,
sem reinstalação. Nenhuma validação visual executada.

- `npm test -- src/people/RegistrationPage.test.tsx src/people/PersonViews.test.tsx`:
  exit 0, 2 arquivos e 22 testes aprovados (antes de adicionar 3 casos de confirmação inválida).
- `git diff --check`: exit 0.
- `npm run lint`: aprovado, sem erros.
- `npm run typecheck`: aprovado, sem erros.
- `npm test`: exit 0, 60 arquivos e 1460 testes aprovados, nenhum falho/ignorado;
  inclui os 3 casos adicionais de confirmação inválida.
- `npm run build`: exit 0, TypeScript e Vite 7.3.7 aprovados, 120 módulos.

Estado após verificação: recorte local PRONTO_PARA_ACEITE, atividade integral parcial.
Responsável por implementação e execução técnica: executor frontend desta worktree.

CI: NAO_EXECUTADO (execução local sem publicação, conforme instrução).
Revisão independente: PENDENTE; não houve agentes adicionais ou autoaprovação.
PODE_CONCLUIR: NAO para a atividade integral; recorte contextual implementado.
Próxima ação: host publicar/validar o recorte e produto fechar a pergunta backend #72.
Aceite humano/homologação: PENDENTE.
