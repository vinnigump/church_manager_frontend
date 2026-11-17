# Recepção — interface real

Consome backend187/V35 integrado em f8e3e76. Rotas `/recepcao` e `/recepcao/igrejas/:churchId`; descoberta/autorização BADGE_MANAGE por igreja, sem grants inferidos. Navegação principal mantém cinco destinos aprovados: Início, Pessoas, Eventos, Ministérios, Recepção. Minha conta permanece no cabeçalho com estado ativo e saída preservada.

Uma área oferece Entregar, Devolver/registrar perda e Crachás/QR. Entrega: pesquisa pessoa associada (pode não ter conta), escolhe ministério/departamento ativo, lê crachá e confirma pessoa/local/crachá. Devolução lê QR e confirma recolhimento da entrega específica. Perda exige revisão e confirmação explícita, inclusive pela lista de pendentes; explica encerramento/bloqueio do QR. Nenhuma presença de evento/escala é presumida.

Resumo utiliza dia/fuso/referência do servidor, distingue entregas do dia e pendências antigas. Lista paginada de entregas abertas permanece na área. Mudanças não expiram à meia-noite nem reabilitam perdido. Não oferece correção/exclusão ou efeitos novos em trilhas/membresia.

Entrada inicial: leitor USB que preenche o campo como teclado ou código colado, seguido de confirmação. **Câmera não implementada**. QR físico é gerado localmente com qrcode-generator2.0.4 (MIT, sem dependências adicionais), contendo somente UUID do crachá. SVG pode ser baixado para impressão; nenhuma imagem/dado é enviado a serviço externo. Fonte primária: https://github.com/kazuhikoarase/qrcode-generator.

Cliente usa paths relativos ao ApiClient, projeta/valida IDs, igreja, páginas, resultados e contadores. RequestId permanece na tentativa de entrega; fechamento usa ID específico. Escopo de sessão por objeto da conta/contexto remonta campos e aborta pedidos. Durante POST, controles de atualização, paginação, escolhas e operações ficam bloqueados. Resultado ambíguo impede nova mutação no formulário até atualização explícita. Alterar código invalida a leitura anterior.

Build TypeScript/Vite e lint locais aprovados. Expectativa existente da navegação foi ajustada, sem criar teste unitário. Nenhum unitário novo/executado localmente conforme instrução. Não realizado E2E, leitor/crachá físicos, teste assistivo ou passagem real de meia-noite/DST. Backend teve smoke real de serviços/banco próprio documentado no PR187; não equivale a teste visual desta interface. CI existente preservado.
