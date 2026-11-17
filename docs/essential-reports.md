# Consultas essenciais

Entrada secundária em Minha conta; igrejas descobertas por REPORT_VIEW. Sem novo
menu principal. Tipos: pessoas, membros, integrantes ministeriais, atuações por
período e crachás a recolher. Tabelas paginadas com filtro de nome e período no
fuso da igreja; não apresentam ranking nem somam previsão com presença real.

Depende de backend188/V38 integrado. Não expõe documentos, contatos, nascimento,
respostas ou detalhes de eventos. Parser projeta apenas colunas autorizadas;
respostas correlacionadas à igreja/tipo/período/página; troca de sessão descarta
dados. Lint/tipos/build iniciais passaram; ajustes finais, revisão e CI pendentes.
Sem novos testes unitários ou execução local nesta fase.
