# Gestão local de unidades

Depende de backend184/V37 integrado antes deste frontend. Entrada secundária em
Ministérios; descoberta por MINISTRY_UNIT_MANAGE, sem IDs digitados. Catálogo da
própria denominação, habilitação local, lista de ministérios e criar/renomear
departamentos. Integrantes continuam no fluxo existente.

DTOs correlacionados à igreja/ministério; revisão na edição; UUID da criação
permanece estável em retry após resultado incerto. Controles de consulta/paginação
bloqueados durante escrita. Dados descartados na troca da sessão. Sem alteração
de membresia, liderança, catálogo denominacional ou concessões.

Lint e build iniciais passaram; rotas finais, revisão independente e CI pendentes.
Sem testes unitários novos ou execução local nesta fase. Não integrar antes184.
