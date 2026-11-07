# Church Manager — Frontend

Fundação React/TypeScript/Vite da issue #1. Requer Node 24.

```sh
npm ci
npm run dev
```

A API de desenvolvimento é encaminhada de `/api` para `http://localhost:8080`. Produção exige HTTPS e proxy na mesma origem. Configure somente valores públicos em `VITE_*`; nunca inclua segredos. O servidor de produção deve encaminhar rotas de navegação ao `index.html`, preservando `/api`.

Verificação: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Contratos verificados e bloqueios

Inspecionado o backend local `../church_manager`: `SecurityConfiguration`, `AccountController`, `AccountModels`, `AccountAuthenticationService` e `docs/api/identity-v1.openapi.json`. O mecanismo atual é HTTP Basic, com credenciais mantidas somente na memória desta página. Recarregar exige novo login. Não existe JWT nem OTP implementado neste frontend.

Login consulta `GET /api/v1/accounts/me` (`id`, `personId`, `login`, `status`) e `GET /api/v1/csrf` (`headerName`, `token`). Escritas exigem o token e cookie JSESSIONID da mesma sessão. A saída limpa a memória do frontend; não há contrato verificado de logout/invalidação remota. Não prometemos invalidar a sessão no servidor.

Ao abrir uma rota protegida sem sessão, o login preserva somente o caminho interno
no estado da navegação e retorna a ele após autenticar. Query e fragmento são
descartados; não usamos parâmetro de redirecionamento na URL nem storage.
O retorno não concede acesso: guardas e backend reavaliam permissões. Login direto
ou destino inválido usa Minha conta. [Relatório FE-01](docs/fe-01-login-return.md).
O backend já publica a consulta pontual `GET /api/v1/accounts/me/authorization` (OpenAPI 1.0.0), por `permissionCode`, `resourceType` e `resourceId`, retornando `{ allowed: boolean }`. `src/authorization.tsx` integra esse contrato e oferece `ResourceAccess` para futuras rotas com recurso e operação definidos. Não enumera igrejas/concessões nem substitui autorização de cada operação no servidor. A guarda reconsulta em mudança de contexto/sessão, foco e retry; não é uma assinatura em tempo real.

**Bloqueio parcial da #1:** a descoberta de contextos autorizados e a sessão administrativa técnica continuam pendentes. `/admin` permanece negado por padrão; a nova guarda não foi ligada a uma operação inexistente. Não inferimos concessões a partir de login/status. O administrador técnico não possui `identity:self`; `/accounts/me` não é um endpoint de descoberta para esse perfil.

O cliente tipa apenas os contratos usados. Não há geração de tipos para APIs de domínio ainda não integradas. Erros HTTP e falhas de leitura de JSON não exibem o corpo recebido nem mensagens brutas do parser, evitando refletir dados sensíveis. [Relatório de erros JSON](docs/fe-01-json-errors.md). Não armazenamos credenciais em storage nem logs.

## Consultas administrativas de segurança — FE-01

`/seguranca/denominacoes/:denominationId/perfis` lista os perfis; o detalhe em
`/perfis/:profileId` apresenta estado, escopo e histórico, com acesso a
`/versoes/:versionId`. `/seguranca/denominacoes/:denominationId/permissoes` consulta
o catálogo técnico. Todas exigem security:profile:manage/DENOMINATION antes dos
GETs, com nova autorização pelo backend. O catálogo denominacional oferece o
acesso quando essa permissão própria for confirmada. O contexto vem de acesso
já autorizado; não há descoberta fictícia ou formulário de UUID.

Disponibilidade técnica não concede permissão; snapshots de versões preservam
códigos retirados e não representam autorização efetiva. Estas telas são somente
leitura. Não implementam ainda comandos de perfis ou atribuições. `/admin` continua
negado por padrão para a sessão técnica sem contrato; conta denominacional real
usa as novas rotas contextuais. [Relatório FE-01](docs/fe-01-security-read.md).
## Ordem das atividades

1. #1 Fundação: implementação inicial; integração administrativa depende do contrato acima.
2. #2 Acesso público/Minha Jornada: aguarda contratos OTP, sessão e backend #14/#15.
3. #3 Trilhas e migração: depende de backend #14.
4. #4 Catálogo e eventos: depende de backend #18.
5. #5 Inscrições: depende de backend #15/#18.
6. #6 Menores/presença: planejamento, com decisões funcionais deliberadamente pendentes.

Não avançar implementando contratos fictícios para contornar dependências. Entrega da #1 deve seguir em PR rascunho, sem merge, com os bloqueios explícitos.

Evidências atualizadas e checklist de integração: [revisão FE-01](docs/fe-01-review.md).

Atualização posterior com contrato real, testes e limites: [autorização por recurso FE-01](docs/fe-01-resource-authorization.md). Os relatórios anteriores preservam as evidências históricas de suas entregas.

## Eventos — preparação da #4

`/eventos` exige autenticação. A agenda detalhada de ocorrências ainda não está integrada; a consulta do catálogo por igreja já usa o contrato EVT-005 publicado no backend.

`/eventos/igrejas/:churchId/catalogo` consulta o catálogo paginado após verificar EVENT_VIEW no recurso CHURCH. O contexto vem do acesso da igreja; não há ainda descoberta automática de igrejas nem formulário para digitar identificadores. Sem permissão, a lista não é buscada. EVENT_CREATE libera criação local e EVENT_EDIT libera habilitação/desabilitação local, sempre com nova autorização no backend e CSRF. Templates obrigatórios não têm controles de alteração.

