# Questionários — interface v4, rodada03

Issue backend68/mestre64. Backend178 integrado191b5e1 antes desta implementação.
Entrada secundária Minha conta → Meus questionários; rotas /questionarios.
Não acrescenta privilégios ou menu principal.

## Escopo
- Contextos próprios via GET questionnaires/my-contexts, independentes de grants
  administrativos. Lista disponível, iniciar/retomar por clique, respostas próprias,
  rascunho e envio; múltipla escolha/texto/escala/VF. Versionamento original preservado.
- Etapa de trilha usa /questionarios/igrejas/:churchId/responder/:versionId
  com query taskInstanceId=UUID. Requisito validado novamente no servidor; sem
  inferir aprovação por clique ou fabricar resposta em dispensa administrativa.
- Gestão por QUESTIONNAIRE_MANAGE: criar rascunho completo, editar, disponibilizar,
  criar nova versão e consultar histórico. Publicadas preservadas.
- Nota0..100/pesos iguais; mínima opcional; tentativas padrão1 ou ilimitadas
  explícitas. Informativas sem gabarito obrigatório.
- Respostas alheias dependem QUESTIONNAIRE_RESPONSE_READ; correção de textos
  exige adicionalmente QUESTIONNAIRE_GRADE. GRADE isolada não abre respostas.
- Exportação mínima CSV sob QUESTIONNAIRE_EXPORT separada. ApiClient aceita
  representação text opcional, mantendo Basic/CSRF/no-store/isolamento de sessão.
- Gabarito/devolutiva só conforme flags e dados do servidor; não calcula notas
  localmente. Estado SUBMITTED com mínima aguarda avaliação; sem mínima o envio
  satisfaz etapa mesmo com texto pendente, conforme backend.
- Erro de escrita bloqueia repetição automática. Conferência/recarregamento
  explícitos; dados em memória, sem storage ou logs de respostas.

## Verificação e limites
Lint e build/typecheck executados; evidências em output/parallel_mvp/round03/
organization no workspace. Sem unitários novos/locais por orientação do usuário;
CI existente preservado. Sem execução visual ou teste funcional integrado nesta
fatia; não declarar homologação de percursos ou aceite por compilar.

Somente igrejas locais, conforme API178. Reavaliação final, anonimato, encerramento
operacional de ilimitadas e questionários denominacionais fora deste recorte.
Parecer independente root e CI pendentes. Issue68 não concluída por este PR.
