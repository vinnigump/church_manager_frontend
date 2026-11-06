# Execução Codex — Eventos Frontend

## Referências
- Repositório backend: https://github.com/vinnigump/church_manager
- Backlog backend EVT-001..EVT-032; plano PR #55; configuração de agentes PR #56.
- Frontend issues [#4](../../issues/4) catálogo e calendário, [#5](../../issues/5) inscrições, [#6](../../issues/6) menores e presença.
- O README atual documenta autenticação Basic em memória e ausência de contrato de capacidades completo. Não contornar.

## Sequência sugerida
1. **Preparação:** inspecionar componentes existentes, contratos OpenAPI do backend e bloqueios. Não modificar API para adequar mocks.
2. **Issue #4:** catálogo, calendário e ocorrências quando contratos backend EP-02/03 estiverem disponíveis.
3. **Issue #5:** inscrições, capacidade e lista de espera após backend EP-04/05.
4. **Issue #6:** responsáveis/menores, autorizações e check-in após backend EP-06/07.
5. Testador valida componentes, integrações reais e fluxos negativos.
6. Revisor confere arquitetura, segurança, UX e critérios de aceite.
7. Humano aprova PR; **sem merge automático**.

## Regras de domínio
- Publicação independente da janela de inscrição.
- OPEN_EVENT sem inscrições ou presença nominal; REGISTRATION_REQUIRED com check-in opcional.
- Modo de participação e check-in imutáveis após primeira publicação.
- Autorização pendente de menor ocupa vaga, mas bloqueia participação; revogação não cancela inscrição.
- Uma ocorrência multi-dia possui um check-in único.
- Link online protegido por política; nunca expor link restrito em listagem pública.
- Não criar gestão de locais físicos nem presença de voluntários.

## Definition of Done
- [ ] Contratos reais verificados
- [ ] UI responsiva e acessível com estados de erro/loading/vazio
- [ ] Testes unitários e de componentes
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` com resultados reais
- [ ] Revisão de permissões e privacidade
- [ ] PR draft e aprovação humana pendente
