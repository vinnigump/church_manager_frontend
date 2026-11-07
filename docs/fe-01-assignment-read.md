# FE-01 — consulta de atribuições administrativas

Contrato verificado: backend origin/master, assignments-v1 1.1.0,
AssignmentController e AssignmentReadService. GET lista e detalhe exigem
security:assignment:manage no recurso DENOMINATION. A permissão de perfis não
substitui essa decisão. Leituras delegadas não são oferecidas por esse contrato.

Rotas privadas: /seguranca/denominacoes/:denominationId/atribuicoes e
/atribuicoes/:assignmentId. O catálogo denominacional oferece link condicionado
à permissão própria; acesso direto também funciona sem exigir gestão de perfis.
Não há descoberta fictícia de contexto, contas ou formulário de UUID.

Lista paginada (20, limite 100000), detalhe, atualização e estados vazio/erro/loading.
Estado armazenado, fonte e intervalo inclusivo/exclusivo são explícitos; datas UTC.
ACTIVE não é apresentado como prova de acesso efetivo, inclusive em início futuro.
O DTO só fornece identificadores; nenhum nome pessoal é inferido nem consultado
por APIs técnicas globais. Campos extras são descartados. Validação cobre UUIDs,
nullable, instantes, revisão segura, página, duplicatas e identidade do detalhe.

Reutiliza ResourceAccess (reconsulta por foco/contexto/sessão), cliente same-origin
no-store, descarte de respostas obsoletas e componentes de consulta existentes.
Sem comandos, retry de escrita, storage, concessão ou revogação neste incremento.
Esses comandos têm contrato próprio e exigem incremento de UX/validação separado;
não são declarados indisponíveis no backend. Descoberta contextual de destinatários
para concessão ainda requer definição/contrato; identidade técnica não é equivalente.

Implementação, teste e revisão executados sequencialmente pelo mesmo agente.
Revisão: nenhuma escrita, nomes/autorizações inferidos ou exposição de corpo bruto;
rota e domínio protegidos pela permissão correta, servidor permanece autoridade.

Verificação local: lint, typecheck, 472 testes (15 novos), build e diff --check
passaram. npm ci executado nesta sessão, dependências/lockfile inalterados.
Testes usam respostas controladas; não equivalem a backend vivo.
Ensaio visual não executado: Browser Use recusou acesso à origem local
http://127.0.0.1:5317. Nenhum contorno da recusa foi realizado. Homologação visual,
tecnologia assistiva e UI-RIO continuam pendentes. Sem merge/deploy/infraestrutura.
