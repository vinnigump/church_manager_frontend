# Primeiro acesso por link

A equipe autorizada acessa Pessoas → Gerar link de primeiro acesso, seleciona uma pessoa sem conta na igreja e entrega o link individual. O titular abre /primeiro-acesso, escolhe login/senha e entra pela tela normal. Gerar um novo link invalida o anterior não utilizado; a validade é informada pela API.

Token somente em fragmento, retirado da URL após leitura e mantido em memória. Sem armazenamento persistente, envio automático, senha escolhida pelo operador, login automático ou concessão de membresia/permissões. Cliente público separado do cliente autenticado, mantendo CSRF. Resultado incerto exige conferência antes de repetir.

Validação: lint e build passaram. Backend necessário: V39. Fluxo visual/HTTP integrado ainda pendente; não representa homologação completa do MVP.
