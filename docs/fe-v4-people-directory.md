# Pessoas — pesquisa contextual mínima

Backend176 integrado em b6f6c8b62948ff788d8fea5c13eb60ddd7f554f1.
/pessoas descobre igrejas com identity:person:contextual:read/create; lista porigreja
com pesquisa/paginação real, nome/status e membresia ACTIVE/SUSPENDED. Cadastro
reutiliza o fluxoCPF/CIN já integrado. Sem fichas sensíveis, documentos/contatos,
consulta global, edição global ou criação automática de conta/membresia.

Permissão revalidada em destino; conta/sessão diferentes descartam resultado;
carregamento/erro/vazio distintos. Projeção de campos explícita. Navprincipal ganha
Pessoas; apenas expectativa existente de quantidade de links foi atualizada.
Nenhum teste unitário novo/local. Lint/tipos/build aprovados antes do último link
simples de retorno ao cadastro; CI valida árvore final. Backend passou por revisão
cruzada e checagem manual de serviço/SQL em cluster sintético encerrado.

Referência: backend72/mestre64. Não conclui CRUD completo, E2E ou MVP.
