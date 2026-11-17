# Inscrição pública de visitantes

Gestão do evento → Inscrição sem cadastro prévio permite habilitar explicitamente o formulário público e copiar seu endereço. Disponibilidade, audiência, prazo, idade e capacidade são conferidos no backend.

Formulário público separado da sessão administrativa. Cria nova pessoa visitante e inscrição; não reivindica cadastro existente, não registra presença nem cria membresia. Link individual de primeiro acesso entregue somente na primeira resposta. Repetição usa o mesmo requestId e os mesmos dados; não permite editar uma solicitação de resultado incerto nem expõe outro token.

Visitante com conta continua restrito a eventos públicos. Em caso de CPF já cadastrado ou resultado rejeitado, orientar acesso existente/equipe sem divulgar cadastro.

Validação local: lint e build passaram. Integração exige backend V40; validação integrada em andamento.
