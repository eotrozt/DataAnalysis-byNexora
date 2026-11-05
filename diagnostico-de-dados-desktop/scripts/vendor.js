'use strict';
/* Copia para app/vendor os arquivos que o app precisa para funcionar sem internet:
   o leitor de Excel (xlsx) e a fonte Manrope. Roda sozinho após `npm install`. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'app', 'vendor');
fs.mkdirSync(out, { recursive: true });

// Procura o arquivo direto em node_modules (não depende das regras de exportação do pacote).
function resolveFrom(rel) {
  const p = path.join(root, 'node_modules', ...rel.split('/'));
  return fs.existsSync(p) ? p : null;
}

// 1) Leitor de Excel
const xlsx = resolveFrom('xlsx/dist/xlsx.full.min.js');
if (xlsx) {
  fs.copyFileSync(xlsx, path.join(out, 'xlsx.full.min.js'));
  console.log('vendor: xlsx copiado');
} else {
  fs.writeFileSync(path.join(out, 'xlsx.full.min.js'), '/* xlsx não instalado: arquivos .xlsx ficam indisponíveis, CSV continua funcionando. */\n');
  console.warn('vendor: AVISO: pacote "xlsx" não encontrado. Rode "npm install". Arquivos Excel ficam desativados.');
}

// 2) Fonte Manrope (pesos usados pelo app)
const weights = [400, 500, 600, 700, 800];
let css = '/* Manrope (SIL OFL), servida localmente */\n';
let found = 0;
for (const w of weights) {
  const file = `manrope-latin-${w}-normal.woff2`;
  const src = resolveFrom(`@fontsource/manrope/files/${file}`);
  if (!src) continue;
  fs.copyFileSync(src, path.join(out, file));
  css += `@font-face{font-family:'Manrope';font-style:normal;font-weight:${w};font-display:swap;src:url('${file}') format('woff2')}\n`;
  found++;
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
if (found) console.log(`vendor: ${found} pesos da fonte Manrope copiados`);
else console.warn('vendor: AVISO: fonte Manrope não encontrada. O app usa a fonte padrão do sistema.');
