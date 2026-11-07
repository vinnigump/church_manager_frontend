# FE-01 — consulta de fontes de delegação

Contrato delegations-v1 1.1.0, DelegationController e DelegationReadService
conferidos em backend origin/master 667250f. Listagem exige
security:assignment:manage/DENOMINATION. Detalhe também admite conta/pessoa ativa
nomeada na própria fonte, com filtro tenant/id/delegatee no servidor, inclusive
histórico revogado. Esse acesso pessoal não concede gestão denominacional.

Rotas autenticadas /seguranca/denominacoes/:denominationId/delegacoes e
/delegacoes/:delegationId. A lista é protegida por ResourceAccess; acessível pela
listagem central de atribuições. Detalhe usa GET autorizado pelo servidor; não é
precedido por uma exigência fictícia de gestão central que bloquearia o delegado.
Link para lista completa tem guarda opcional central separada. Não enumera fontes
próprias ou permite introduzir UUIDs manualmente; descoberta continua pendente.

DTOs projetados/validados: UUIDs, revisão segura, estado não vazio, instantes reais,
fim nullable, paginação e duplicatas; detalhe deve ter identidade solicitada.
Não são consultadas APIs técnicas globais para inventar nomes do delegado/perfil.
Datas UTC e intervalo inclusivo/exclusivo explícitos. Estado e metadados não são
prova de fonte vigente/operacional, nem dão direito a concessão ou redelegação.

Lista/detalhe têm loading, erro sanitizado, vazio e atualização; página vazia
permite retorno. Respostas antigas são descartadas por efeito/contexto/sessão.
Lista reautoriza por foco via guarda; detalhe pessoal reconsulta pelo botão
Atualizar fonte de delegação, sem alegar monitoramento de autorização em tempo real.
Sem comandos neste incremento. Criação/revogação têm contrato próprio e não são
declaradas ausentes no backend. Não se oferece ação local só por conhecer uma fonte.

Papéis sequenciais pelo mesmo agente. Revisão conferiu diferença entre autorização
de lista/detalhe, negação por padrão, ausência de inferência de gestão e vazamento
de proprietário em 404. Lint/typecheck/501 testes (14 novos sobre base 487)/build/
diff --check passaram. npm ci nesta sessão, lockfile intacto. Testes controlados;
backend vivo/visual/AT pendentes. Browser Use recusou origem local, sem contorno.
Não homologa UI-RIO. Sem merge/deploy/infraestrutura.
