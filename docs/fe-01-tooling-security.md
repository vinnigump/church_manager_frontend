# FE-01 — atualização das ferramentas de verificação

## Implementador

Atividade independente das APIs de Eventos, na branch `chore/fe-01-test-tooling-security`, baseada em `origin/main` 9a6b75e após merge humano do PR #14. Issue #1 e comentários consultados; sem comentários adicionais. Papéis e instruções do repositório lidos. Backend ainda não publica APIs operacionais EP-02 em diante; nenhum contrato de negócio foi alterado ou presumido.

O lockfile anterior reportava 10 alertas no npm audit: 8 moderados e 2 críticos, envolvendo Vitest/tinypool e minimatch. A manutenção atualiza Vitest 3.2.7 → 5.1.0 e explicita o piso typescript-eslint 8.72.1 (versão já resolvida na base). Requisitos publicados no registro npm consultados: Vitest 5 aceita Node 24 e Vite 7. Não foi usado `npm audit fix --force`, override transitivo ou alteração de dependências de produção.

Os dois alertas críticos e o alerta do mocker desapareceram da árvore resolvida. Restam sete registros moderados ligados ao minimatch 10.2.6 da cadeia typescript-eslint. A sugestão automática envolve downgrade da ferramenta; não foi aplicada sem evidência de compatibilidade. Não declarar auditoria global limpa nem ausência absoluta de riscos.

## Testador

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 105 testes passaram sob Vitest 5.1.0, seis arquivos.
- `npm run build`: passou com Vite 7.3.7; mesmos tamanhos/assets da base verificada.
- `npm audit`: zero críticos/altos, sete moderados de desenvolvimento; saída não zero pelos alertas restantes.
- Reinstalação `npm ci` e auditoria de produção verificadas antes da publicação.

Não foram criados testes que apenas espelham a alteração do package.json; a suíte real existente exercita regressões. Não executado ensaio de exploração nem validação contra backend vivo. Os alertas são evidência da auditoria de pacotes, não prova de exploração.

## Revisor

Revisão sequencial dos papéis, sem três processos independentes. Diff restrito a package.json, lockfile e relatório. Nenhum componente, credencial, autenticação, contrato HTTP ou fluxo de menores foi alterado.

Parecer: **APROVADO COM RESSALVA dos sete alertas moderados remanescentes na cadeia de lint**. Sem achado crítico/alto introduzido. Migração major do runner validada pela suíte completa em Node 24; CI Linux deve confirmar reprodução. Manter os registros históricos anteriores como evidência das respectivas entregas.

Sem merge/deploy. Reavaliar PRs anteriores ao concluir; seguir outra atividade independente enquanto este aguarda revisão.
