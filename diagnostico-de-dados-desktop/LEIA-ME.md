# Nexora Insight 1.1.1

Aplicativo desktop de análise local de CSV, TSV, TXT e Excel. A fonte Manrope, o leitor de Excel e todo o processamento ficam no dispositivo. Não há tela de login nem serviços externos de análise.

## Executar

Node.js 20 ou mais recente:

```sh
npm ci
npm start
```

Para desenvolvimento no navegador, após `npm ci`, sirva a pasta `app/`:

```sh
python3 -m http.server 4173 --directory app --bind 127.0.0.1
```

O ZIP de distribuição também permite abrir `app/index.html` diretamente por duplo clique, sem Node.js ou servidor. Desde a versão 1.1.1, essa abertura usa um Web Worker autocontido, compatível com a origem local do navegador. Extraia todo o ZIP e mantenha `app/worker-source.js` junto dos demais arquivos. No checkout Git, `npm ci` gera esse recurso automaticamente. Não é necessário desativar proteções do navegador.

## Fluxo de análise

1. **Importar base**: escolha um arquivo ou cole uma tabela com cabeçalhos. Confira os primeiros dez registros e confirme a importação. Cancelar mantém a análise anterior.
2. **Visão Geral**: confira os indicadores, a base de cálculo, as distribuições, tendências disponíveis e descobertas com evidências e limitações.
3. **Qualidade dos Dados**: investigue ausências, duplicatas, formatos mistos, datas inválidas, variações de escrita e atípicos. Um alerta não comprova erro.
4. Em **Importação e configurações**, selecione correções. Cada correção mostra a comparação antes/depois e exige confirmação. Duplicatas e atípicos são mantidos por padrão. É possível remover linhas com ausência em uma coluna, excluir colunas, aparar espaços e unificar grafias pela primeira forma encontrada.
5. Use **Desfazer última correção** ou **Restaurar base original**. O histórico mostra as operações e quantidades. A restauração é revisável e também pode ser desfeita.
6. **Explorar Dados** contém a tabela, cores por registro, estatísticas, comparações, correlações e metodologia. A navegação não altera a base nem as correções aplicadas.
7. Exporte o relatório PDF, Excel, texto ou CSV da tabela; **Baixar original** devolve o arquivo recebido sem modificações.

Selecionar outra aba de uma pasta Excel abre uma nova prévia. Confirmá-la inicia uma análise sem correções da aba escolhida; cancelar mantém a aba ativa. Importar outra base também reinicia o histórico, sem modificar o arquivo anterior no disco.

## Segurança e rastreabilidade dos dados

- O original importado fica separado da base transformada e não é escrito de volta ao arquivo de origem. Cópias são passadas ao worker, e o estado anterior só é substituído quando o processamento termina com sucesso.
- A checagem de duplicatas usa valores idênticos em todas as colunas da versão atual; espaços, tipos e separadores internos não são confundidos. Excluir colunas pode mudar quais linhas são consideradas duplicadas; confira a prévia.
- Categorias não são unificadas automaticamente. A correção explícita de unificação usa caixa, acentos e espaços para identificar equivalências e preserva a primeira grafia encontrada.
- Valores numéricos e datas são inferidos. Códigos de identificação ficam fora das métricas. Colunas mistas podem exigir correção na origem; o app não adivinha valores inválidos. A metodologia detalha decimais e datas ambíguas.
- A exclusão opcional de atípicos vale para grupos, tendências e distribuição selecionada; o perfil geral e a tabela conservam os registros. Cada resultado informa sua base. Ausências não são imputadas.
- Períodos sem registros não viram zero. A tendência não é ajustada com lacunas. Valores negativos são mantidos e exibidos em escalas com referência zero.
- Suporte amostral é uma regra prática de tamanho da amostra, não uma garantia estatística. Intervalos são aproximados; correlação não demonstra causalidade.
- A sessão é mantida em memória. Fechar ou recarregar descarta a análise; exporte o relatório antes. Não há recuperação automática nem autenticação.

