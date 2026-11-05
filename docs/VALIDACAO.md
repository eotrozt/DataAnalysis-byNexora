# Nexora Insight 1.1 — alterações e validação

## Problemas corrigidos

- Removida a entrada fictícia; navegação única em Visão Geral, Qualidade dos Dados e Explorar Dados.
- Duplicatas e registros mantidos por padrão. Importação e correções com prévia e confirmação; histórico, desfazer e restauração da base original.
- Arquivo original preservado e disponível para download sem alteração de bytes. Mudanças de aba Excel não substituem a análise até confirmação.
- Chaves de duplicatas sem colisões por separadores internos, espaços ou coerção de tipos. Cabeçalhos repetidos e nomes como `__proto__` não colidem. Identificadores numéricos não são métricas.
- Categorias distintas não são consolidadas automaticamente. Lacunas temporais não são preenchidas com zero nem usadas para ajustar tendências. Escalas temporais exibem negativos corretamente.
- Suporte amostral identificado como regra prática, limitações por descoberta e recomendações para contabilidade, advocacia e administração. Maior média não é tratada como melhor desempenho.
- Exportação PDF e Excel com diagnóstico, metodologia e rastreabilidade. Textos iniciados por `=` permanecem literais no Excel.
- Leitura, cálculos e Excel fora da interface, via Web Worker. Cancelamento e limites de entrada. Importações inválidas preservam a análise anterior.

## Arquivos e responsabilidades

- `app/index.html`, `app/base.css`, `app/nexora.css`: estrutura, acessibilidade, legibilidade, prévias e impressão.
- `app/app.js`: estado da sessão, navegação, histórico, prévias e ações do usuário.
- `app/engine.js`, `app/processor.js`, `app/analysis-worker.js`: estatística, validação, cópias de trabalho e processamento em segundo plano.
- `app/insights.js`, `app/charts.js`, `app/reports.js`: descobertas, gráficos e relatórios separados da interface.
- `main.js`, `preload.js`: exportação PDF com renderer isolado e IPC restrito à janela local.
- `package.json`, `package-lock.json`: nome Nexora Insight, versão 1.1 e comandos de teste.
- `.github/workflows/build.yml` na raiz: workflow no local reconhecido pelo GitHub, diretório de execução e instalação por lockfile.
- `tests/engine.test.cjs`, `tests/smoke.cjs`, `tests/desktop.cjs`: validações automatizadas.
- `README.md`, `LEIA-ME.md`, `docs/`, `downloads/`: uso, limites, evidências e entrega.

## Verificações executadas

1. A suíte original passou antes da alteração. O fluxo foi então adaptado às novas regras (sem login e sem exclusão automática), preservando os cenários relevantes.
2. `npm test`: **12 testes do motor passaram**, cobrindo CSV com aspas e separadores, números brasileiros, entradas vazias e inválidas, limites, cabeçalhos repetidos, duplicatas estritas, preservação do original, correções explícitas, restauração pelo original, média, mediana e desvio amostral, categorias, lacunas temporais, exportação Excel, identificadores numéricos e recuperação de colunas renomeadas excluídas.
3. A mesma execução completou o teste de interface no Chromium: importação e cancelamento, três áreas, estado preservado na navegação, opções sem exclusão automática, correções, desfazer/restaurar, erros de importação sem perda da base, Excel com múltiplas abas, exportação e leitura do Excel, comparação byte a byte do original baixado, PDF gerado e conteúdo extraído com `pdftotext`, layout de 390 px sem rolagem horizontal e análise de **20.000 registros com interface responsiva**. Sem erros de JavaScript.
4. `npm run test:desktop`: Electron iniciou a aplicação por arquivo local, executou o worker com isolamento do renderer e salvou um PDF real por preload/IPC. Apenas a escolha de destino no diálogo foi automatizada.
5. Verificação de sintaxe dos scripts, revisão de capturas e da primeira página do PDF, `git diff --check`.

## Limitações e verificações não executadas

- Não foram gerados instaladores nem testados Windows/macOS. O workflow foi corrigido no código; sua execução remota não foi acionada.
- A seleção manual de destino no diálogo nativo não foi testada; no teste, o destino foi fornecido automaticamente.
- Validada uma base de 20.000 registros; não foi realizado benchmark no limite máximo de 100.000 registros/2 milhões de células.
- Tipos e datas ambíguas continuam inferidos conforme a metodologia. Fórmulas Excel não são recalculadas; usa-se o valor salvo na planilha. O download do original conserva fórmulas, formatação e demais abas do arquivo recebido.
- Histórico e sessão ficam em memória; recarregar ou fechar descarta o estado. Exporte antes de encerrar.
- PDF do navegador usa a impressão do próprio navegador; o Electron salva diretamente após escolha do destino.
- O diretório legado e o appId permanecem por compatibilidade, apesar da padronização do nome do pacote.