A última desabilitação confirmada pode ser revertida enquanto a tela permanecer aberta. O backend ainda não publica consulta de todos os tipos desabilitados; esse atalho não é persistido. Falha de rede/5xx em escrita não presume sucesso e não repete a operação automaticamente.

`src/events/EventViews.tsx` contém catálogo e agenda isolados, ainda não conectados à rota. Seus modelos são de apresentação, não DTOs de API. Os exemplos sintéticos existem somente em `EventViews.test.tsx`; execute `npm test -- src/events/EventViews.test.tsx` para verificar os componentes.

Contratos inspecionados, bloqueios, resultados e parecer dos três papéis: [relatório FE-04](docs/events/fe-04-report.md). Entrega parcial; não implementa as issues #5/#6.

Atualização com contrato de consulta real e limites de validação: [catálogo integrado FE-04](docs/events/fe-04-live-catalog.md). Relatórios anteriores preservam as evidências de suas respectivas entregas.

Criação e habilitação local: [gestão local FE-04](docs/events/fe-04-local-type-management.md).

## Criação de templates denominacionais — FE-04

O catálogo denominacional permite criar um template com nome de até 180 caracteres,
mediante EVENT_TEMPLATE_MANAGE/DENOMINATION e CSRF. O backend cria o rascunho inicial;
a publicação é uma ação posterior. Após confirmação, o catálogo é atualizado e um
link abre o detalhe do novo template. Não há publicação implícita nem alteração local
do vínculo obrigatório. Falhas não repetem o POST; a criação fica bloqueada até uma
nova consulta bem-sucedida ao catálogo. Relatório: [criação FE-04](docs/events/fe-04-template-creation.md).
## Calendário anual administrativo — FE-04

`/eventos/igrejas/:churchId/calendarios` permite selecionar o ano (1–9999);
`/eventos/igrejas/:churchId/calendarios/:year` consulta os metadados administrativos
com EVENT_CALENDAR_MANAGE/CHURCH. O catálogo da igreja oferece o acesso somente
quando essa permissão for confirmada. Não há entrada de UUID ou contexto fictício.

GET confirmado como 404 oferece criação explícita. Publicar ou retirar a publicação
exige confirmação e X-Expected-Revision da resposta atual. ETag não é convertido em
revisão. Alterar o planejamento não publica ocorrências, abre inscrições ou inicia
check-in. Projeção pública, agenda/entradas detalhadas e cópia anual ainda não estão
neste contrato. Datas dos metadados são exibidas explicitamente em UTC.

Sem sucesso otimista ou retry automático; falhas exigem atualizar o calendário antes
de nova escrita. Mais detalhes: [relatório de calendário FE-04](docs/events/fe-04-annual-calendar.md).
## Inscrições — preparação da #5

`src/events/RegistrationViews.tsx` oferece resumos isolados de capacidade, situação individual e posição na espera. Não está conectado às rotas ou APIs, não permite gravação e não carrega dados fictícios em produção. Execute `npm test -- src/events/RegistrationViews.test.tsx` para os exemplos sintéticos de teste.

Contratos inspecionados, bloqueios de integração, resultados e parecer dos papéis: [relatório FE-05](docs/events/fe-05-report.md). Essa entrega não inclui os fluxos da issue #6.

## Menores e presença — preparação da #6

`src/events/ParticipationNotices.tsx` contém avisos isolados de inscrição, autorização e presença. Não está montado em rotas, não coleta evidências e não executa check-in ou qualquer decisão de autorização. Exemplos sintéticos ficam somente em testes: `npm test -- src/events/ParticipationNotices.test.tsx`.

Evidências atuais do backend, bloqueios e parecer dos papéis: [relatório FE-06](docs/events/fe-06-report.md). Os relatórios FE-04/05 registram suas respectivas entregas anteriores; nenhuma das preparações equivale a integração funcional com as APIs de Eventos.

## Catálogo denominacional e versões — FE-04

`/eventos/denominacoes/:denominationId/catalogo` lista os templates da denominação
com EVENT_TEMPLATE_MANAGE/DENOMINATION. Cada item abre
`/eventos/denominacoes/:denominationId/templates/:typeId`, que consulta estado,
rascunho atual e histórico paginado usando os contratos EVT-005/006 publicados.
O catálogo não infere lifecycle pelo campo enabled; o estado vem do detalhe real.
A versão publicada de referência é a da última consulta do template, e pode ser
atualizada com Atualizar template. Datas são apresentadas explicitamente em UTC.

Os acessos recebem o contexto da denominação; descoberta automática de contextos
continua pendente. Nenhum UUID é solicitado por formulário. A gestão do template permite criar e editar rascunho, publicar e descontinuar
com o protocolo X-Expected-Revision real. Publicação e descontinuação exigem
confirmação. Falhas bloqueiam novas escritas até atualizar o template; não há retry
automático. Alterações do nome devem ser salvas antes da publicação. Credenciais e decisões
continuam somente em memória, com nova autorização em cada operação no servidor.

Evidências e limites: [consulta de versões FE-04](docs/events/fe-04-template-history.md).

Gestão de versões: [relatório FE-04](docs/events/fe-04-template-lifecycle.md).
