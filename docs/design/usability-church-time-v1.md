# Usabilidade: Brasília, igreja padrão, formulários e navegação

Decisões do usuário17/11/2026: horário de Brasília sem seletor, horas24h; escala vinculada assume período do evento; operação inclui apoios mínimos do formulário; igreja própria como padrão, escolha de outra sóquando necessária; menu lateral proposto aprovado.

## Contratos preservados
- Instantes continuam persistidos como UTC/timestamptz. Não há deslocamento/regravação em lote de dados anteriores.
- Datas civis de nascimento não são convertidas como instantes. Validações do dia civil seguem Brasília.
- Formulário usa entrada brasileira explícita e24h para não depender de AM/PM/configuração do navegador. API/adapters preservam instantes originais e microssegundos em edições sem mudança.
- Escala com evento canonicaliza início/fim no servidor sob lock. A cópia ocorre ao salvar a escala; não foi criada propagação automática de remarcações para históricos com presença.
- Apoios contextuais de criação/edição expõem só os dados necessários à operação na mesma igreja. Não há concessão automática de consulta geral, exportação, ficha completa ou outras igrejas.
- Igreja padrão: única membresia válida ACTIVE/SUSPENDED, ou associação própria única quando não há membresia. Se há associações múltiplas sem padrão inequívoco, solicita escolha contextual. Permissões/cargos não definem igreja própria. Rotas e destino reautorizam cada operação.
- Cinco áreas principais, submenus da área ativa e grupos secundários Gestão/Configurações. Legados Ocorrências administrativas/publicação de calendário não são atalhos cotidianos. Compatibilidade/histórico preservados.

## Evidência
Package backend e lint/build frontend passaram na integração. Smoke manual isolado em output/roster-usability-smoke.log: contexto próprio viaHTTP, ambiguidade/prioridade formal, Brasília com configuração legada diferente, gestor apenasMANAGE usando seletores semEVENT_VIEW, período exato/micros/retry/edição, preservação de presença e negação de consulta geral/outrocontexto. Cluster próprio encerrado. Corrigidas duas falhas preexistentes encontradas: ordenação SQL por alias dentro de lower e ausência de evento restrito marcando transação de leitura para rollback.

CI/revisão final e atualização local ainda precisam do checkpoint de integração; não declarar este documento como prova de deploy ou de teste de todas as variantes visuais.
