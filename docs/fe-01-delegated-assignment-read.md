# FE-01 — atribuições por fonte de delegação

Contrato revalidado: assignments-v1 1.2.0, AssignmentController,
AssignmentReadService e política compartilhada DelegationScopePolicy do backend
origin/master 667250f. O incremento 1.2 libera leitura delegada; relatórios anteriores
de 1.1 continuam históricos. Lista local exige delegationId; servidor verifica conta
e pessoa ativas, fonte nominativa vigente, perfil publicado/ativo/catálogo delegável
e unidade contextual. Retorna somente atribuições criadas pelo ator nessa fonte,
perfil e unidade. No caminho central, o mesmo parâmetro filtra a fonte sem limitar
os resultados ao criador. Detalhe deriva a origem da atribuição no servidor.

Rotas autenticadas /seguranca/denominacoes/:denominationId/delegacoes/:delegationId/
atribuicoes e /atribuicoes/:assignmentId. Sem exigência local fictícia de gestão
central: autorização vem do GET real. A lista central já existente mantém sua guarda.
Detalhe central oferece acesso por uma fonte persistida presente no DTO. Não existe
formulário de UUID, descoberta fictícia ou uso de identidades técnicas globais.
Após integração externa de #43, a base foi atualizada para 11b458a e o detalhe da
fonte passou a oferecer ligação à lista contextual, inclusive para o próprio delegado.
Não é importado código não integrado de outro PR.

API reaproveita parser/paginação, exige fonte UUID antes de qualquer rede e nunca
cai silenciosamente em consulta sem filtro. Cada item/detalhe deve corresponder à
fonte solicitada; identidade do detalhe também é validada. Nenhuma propriedade
assignedBy é inventada no DTO: a prova de autoria pertence ao servidor.

Telas paginadas, vazio, erro sanitizado, atualização, metadados UTC e indicação de
que estado/vigência não comprovam autorização efetiva. Reconsulta ao foco oculta
dados anteriores até novo GET; falha de fonte expirada/revogada remove os registros.
Troca de contexto descarta resposta antiga. Sem comandos, inferência de capacidade,
redelegação ou promessa de acesso permanente por conhecer o identificador da fonte.

Papéis sequenciais pelo mesmo agente. Revisão conferiu filtro obrigatório,
isolamento, negação pelo servidor e ausência de novas políticas locais. Validação:
lint/typecheck/498 testes (11 novos sobre base 487)/build/diff --check passaram.
Após rebase e teste de navegação desde a fonte própria: lint/typecheck/513 testes
(12 novos sobre base 501)/build/diff --check passaram.
Após integração externa de #42, nova conciliação em dce6cd7 preservou também a
revogação de atribuições (rota, link e comando), sem mudanças em sua política.
Lint/typecheck/526 testes/build/diff --check passaram na base combinada.
Nova base fcecd85 após integração externa da identidade #40: preservados Brand,
classes do layout e estilos integrados. Lint/typecheck/526 testes/build/diff --check
passaram; isso não substitui ensaio visual das novas telas.
Base final 992023b após integração externa de #45: preservados revogação de fonte,
guarda central e hook compartilhado. Lint/typecheck/540 testes/build/diff --check
passaram com os 12 testes deste incremento e as regressões integradas.
Corrigida sincronização de um teste existente de senha: título é atualizado por
efeito após redirecionamento, portanto a asserção agora aguarda o título esperado.
Não foram relaxadas verificações do fluxo nem alterada regra de produto.
npm ci nesta sessão, lockfile intacto. Testes controlados, backend vivo/visual/AT
pendentes. Browser Use recusou origem local, sem contorno. Não homologa UI-RIO.
Sem merge/deploy/infraestrutura; os resumos locais não rastreados foram preservados.