## Relatórios

**PDF:** no Electron, o botão abre o diálogo de destino e salva via `printToPDF`. No navegador, abre a impressão: escolha salvar como PDF. O documento contém resumo executivo, indicadores, gráficos disponíveis, descobertas, diagnóstico, correções e limitações. O formato é A4, adequado a impressão. Documentos extensos podem ocupar várias páginas.

**Excel:** inclui Resumo, Original (valores da aba importada), Base analisada, Base da métrica, Estatísticas, Qualidade, Descobertas, Metodologia, Histórico, Registros afetados, Colunas excluídas e Células alteradas. Textos são células literais, sem execução de fórmulas. Datas podem aparecer como valores ISO importados. Para manter fórmulas, formatação e outras abas exatamente como recebidas, use **Baixar original**. Fórmulas são lidas pelo valor armazenado no Excel e não são recalculadas pelo aplicativo.

Os históricos longos mostram até cem identificadores por operação no Excel; a planilha de registros afetados lista integralmente as exclusões da versão atual. A prévia da interface é limitada a dez registros e trinta identificadores; ela não altera a quantidade analisada.

## Limites e desempenho

Limites de entrada: 50 MB, 100.000 registros, 200 colunas e 2 milhões de células por aba. Cabeçalhos vazios e registros com campos excedentes são rejeitados para evitar perda silenciosa. Linhas curtas permanecem com ausências sinalizadas. Arquivos vazios e bases sem nenhum valor são rejeitados.

Leitura de Excel/CSV, análise e geração de Excel acontecem em Web Worker com indicação de processamento e botão **Cancelar**. Limites são medidas de proteção, não uma promessa de desempenho para qualquer arquivo; memória e complexidade das colunas também importam. Foi validada uma base de 20.000 registros; não foi realizado benchmark de todos os formatos no limite máximo.

## Testes

```sh
npx playwright install chromium
npm test
npm run test:desktop
npm run test:file
```

`CHROMIUM_PATH` seleciona um Chromium já instalado; `/usr/bin/chromium` é detectado no Linux. `SCREENSHOT_DIR=/pasta npm test` salva capturas. O teste desktop usa o Electron instalado e, no Linux, Ozone em modo headless. Ele substitui apenas o diálogo de destino para verificar a geração real de PDF via preload e IPC. A seleção manual de destino e instaladores Windows/macOS devem ser conferidos nos sistemas correspondentes.

## Organização

- `app/engine.js`: tipos, estatística e preparação de dados.
- `app/processor.js`: validações, pipeline e comparação entre versões.
- `app/analysis-worker.js`: execução fora da interface.
- `app/worker-runtime.js`, `scripts/build-worker.js`: empacotamento local para abertura direta por `file://`; `worker-source.js` é gerado na instalação e incluído no ZIP.
- `app/insights.js`: evidências, recomendações por contexto e limitações.
- `app/charts.js`: histogramas e séries temporais.
- `app/reports.js`: estrutura de relatórios e exportação.
- `app/app.js`: estado da sessão, navegação, prévias e eventos.
- `app/index.html`, `base.css`, `nexora.css`: estrutura e apresentação.
- `main.js`, `preload.js`: janela desktop e exportação PDF com isolamento de contexto.

## Migração e distribuição

O pacote passou a se chamar `nexora-insight` (1.1.1), e o nome visível é Nexora Insight. O diretório legado `diagnostico-de-dados-desktop/` e o identificador de aplicativo `com.diagnosticodedados.app` foram conservados para não quebrar caminhos e identidade de instalação existentes.

```sh
npm run dist
```

Gere o pacote em cada sistema de destino ou use o workflow **Gerar instaladores** na raiz do repositório. Os artefatos saem em `dist/`. Instaladores não foram gerados nem assinados nesta alteração.
