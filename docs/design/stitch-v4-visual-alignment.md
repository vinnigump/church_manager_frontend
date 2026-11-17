# Alinhamento visual ao Stitch aprovado — v4

Problema: os percursos funcionais haviam sido implementados com apresentação genérica. Esta revisão aplica o sistema visual aprovado sem importar métricas fictícias ou regras dos protótipos.

Referências locais: Shell ac71e70f60fb4e598855d57c483922b9; Home519ee3146dda46b18052dcdd8c9362f3; Pessoas02.01 a2f882f4af444d529697b86fda01d05c; Eventos3bc5/f2049; Ministérios c5946; Recepção35f0; Grupos9288; Trilhas40dd/fbb9; Tarefas86e5; Questionários1ab6/f258; Relatórios84f4. Inventário completo em output/stitch_v4_extraido_2026-11-16/TELAS_V4.md no workspace de coordenação, fontes originais preservadas.

- Shell: cinco áreas, sidebar288px, header64px, navegação móvel inferior, foco acessível sem deslocar o conteúdo, fonte Inter distribuída localmente (OFL), paleta #00513c/#f0fcf7 e cartões brancos.
- Home: boas-vindas, eventos com data real, escalas e acessos rápidos em duas colunas no desktop; composição móvel empilhada. Sem totais inventados.
- Pessoas: cabeçalho, seleção de igreja, consulta, cadastro com seções numeradas, edição e primeiro acesso.
- Eventos: calendário Semana/Mês/Lista, dias da semana, formulários organizados, detalhe e inscrição.
- Ministérios/departamentos, integrantes, grupos e escalas: cabeçalhos/cards/abas/listas e formulários; dados/ações existentes.
- Recepção: contadores reais destacados, operação e pendências responsivas; QR e handlers preservados.
- Trilhas/tarefas: timeline vertical, progresso real, etapas e estados, editor e execução.
- Questionários, relatórios e conta: cartões, alternativas, filtros/tabela responsiva e ações existentes.

Preservados contratos HTTP, autorização, estados, idempotência, histórico, regras de nota, evidências e isolamento dos contextos. Não reproduzidos nomes, imagens de pessoas, métricas, exemplos ou automações do Stitch.

Verificação: lint/build locais; inspeção no navegador de Home/Pessoas desktop+mobile e amostras de calendário mensal, cadastro de pessoa, recepção e trilha. Largura móvel390px sem overflow global; timeline corrigida para uma coluna; busca corrigida por especificidade CSS. Capturas em output/visual_alignment no workspace. Demais telas receberam revisão de estrutura/estilos; não afirmar comparação pixel a pixel de todas as variantes. CI existente obrigatório antes do merge. Sem novos testes unitários nesta rodada.
