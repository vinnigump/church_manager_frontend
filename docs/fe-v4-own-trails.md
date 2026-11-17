# FE-V4-OWN-TRAILS — Minhas trilhas

Issue canônica frontend #2 (Minha Jornada), backend #67/mestre #64.
Pré-requisito: backend #171 integrado em 2bb6a31747ed27589ae5d375890d1951971426a7.
Contrato: own-trails-v1 1.0.0. Branch codex/v4-work-items-ui, base 52f88b12919de22c1bffd13d8e3d7b97ffdcf695 (Organização #110 integrada).

## Entrega

Atalho Minhas trilhas no Início; lista paginada de percursos próprios com igreja,
estado e contadores persistidos; detalhe com etapas e estado. Sem novo menu
principal nem seletor de pessoa/igreja. Só GETs self, nenhum titular no payload.
Nomes/tipos vêm do catálogo atual; não são apresentados como snapshot imutável.
SKIPPED é registro anterior, não inferido como dispensa válida. Sem percentual
inventado, botão de conclusão fictício ou aprovação final da secretaria.

Dados são validados/projetados antes de exibir. Campos extras privados não se
propagam. Sessão/rota/foco cancelam e descartam respostas anteriores. Autoridade
final continua no backend. Não há cadastro de credenciais em storage.

## Critérios técnicos

| ID | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| CA-01 | Atalho real abre lista/detalhe próprios | PASSOU | OwnTrailPages.test.tsx |
| CA-02 | Vazio/erro/paginação e estados sem escrita | PASSOU | OwnTrailPages.test.tsx |
| CA-03 | Nova sessão/foco descarta respostas anteriores | PASSOU | OwnTrailPages.test.tsx |
| CA-04 | Validação de dados/contexto e minimização | PASSOU | own-trail-api.test.ts |

npm ci, lint, typecheck e build aprovados. Suíte conjunta após rebase: 1537 testes aprovados em 67 arquivos, zero falhas. CI final no PR.
Testes de componente/cliente usam transporte simulado; não equivalem a E2E real
ou homologação visual. Bundle mantém aviso de tamanho já existente.
Sem deploy/reinício local. Root recebeu autorização do usuário para revisar e
integrar PRs após checks; esta frente entrega evidências e não concede aceite do
MVP inteiro. Issue #2 continua parcial. Tarefas executáveis/atribuição, motor de
avanço e questionários são próximas fatias; esta interface é consulta real.
