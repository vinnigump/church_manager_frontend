# UI-RIO-07 / #6 — avisos isolados de autorização e presença

Fatia visual aprovada de #6, executada sob o objetivo atual de desenvolver backlog
aprovado. Referência rio-participacao.html na branch documental
origin/codex/ui-rio-planejamento-v1, commit8ddfd6b080914530a6bc226f56007d721cfdd01f.
Base b8096d5 inclui identidade, shell e acesso integrados externamente. Não depende
do PR de apresentação de inscrições #50.

ParticipationNotices mantém modelos/validações/regras e recebe cartão RIO/raio17,
avisos textuais e regiões nomeadas separadas Autorização e Presença. Ordem semântica
preserva inscrição, autorização, presença e limite da informação. Pendência/rejeição/
revogação continuam bloqueando participação sem cancelar inscrição. Autorização
registrada não se transforma em permissão; presença informada continua dependendo
do backend para atualizar Trilhas. OPEN_EVENT não cria regiões nominais.

CSS específico, grid flexível com minmax(min(100%,16rem),1fr), quebra de texto e
tokens integrados. Atenção #77510b/#fff4dc vem do design aprovado; avisos não dependem
só de cor. Combinações declaradas têm contraste calculado6,48 (atenção),6,90 (registro),
4,92 (auxiliar/branco) e7,86 (erro/branco), sem alegar medição do layout renderizado.

Sem API, storage, QR, documento, dados de responsável ou ação de autorização/check-in.
Dados de contexto anterior são removidos como antes. Componente continua fora das
rotas de produção. RegistrationViews não foi alterado neste incremento.

Prévia de desenvolvimento com o componente real:
docs/design/ui-rio-07/participation-preview.html, que carrega
src/previews/ParticipationPreview.tsx. Com Vite de desenvolvimento, abrir esse
caminho apenas em navegador/ambiente autorizado. A prévia declara dados sintéticos,
oferece controles de demonstração e não autentica, chama API nem grava informação.
Não é rota do aplicativo e não integra a entrada de produção. Inclui pendência,
registro, presença validada, rejeição/revogação, espera, check-in desabilitado,
ausência informada, evento aberto, loading/erro/indisponível. Nenhum cenário libera
uma operação real. Não foi aberta no navegador nesta sessão.

Papéis sequenciais pelo mesmo agente. Dois testes semânticos novos verificam
regiões separadas e ausência dessas regiões para evento aberto; regressões cobrem
contexto/sujeito, estados, privacidade e ausência de ações/rede/storage. Lint,
typecheck,580 testes (2 novos sobre578),build,diff --check passaram. Build Vite
isolado write:false confirmou JS/CSS do componente e da prévia; build de produção
e busca dos imports/marcador confirmam que a prévia não foi incluída no aplicativo.
npm ci nesta sessão, lockfile intacto. Sem testes que apenas reproduzem CSS.

Homologação visual/teclado real/zoom/matriz de larguras/AT pendente. Browser Use
recusou origem local por permissão salva/política mesmo após nova tentativa
explicitamente autorizada; nenhum contorno foi realizado. A prévia facilita
validação humana/ambiente autorizado, não substitui evidência visual. Sem declarar
DoD visual concluído, merge, deploy ou mudança de infraestrutura.
