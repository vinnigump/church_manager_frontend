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

**Bloqueio parcial da #1:** o backend não expõe no contrato de conta as permissões e escopos efetivos. A rota administrativa permanece negada por padrão. O guard suporta pares exatos permissão/escopo, mas não inventa concessões a partir de login ou status. O administrador técnico tampouco possui `identity:self`, portanto `/accounts/me` não é um endpoint de descoberta para esse perfil. É necessário um contrato de sessão/capacidades aprovado antes de habilitar administração. O backend sempre decide autorização.

O cliente tipa apenas os contratos usados. Não há geração de tipos para APIs de domínio ainda não integradas. Erros HTTP não exibem o corpo recebido, evitando refletir dados sensíveis. Não armazenamos credenciais em storage nem logs.

## Ordem das atividades

1. #1 Fundação: implementação inicial; integração administrativa depende do contrato acima.
2. #2 Acesso público/Minha Jornada: aguarda contratos OTP, sessão e backend #14/#15.
3. #3 Trilhas e migração: depende de backend #14.
4. #4 Catálogo e eventos: depende de backend #18.
5. #5 Inscrições: depende de backend #15/#18.
6. #6 Menores/presença: planejamento, com decisões funcionais deliberadamente pendentes.

Não avançar implementando contratos fictícios para contornar dependências. Entrega da #1 deve seguir em PR rascunho, sem merge, com os bloqueios explícitos.

Evidências atualizadas e checklist de integração: [revisão FE-01](docs/fe-01-review.md).

## Eventos — preparação da #4

`/eventos` exige autenticação e informa indisponibilidade enquanto os contratos reais de Eventos/capacidades não forem publicados. Não consulta endpoints presumidos nem apresenta dados simulados.

`src/events/EventViews.tsx` contém catálogo e agenda isolados, ainda não conectados à rota. Seus modelos são de apresentação, não DTOs de API. Os exemplos sintéticos existem somente em `EventViews.test.tsx`; execute `npm test -- src/events/EventViews.test.tsx` para verificar os componentes.

Contratos inspecionados, bloqueios, resultados e parecer dos três papéis: [relatório FE-04](docs/events/fe-04-report.md). Entrega parcial; não implementa as issues #5/#6.

## Inscrições — preparação da #5

`src/events/RegistrationViews.tsx` oferece resumos isolados de capacidade, situação individual e posição na espera. Não está conectado às rotas ou APIs, não permite gravação e não carrega dados fictícios em produção. Execute `npm test -- src/events/RegistrationViews.test.tsx` para os exemplos sintéticos de teste.

Contratos inspecionados, bloqueios de integração, resultados e parecer dos papéis: [relatório FE-05](docs/events/fe-05-report.md). A issue #6 não foi iniciada.
