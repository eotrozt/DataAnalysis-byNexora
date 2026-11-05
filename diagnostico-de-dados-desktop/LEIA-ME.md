# Nexora Insight — demonstração desktop

Interface atualizada com a identidade Nexora: grafite, ciano, superfícies escuras e navegação lateral. A visão executiva reúne a base de cálculo, indicadores, distribuição, série temporal (quando disponível) e achados do motor original.

## Entrar e testar

A tela inicial tem o botão **Entrar em demonstração**. Não exige conta ou senha e não implementa autenticação. **Sair da demonstração** reinicia a interface e descarta os dados da sessão em memória.

O aplicativo começa sem dados. Importe CSV, TSV, TXT ou Excel, cole uma tabela ou escolha **Explorar exemplo sintético**. O exemplo continua identificado como fictício. Após a importação, as configurações recolhem para dar espaço aos resultados; use **Importar base** ou **Importação e configurações** para reabri-las.

## Desenvolvimento

```sh
npm ci
npm start
```

Para visualizar apenas a interface, após `npm ci`, abra `app/index.html` no navegador. A fonte e o leitor de Excel são copiados localmente pelo postinstall. Não são necessários serviços externos.

## Testes de interface

```sh
npx playwright install chromium
npm test
```

Se já houver Chromium instalado, use `CHROMIUM_PATH=/caminho/do/chromium npm test`. Em Linux, o teste detecta `/usr/bin/chromium` automaticamente. O teste usa um servidor temporário em loopback e verifica entrada, estado vazio, exemplo, abas, importação de texto e Excel com múltiplas planilhas, deduplicação, filtros, saída e ausência de rolagem horizontal em 390 px. `SCREENSHOT_DIR=/pasta npm test` salva capturas opcionais.

## Instalação desktop e distribuição

As instruções originais abaixo continuam aplicáveis. O nome de produto para os próximos pacotes é **Nexora Insight**. Instaladores não foram gerados nesta alteração.

---

# Diagnóstico de Dados (app de desktop)

Aplicativo de análise de dados que roda no seu computador, **sem internet**. Os dados que você carrega nunca saem da sua máquina.

Este projeto gera o instalador. O programa em si já está pronto em `app/index.html`.

## O que você precisa

- **Node.js 18 ou mais novo** (gratuito, em nodejs.org). Para conferir: abra o terminal e rode `node -v`.
- Internet **somente na primeira vez**, para baixar as dependências. Depois o app funciona offline.

## Como gerar o instalador

Abra o terminal dentro desta pasta e rode:

```
npm install
npm run dist
```

O instalador aparece na pasta `dist/`:

| Sistema | Arquivo gerado |
|---|---|
| Windows | `Diagnóstico de Dados Setup 1.0.0.exe` (instalador) e uma versão portátil `.exe` |
| macOS | `Diagnóstico de Dados-1.0.0.dmg` |
| Linux | `Diagnóstico de Dados-1.0.0.AppImage` |

**Importante:** cada instalador precisa ser gerado no próprio sistema. O `.exe` sai de um Windows, o `.dmg` sai de um Mac. Se você só tem um computador, use a opção do GitHub abaixo.

## Só quero testar antes de instalar

```
npm install
npm start
```

## Gerar os três instaladores sem ter os três computadores (GitHub)

1. Crie um repositório no GitHub e envie o conteúdo desta pasta (incluindo `.github`).
2. No repositório, abra **Actions > Gerar instaladores > Run workflow**.
3. Quando terminar, baixe os instaladores em **Artifacts**, no fim da página da execução.

## Avisos de segurança ao instalar

Os instaladores **não são assinados digitalmente** (a assinatura exige um certificado pago). Por isso:

- **Windows:** o SmartScreen pode mostrar "O Windows protegeu seu PC". Clique em **Mais informações > Executar assim mesmo**.
- **macOS:** se o sistema bloquear a abertura, clique com o botão direito no app, escolha **Abrir** e confirme.

## Como funciona o offline

O comando `npm install` baixa o leitor de Excel (`xlsx`) e a fonte Manrope e os copia para `app/vendor/`. O app não faz nenhuma conexão de rede: a página bloqueia isso por política de segurança.

## Atualizar o app depois

Se você receber uma nova versão do `index.html`, substitua `app/index.html` mantendo estas duas linhas, que apontam para os arquivos locais:

```
<link rel="stylesheet" href="vendor/fonts.css">
<script src="vendor/xlsx.full.min.js"></script>
```

Depois rode `npm run dist` de novo.

## Estrutura

```
main.js            janela do app (Electron)
app/index.html     o aplicativo
app/vendor/        fonte e leitor de Excel (criado pelo npm install)
scripts/vendor.js  copia as dependências para app/vendor
build/icon.png     ícone
package.json       configuração e scripts
```
