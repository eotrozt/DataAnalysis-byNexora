# Nexora Insight

Análise local de planilhas com diagnóstico de qualidade, correções por confirmação, histórico, gráficos e relatórios PDF/Excel.

## Executar

```sh
cd diagnostico-de-dados-desktop
npm ci
npm start
```

Acesso direto, sem login. O original é preservado; duplicatas e atípicos não são excluídos automaticamente. Leia o [guia de uso, limites e testes](diagnostico-de-dados-desktop/LEIA-ME.md).

## Download

[Baixar projeto ZIP](downloads/nexora-insight-1.1.1.zip) — abra o arquivo e clique em **Download raw**. O ZIP inclui os recursos locais de fonte e Excel. Na versão 1.1.1, extraia todo o ZIP e abra `app/index.html` diretamente no navegador. Não é necessário instalar Node.js para esse modo. Para o aplicativo Electron, siga os comandos acima.

## Visão Geral

![Dashboard Nexora Insight](docs/dashboard.png)

O exemplo exibido é sintético e não representa uma empresa.

[Relatório PDF de exemplo](docs/relatorio-exemplo.pdf) · [Alterações, testes e limitações](docs/VALIDACAO.md)
