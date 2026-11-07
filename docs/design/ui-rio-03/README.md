# UI-RIO-03 — Acesso centralizado e Minha conta

Refs #30. Base: main `ca29aff` (após auditoria #46). O usuário apontou que o login estava à esquerda e autorizou continuar o desenvolvimento. Identidade e composições de acesso já estavam aprovadas na #30. A #28 está integrada nesta base. Por prioridade expressa do usuário, esta entrega aplica o acesso sobre o shell atual; a reorganização geral dos menus da #29 permanece separada.

Antes do PR, integrada main `29cb852` (revogação delegada #47), sem conflitos. Rotas e funcionalidades dessa entrega preservadas. Verificações completas repetidas após a integração.

## Implementador

O cartão herdava o posicionamento à esquerda do conteúdo e não existia um contêiner que centralizasse a composição. Agora `/entrar` recebe `app-content--access`, com espaço flexível abaixo do cabeçalho e uma grade centralizada. Desktop tem texto de apresentação e cartão nas duas colunas aprovadas; até 768 px mostra somente o cartão, centralizado horizontal e verticalmente no espaço disponível. Em telas baixas o conteúdo cresce com a página, sem ficar atrás do cabeçalho. `min-height: 100svh` permite rolagem quando necessária.

O conjunto desktop — não o cartão isolado da coluna direita — é centralizado, conforme a composição aprovada. Minha conta apresenta o login real, saída e o link de alteração da própria senha já existente na main. Não infere nome, perfil, igreja ou permissão da conta. `h1` permanece “Entrar” para conservar identificação da rota/acessibilidade; a saudação aparece acima dele.

`LoginPage.tsx` e `AccountPage.tsx` foram extraídos de App.tsx para reduzir conflitos com adições de rotas. A marca e o shell existentes são reutilizados. `access.css` delimita os estilos do acesso/conta; não altera cartões ou formulários de Segurança/Eventos. O layout raiz usa altura mínima e o main recebe largura total com margens verticais explícitas para não centralizar páginas de domínio inadvertidamente.

Mostrar/ocultar senha é botão `type=button`, com nome acessível, `aria-pressed` e `aria-controls`; não envia o formulário. A senha volta ao modo oculto ao enviar e ao encerrar a tentativa, e o formulário continua sendo limpo. Ref de tentativa impede submissão duplicada, inclusive disparos de submit antes da atualização visual de busy. Não há persistência de valores ou do estado de visibilidade.

Preservados Basic em memória, cookies/CSRF, geração de sessão, retorno ao caminho interno, guardas e avisos de sessão expirada/senha alterada/resultado incerto. Não altera auth/API client, contratos, permissões ou dependências. Logout é chamado sem evento como argumento. Sem OTP, seletor de igreja, recuperação de senha ou campos fictícios de perfil. A rota `/conta/senha` e suas funcionalidades já integradas continuam disponíveis.

Arquivos de produto: App.tsx, LoginPage.tsx, AccountPage.tsx, access.css, style.css e tokens.css. Contratos reconsultados: README, auth/client atuais, OpenAPI identidade local 0.3.0. Nenhum contrato novo necessário.

## Testador

Windows, Node 24.22.1 e npm 12.2.2 externo temporário. `npm ci` reproduzido nesta sessão; package/lockfile preservados. Sete alertas moderados preexistentes de ferramentas; nenhuma atualização de dependências nesta entrega.

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 28 arquivos, **571 testes aprovados** após integração de #47, incluindo cinco novos casos desta demanda (rodada inicial: 563 testes).
- `npm run build`: aprovado.
- `git diff --check`: aprovado.

Inicialmente typecheck/build apontaram opção `exact` incompatível em dois seletores do novo teste; removida a opção desnecessária e verificações repetidas com sucesso. A suíte de execução já estava aprovada. Os testes novos cobrem alternância sem submissão, envio duplicado, ocultação/limpeza após falha, os dois avisos de senha e saída/alteração de senha da conta. A suíte existente cobre retorno após login, sessão antiga, JSON/contratos inválidos, 401, guardas e domínios.

### Navegador

Chrome headless, Playwright externo ao aplicativo; API GET interceptada com fixtures sintéticas. Nenhuma escrita ou backend real. Sete larguras: 320, 360, 390, 768, 1024, 1440 e 1920 px.

- Centro horizontal do conjunto a até 1 px do centro da página; centro vertical a até 1 px do centro da área disponível do main.
- Até 768 px, cartão centralizado e coluna de apresentação oculta; campos de 16 px ou mais; sem overflow horizontal.
- Entrada por Enter leva ao destino protegido original; mostrar/ocultar senha preserva valor e não envia.
- Minha conta, link Alterar minha senha e saída reais testados em todas as larguras, sem perda de rotas.
- 390×500: cartão não sobrepõe cabeçalho, conteúdo acessível por rolagem. Falha 401 mostra erro e limpa senha; zoom CSS 200% sem overflow.
- Sem `pageerror`. [Resultados](browser-results.json).

Foram abertas e inspecionadas as capturas [desktop 1920](login-1920.png), [mobile 390](login-390.png) e [Minha conta desktop](account-1440.png). Também disponíveis [login 1440](login-1440.png), [conta mobile](account-390.png) e [erro mobile](login-error-390.png). Contorno de foco do main preservado após navegação; não é borda decorativa.

Reprodução opcional: Vite em `127.0.0.1:4189`, Chrome instalado e Playwright disponível externamente. Executar `node docs/design/ui-rio-03/browser-check.cjs`; usar `RIO_PLAYWRIGHT_PATH` para indicar módulo externo quando necessário. Não adiciona dependência de produção. Não houve ensaio em Safari/iOS, aparelho físico, teclado virtual ou leitor de tela. Zoom CSS não equivale a homologação de zoom nativo em todos os navegadores.

## Revisor

Revisão sequencial no mesmo agente, sem alegação de revisão independente. Conferidos escopo, diff de rotas preservadas, isolamento CSS, comportamento do botão de senha, ausência de storage ou novos requests, limpeza de credenciais, saída sem argumento e limites de tela. Parecer: APROVADO COM RESSALVAS para PR em rascunho, pendente de revisão humana e homologação real descrita. CI remota deve ser consultada no commit do PR. Sem merge/deploy e sem iniciar automaticamente outra issue.
