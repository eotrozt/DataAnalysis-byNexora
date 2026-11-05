const Engine = (() => {
  const MISSING = new Set(['', 'null', 'na', 'n/a', 'nan', '-', '--', 'n/d', 'nd', 'none', '#n/a', 'nulo', 's/d', 'undefined', '#valor!', '#value!']);
  const isMissing = v => v === null || v === undefined || MISSING.has(String(v).trim().toLowerCase());
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---------- parsing ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const cands = [',', ';', '\t', '|'];
    // Count separators outside quoted fields, using the header only.
    const counts = new Map(cands.map(c => [c, 0])); let quoted = false;
    for(let i=0;i<text.length;i++) { const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue}quoted=!quoted}
      else if(!quoted){if(c==='\r'||c==='\n')break;if(counts.has(c))counts.set(c,counts.get(c)+1)}
    }
    const delim=cands.reduce((best,c)=>counts.get(c)>counts.get(best)?c:best,',');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += ch;
    }
    if(q) throw new Error('Há aspas abertas sem fechamento no arquivo. Confira a exportação CSV.');
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return { rows, delim };
  }

  function parseNum(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim(); if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/^(R\$|US\$|\$|€|£)\s*/i, '').replace(/\s*%$/, '').replace(/\s/g, '');
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
    if (!/^\d[\d.,]*$/.test(s)) return null;
    const hasC = s.includes(','), hasD = s.includes('.');
    let t;
    if (hasC && hasD) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        if (!/^\d{1,3}(\.\d{3})*,\d+$/.test(s)) return null;
        t = s.replace(/\./g, '').replace(',', '.');
      } else {
        if (!/^\d{1,3}(,\d{3})*\.\d+$/.test(s)) return null;
        t = s.replace(/,/g, '');
      }
    } else if (hasC) {
      const p = s.split(',');
      if (p.length > 2) { if (!/^\d{1,3}(,\d{3})+$/.test(s)) return null; t = s.replace(/,/g, ''); }
      else t = s.replace(',', '.');
    } else if (hasD) {
      const p = s.split('.');
      if (p.length > 2) { if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null; t = s.replace(/\./g, ''); }
      else t = s;
    } else t = s;
    const n = Number(t);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  function dateParts(s) {
    s = String(s).trim();
    let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s].*)?$/);
    if (m) return { kind: 'ymd', a: +m[1], b: +m[2], c: +m[3] };
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[T\s].*)?$/);
    if (m) return { kind: 'xy', a: +m[1], b: +m[2], c: +m[3] };
    return null;
  }
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function toTs(p, fmt) {
    let y, mo, d;
    if (p.kind === 'ymd') { y = p.a; mo = p.b; d = p.c; }
    else if (fmt === 'mdy') { mo = p.a; d = p.b; y = p.c; }
    else { d = p.a; mo = p.b; y = p.c; }
    if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null;
    return Date.UTC(y, mo - 1, d);
  }

  /* ---------- estatística ---------- */
  const sum = a => { let s = 0; for (const x of a) s += x; return s; };
  const mean = a => a.length ? sum(a) / a.length : NaN;
  const sd = a => { if (a.length < 2) return NaN; const m = mean(a); let s = 0; for (const x of a) s += (x - m) ** 2; return Math.sqrt(s / (a.length - 1)); };
  const quantile = (s, p) => { if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  function describe(a) {
    const s = [...a].sort((x, y) => x - y);
    const m = mean(s), d = sd(s);
    return { n: s.length, sum: sum(s), mean: m, median: quantile(s, .5), sd: d, min: s[0], p25: quantile(s, .25), p75: quantile(s, .75), p90: quantile(s, .9), max: s[s.length - 1], cv: m !== 0 && isFinite(d) ? d / Math.abs(m) : NaN };
  }
  function ranks(a) {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0;
    while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rk; i = j + 1; }
    return r;
  }
  function pearson(x, y) {
    const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    const d = Math.sqrt(sxx * syy); return d === 0 ? NaN : sxy / d;
  }
  function fisherCI(r, n) { if (n <= 3 || !isFinite(r) || Math.abs(r) >= 1) return null; const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)]; }
  function ols(y) {
    const n = y.length, x = y.map((_, i) => i), mx = mean(x), my = mean(y); let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    const slope = sxx ? sxy / sxx : 0; return { slope, intercept: my - slope * mx, r: pearson(x, y) };
  }
  const fences = vals => {
    if (vals.length < 8) return null;
    const s = [...vals].sort((a, b) => a - b), q1 = quantile(s, .25), q3 = quantile(s, .75), iqr = q3 - q1;
    if (iqr === 0) return null;
    return { q1, q3, iqr, low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr, xlow: q1 - 3 * iqr, xhigh: q3 + 3 * iqr };
  };

  /* ---------- dataset ---------- */
  function inferCol(name, raw) {
    const idxs = []; for (let i = 0; i < raw.length; i++) if (!isMissing(raw[i])) idxs.push(i);
    const m = idxs.length;
    const c = { name, raw, missing: raw.length - m, nonMissing: m, num: null, ts: null, fmt: null };
    if (m === 0) { c.type = 'vazia'; c.uniq = 0; return c; }
    const numVals = new Array(raw.length).fill(null); let numC = 0;
    for (const i of idxs) { const v = parseNum(raw[i]); if (v !== null) { numVals[i] = v; numC++; } }
    const parts = new Array(raw.length).fill(null); let dateLike = 0, dayF = 0, monF = 0;
    for (const i of idxs) {
      if (typeof raw[i] === 'number') continue;
      const p = dateParts(raw[i]);
      if (p) { parts[i] = p; dateLike++; if (p.kind === 'xy') { if (p.a > 12) dayF++; if (p.b > 12) monF++; } }
    }
    const uniqSet = new Set(idxs.map(i => String(raw[i]).trim()));
    const uniq = uniqSet.size; c.uniq = uniq;
    const idName = /(^|[^a-z])(id|cod|codigo|código|uuid|cpf|cnpj|cep|sku|protocolo|chave)([^a-z]|$)/i.test(name);
    if (numC / m >= 0.9) {
      if (idName) c.type = 'id'; else { c.type = 'numérica'; c.num = numVals; }
    } else if (dateLike / m >= 0.9) {
      c.type = 'data'; c.fmt = monF > dayF ? 'mdy' : 'dmy';
      c.ts = parts.map(p => p ? toTs(p, c.fmt) : null);
      c.dateAmbiguous = idxs.filter(i => parts[i] && parts[i].kind === 'xy' && parts[i].a <= 12 && parts[i].b <= 12).length;
    } else {
      c.mixedNumeric=numC>0&&numC<m; c.mixedDate=dateLike>0&&dateLike<m;
      const avgLen = idxs.reduce((s, i) => s + String(raw[i]).length, 0) / m;
      if ((idName && uniq / m >= 0.9) || (uniq / m > 0.95 && m >= 20 && avgLen <= 40)) c.type = 'id';
      else if (uniq <= 50 && (uniq / m <= 0.5 || uniq <= 5)) c.type = 'categórica';
      else c.type = 'texto';
    }
    return c;
  }

  function uniqueNames(headers) {
    const used = new Set();
    return headers.map((h,i)=>{const base=String(h??'').trim()||('coluna_'+(i+1));let name=base,k=2;while(used.has(name))name=base+'_'+k++;used.add(name);return name});
  }

  /* Procura a coluna digitada pelo usuário (ignora caixa, acento e símbolos). */
  function findColumn(names, query) {
    const q = norm(query);
    if (!q) return { err: 'Digite o nome de uma coluna.' };
    const exact = names.filter(n => norm(n) === q);
    if (exact.length) return { name: exact[0] };
    const part = names.filter(n => norm(n).includes(q));
    if (part.length === 1) return { name: part[0], approx: true };
    if (part.length > 1) return { err: `"${query}" corresponde a mais de uma coluna: ${part.slice(0, 6).join(', ')}. Digite o nome completo.` };
    return { err: `Coluna "${query}" não encontrada. Colunas disponíveis: ${names.slice(0, 12).join(', ')}${names.length > 12 ? '…' : ''}.` };
  }

  /* Limpeza real: aplica os filtros e REMOVE as linhas/colunas antes de qualquer análise.
     Ordem: linhas vazias, colunas, duplicatas. */
  function prepare(headers, rows, ragged, opts) {
    rows=rows.map(r=>r.slice());
    const names = uniqueNames(headers), rawN = rows.length;
    const changes=[];
    for(const rule of opts.rules||[]){
      const j=names.indexOf(rule.col);if(j<0)throw new Error('Coluna de correção não encontrada: '+rule.col);
      if(!['drop','empty','trim','normalize'].includes(rule.action))throw new Error('Correção desconhecida.');
      if(!['trim','normalize'].includes(rule.action))continue;
      const canonical=new Map();
      for(let i=0;i<rows.length;i++){
        const before=rows[i][j];if(typeof before!=='string'||isMissing(before))continue;
        let after=before.trim();
        if(rule.action==='normalize'){const k=norm(after);if(!canonical.has(k))canonical.set(k,after);after=canonical.get(k)}
        if(before!==after){rows[i][j]=after;changes.push({row:i+2,col:rule.col,before,after})}
      }
    }
    const rules = (opts.rules || []).map(r => ({ ...r, idx: names.indexOf(r.col) }));
    const res = rules.map(r => ({ col: r.col, action: r.action, ok: r.idx >= 0, removed: 0 }));
    const cell = (i, j) => rows[i][j] === undefined ? null : rows[i][j];
    let keepRows = rows.map((_, i) => i), filterRemoved = 0;
    rules.forEach((r, k) => {
      if (r.action !== 'empty' || r.idx < 0) return;
      const before = keepRows.length;
      keepRows = keepRows.filter(i => !isMissing(cell(i, r.idx)));
      res[k].removed = before - keepRows.length; filterRemoved += res[k].removed;
    });
    const dropIdx = new Set(rules.filter(r => r.action === 'drop' && r.idx >= 0).map(r => r.idx));
    rules.forEach((r, k) => { if (r.action === 'drop' && r.idx >= 0) res[k].removed = 1; });
    const keepCols = names.map((_, j) => j).filter(j => !dropIdx.has(j));
    const outHeaders = keepCols.map(j => names[j]);
    const afterFilterN = keepRows.length;
    let dup = null, dupMetricSum = null;
    if (opts.dedupe) {
      const seen = new Set(), keep = [], extra = [];
      for (const i of keepRows) {
        const k = JSON.stringify(keepCols.map(j => cell(i,j)));
        if (seen.has(k)) extra.push(i); else { seen.add(k); keep.push(i); }
      }
      if (extra.length) {
        const mj = opts.metricName ? outHeaders.indexOf(opts.metricName) : -1;
        if (mj >= 0) { dupMetricSum = 0; for (const i of extra) { const v = parseNum(cell(i, keepCols[mj])); if (v !== null) dupMetricSum += v; } }
        dup = { extra: extra.length, pct: afterFilterN ? extra.length / afterFilterN : 0, of: afterFilterN, rows: extra.slice(0, 12).map(i => i + 2) };
      }
      keepRows = keep;
    }
    const kept=new Set(keepRows);
    return {
      headers: outHeaders, rows: keepRows.map(i => keepCols.map(j => cell(i, j))), rowNos: keepRows.map(i => i + 2), ragged,
      pre: { changes, removedRows: Array.from({length:rawN},(_,i)=>i+2).filter(n=>!kept.has(n-2)), rawN, afterFilterN, filterRemoved, dup, dupMetricSum, dropped: [...dropIdx].map(j => names[j]), totalCols: names.length, rules: res }
    };
  }

  function buildDataset(headers, rows, ragged, rowNos) {
    const names = uniqueNames(headers);
    const cols = names.map((name, j) => { const raw = rows.map(r => r[j] === undefined ? null : r[j]); const c = inferCol(name, raw); c.idx = j; return c; });
    return { cols, nRows: rows.length, rowNo: rowNos || rows.map((_, i) => i + 2), ragged: ragged || 0 };
  }

  /* ---------- análise ---------- */
  function analyze(D, cfg) {
    const N = D.nRows, A = { cfg, N };
    const now = Date.now();

    // duplicatas (linha idêntica)
    const keyOf = i => JSON.stringify(D.cols.map(c => c.raw[i]??null));
    const seen = new Map(), dupExtra = new Set();
    for (let i = 0; i < N; i++) { const k = keyOf(i); if (seen.has(k)) dupExtra.add(i); else seen.set(k, i); }
    A.pre = cfg.pre || { rawN: N, afterFilterN: N, filterRemoved: 0, dup: null, dupMetricSum: null, dropped: [], totalCols: D.cols.length, rules: [] };
    A.dup = A.pre.dup ? { ...A.pre.dup, removed: true }
      : { extra: dupExtra.size, pct: N ? dupExtra.size / N : 0, of: N, rows: [...dupExtra].slice(0, 12).map(i => D.rowNo[i]), removed: false };
    A.dupNos = new Set([...dupExtra].map(i => D.rowNo[i]));
    const idc = D.cols.find(c => c.type === 'id');
    if (idc) {
      const m = new Map();
      for (let i = 0; i < N; i++) { if (isMissing(idc.raw[i])) continue; const k = String(idc.raw[i]).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(i); }
      let keys = 0, conflict = 0;
      for (const arr of m.values()) if (arr.length > 1) { keys++; if (arr.slice(1).some(i => !dupExtra.has(i))) conflict++; }
      A.dupId = { col: idc.name, keys, conflict };
    }
    const base = []; for (let i = 0; i < N; i++) base.push(i); /* duplicatas, se pedido, já foram removidas em prepare() */
    A.base = base;

    // qualidade por coluna
    const issues = [];
    A.cols = D.cols.map(c => {
      const o = { name: c.name, type: c.type, missing: c.missing, missingPct: N ? c.missing / N : 0, uniq: c.uniq, notes: [] };
      if (c.missing > 0) issues.push({ sev: o.missingPct >= .2 ? 'alta' : o.missingPct >= .05 ? 'média' : 'baixa', kind: 'ausentes', col: c.name, count: c.missing, text: `${c.missing} linhas sem valor (${(o.missingPct * 100).toFixed(1)}%)` });
      if(c.mixedNumeric||c.mixedDate)issues.push({sev:'média',kind:'formatos mistos',col:c.name,count:c.nonMissing,text:'Há valores numéricos ou datas misturados com outros formatos. Tipo não assumido; confira a coluna antes de calcular.'});
      if (c.type === 'vazia') { o.notes.push('coluna vazia'); issues.push({ sev: 'média', kind: 'coluna vazia', col: c.name, count: N, text: 'Coluna sem nenhum valor' }); return o; }
      if (c.nonMissing > 1 && c.uniq === 1) { o.notes.push('valor constante'); issues.push({ sev: 'baixa', kind: 'constante', col: c.name, count: c.nonMissing, text: 'Todos os valores preenchidos são iguais' }); }
      const ws = c.raw.filter(v => typeof v === 'string' && v !== v.trim()).length;
      if (ws) { o.notes.push('espaços extras'); issues.push({ sev: 'baixa', kind: 'espaços', col: c.name, count: ws, text: `${ws} valores com espaços no início ou fim` }); }
      if (c.type === 'numérica') {
        const bad = []; for (let i = 0; i < N; i++) if (!isMissing(c.raw[i]) && c.num[i] === null) bad.push(i);
        if (bad.length) { o.notes.push('texto em coluna numérica'); issues.push({ sev: bad.length / N > .02 ? 'alta' : 'média', kind: 'tipo misto', col: c.name, count: bad.length, text: `${bad.length} valores não numéricos (ex.: ${[...new Set(bad.slice(0, 20).map(i => String(c.raw[i]).trim()))].slice(0, 4).map(x => '"' + x + '"').join(', ')})`, rows: bad.slice(0, 8).map(i => D.rowNo[i]) }); }
        const vals = c.num.filter(v => v !== null);
        const neg = vals.filter(v => v < 0).length;
        if (neg) { o.notes.push('valores negativos'); issues.push({ sev: /qtd|quant|pre[cç]o|idade|estoque/i.test(c.name) ? 'média' : 'baixa', kind: 'negativos', col: c.name, count: neg, text: `${neg} valores negativos (mín. ${vals.reduce((a, b) => Math.min(a, b))})` }); }
        const sentinels = [-1, -9, -99, -999, -9999, 99, 999, 9999, 99999];
        for (const sv of sentinels) { const k = vals.filter(v => v === sv).length; if (k >= 3 && k / vals.length < .2) { issues.push({ sev: 'baixa', kind: 'valor-sentinela', col: c.name, count: k, text: `Valor ${sv} aparece ${k} vezes; pode ser código de "sem informação" (não confirmado)` }); break; } }
      }
      if (c.type === 'data') {
        const badDate = [], future = [], old = [];
        for (let i = 0; i < N; i++) {
          if (isMissing(c.raw[i])) continue;
          if (c.ts[i] === null) badDate.push(i);
          else { if (c.ts[i] > now) future.push(i); if (new Date(c.ts[i]).getUTCFullYear() < 1990) old.push(i); }
        }
        if (badDate.length) { o.notes.push('datas inválidas'); issues.push({ sev: 'média', kind: 'datas inválidas', col: c.name, count: badDate.length, text: `${badDate.length} valores que não são datas válidas (ex.: "${String(c.raw[badDate[0]]).trim()}")`, rows: badDate.slice(0, 8).map(i => D.rowNo[i]) }); }
        if (future.length) { o.notes.push('datas futuras'); issues.push({ sev: 'média', kind: 'datas futuras', col: c.name, count: future.length, text: `${future.length} datas posteriores a hoje`, rows: future.slice(0, 8).map(i => D.rowNo[i]) }); }
        if (old.length) issues.push({ sev: 'baixa', kind: 'datas antigas', col: c.name, count: old.length, text: `${old.length} datas anteriores a 1990` });
        if (c.dateAmbiguous) o.notes.push(`formato ${c.fmt === 'mdy' ? 'mês/dia' : 'dia/mês'} assumido`);
      }
      if (c.type === 'categórica') {
        const g = new Map();
        for (let i = 0; i < N; i++) { if (isMissing(c.raw[i])) continue; const k = norm(c.raw[i]); if (!g.has(k)) g.set(k, new Map()); const raw = String(c.raw[i]); g.get(k).set(raw, (g.get(k).get(raw) || 0) + 1); }
        const variants = [];
        for (const [k, mp] of g) if (mp.size > 1) variants.push({ key: k, forms: [...mp.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n })) });
        if (variants.length) { o.variants = variants; o.notes.push('variações de escrita'); issues.push({ sev: 'média', kind: 'categorias inconsistentes', col: c.name, count: variants.reduce((s, v) => s + v.forms.reduce((a, f) => a + f.n, 0), 0), text: `${variants.length} categoria(s) escrita(s) de mais de uma forma`, variants }); }
      }
      return o;
    });
    if (A.dup.extra) issues.push({ sev: A.dup.pct >= .05 ? 'alta' : 'média', kind: 'duplicatas', col: '(linha inteira)', count: A.dup.extra, text: `${A.dup.extra} linhas idênticas a outra anterior (${(A.dup.pct * 100).toFixed(1)}%)${A.dup.removed ? ', já removidas da base' : ''}`, rows: A.dup.rows });
    if (A.dupId && A.dupId.conflict) issues.push({ sev: 'alta', kind: 'id duplicado', col: A.dupId.col, count: A.dupId.conflict, text: `${A.dupId.conflict} identificadores repetidos com conteúdo diferente nas linhas` });
    if (D.ragged) issues.push({ sev: 'média', kind: 'estrutura', col: '(arquivo)', count: D.ragged, text: `${D.ragged} linhas com número de colunas diferente do cabeçalho` });

    // outliers por coluna numérica (Tukey, sobre a base)
    A.outliers = [];
    for (const c of D.cols) {
      if (c.type !== 'numérica') continue;
      const arr = []; for (const i of base) if (c.num[i] !== null) arr.push({ i, v: c.num[i] });
      const f = fences(arr.map(a => a.v)); if (!f) continue;
      const out = arr.filter(a => a.v < f.low || a.v > f.high);
      if (!out.length) continue;
      const total = sum(arr.map(a => a.v));
      const outSum = sum(out.map(a => a.v));
      A.outliers.push({ col: c.name, n: arr.length, f, count: out.length, extreme: out.filter(a => a.v < f.xlow || a.v > f.xhigh).length, high: out.filter(a => a.v > f.high).length, low: out.filter(a => a.v < f.low).length, shareOfSum: arr.every(a => a.v >= 0) && total > 0 ? outSum / total : null, top: out.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 5).map(a => ({ row: D.rowNo[a.i], v: a.v })) });
    }

    // métrica principal
    const mc = cfg.metric != null ? D.cols[cfg.metric] : null;
    A.metricCol = mc;
    let mrows = [];
    if (mc && mc.type === 'numérica') {
      const arr = []; for (const i of base) if (mc.num[i] !== null) arr.push({ i, v: mc.num[i] });
      const f = fences(arr.map(a => a.v));
      const inl = f ? arr.filter(a => a.v >= f.low && a.v <= f.high) : arr;
      const outl = f ? arr.filter(a => a.v < f.low || a.v > f.high) : [];
      A.metric = { name: mc.name, f, all: describe(arr.map(a => a.v)), clean: describe(inl.map(a => a.v)), outRows: outl.map(a => ({ row: D.rowNo[a.i], v: a.v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)), nOut: outl.length, inliers: inl.map(a => a.v), allVals: arr.map(a => a.v), missingInBase: base.length - arr.length };
      mrows = cfg.excludeOut ? inl : arr;
    }
    A.mrows = mrows;
    A.nUsed = mrows.length;

    // colunas numéricas / categóricas (perfil)
    A.numProfile = D.cols.filter(c => c.type === 'numérica').map(c => { const v = []; for (const i of base) if (c.num[i] !== null) v.push(c.num[i]); return { name: c.name, ...describe(v), missing: base.length - v.length }; }).filter(p => p.n > 0);
    A.catProfile = D.cols.filter(c => c.type === 'categórica').map(c => {
      const g = new Map(); let n = 0;
      for (const i of base) { if (isMissing(c.raw[i])) continue; n++; const k = String(c.raw[i]); if (!g.has(k)) g.set(k, { forms: new Map(), n: 0 }); const e = g.get(k); e.n++; const r = String(c.raw[i]).trim(); e.forms.set(r, (e.forms.get(r) || 0) + 1); }
      const top = [...g.values()].map(e => ({ label: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], n: e.n, share: e.n / n })).sort((a, b) => b.n - a.n);
      return { name: c.name, n, distinct: g.size, top: top.slice(0, 8) };
    });

    // grupos × métrica
    A.groups = [];
    if (mc && mrows.length) {
      const mmap = new Map(mrows.map(r => [r.i, r.v]));
      for (const c of D.cols) {
        if (c.type !== 'categórica') continue;
        const g = new Map(); let lost = 0;
        for (const [i, v] of mmap) { if (isMissing(c.raw[i])) { lost++; continue; } const k = String(c.raw[i]); if (!g.has(k)) g.set(k, { forms: new Map(), vals: [] }); const e = g.get(k); e.vals.push(v); const r = String(c.raw[i]).trim(); e.forms.set(r, (e.forms.get(r) || 0) + 1); }
        if (g.size < 2 || g.size > 30) continue;
        const total = sum(mrows.map(r => r.v)) ;
        const list = [...g.values()].map(e => { const d = describe(e.vals); const se = d.n > 1 ? d.sd / Math.sqrt(d.n) : NaN; return { label: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], ...d, share: total > 0 && mrows.every(r=>r.v>=0) ? d.sum / total : null, ci: d.n >= 10 && isFinite(se) ? [d.mean - 1.96 * se, d.mean + 1.96 * se] : null }; }).sort((a, b) => b.mean - a.mean);
        A.groups.push({ dim: c.name, lost, list, nonNeg: mrows.every(r => r.v >= 0) });
      }
    }

    // tendência temporal
    A.trend = null;
    const dc = cfg.date != null ? D.cols[cfg.date] : null;
    if (dc && dc.type === 'data' && mc && mrows.length) {
      const pts = []; let fut = 0;
      for (const r of mrows) { const t = dc.ts[r.i]; if (t === null) continue; if (t > now) { fut++; continue; } pts.push({ t, v: r.v }); }
      if (pts.length >= 10) {
        let tmin = Infinity, tmax = -Infinity; for (const p of pts) { if (p.t < tmin) tmin = p.t; if (p.t > tmax) tmax = p.t; }
        const spanDays = (tmax - tmin) / 864e5;
        const gran = spanDays >= 90 ? 'mês' : spanDays >= 21 ? 'semana' : 'dia';
        const keyF = t => { const d = new Date(t); return gran === 'mês' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : gran === 'semana' ? Math.floor(t / 864e5 + 3) / 7 | 0 : Math.floor(t / 864e5); };
        const startF = k => gran === 'mês' ? Date.UTC(Math.floor(k / 12), k % 12, 1) : gran === 'semana' ? (k * 7 - 3) * 864e5 : k * 864e5;
        const endF = k => gran === 'mês' ? Date.UTC(Math.floor(k / 12), k % 12 + 1, 1) - 1 : gran === 'semana' ? startF(k) + 7 * 864e5 - 1 : startF(k) + 864e5 - 1;
        const tol = gran === 'mês' ? 3 * 864e5 : gran === 'semana' ? 2 * 864e5 : 0;
        const k0 = keyF(tmin), k1 = keyF(tmax), mp = new Map();
        for (const p of pts) { const k = keyF(p.t); if (!mp.has(k)) mp.set(k, []); mp.get(k).push(p.v); }
        const periods = []; let empty = 0;
        for (let k = k0; k <= k1; k++) {
          const v = mp.get(k) || []; if (!v.length) empty++;
          const partial = (k === k0 && tmin > startF(k) + tol) || (k === k1 && tmax < endF(k) - 864e5 + 1 - tol);
          periods.push({ k, start: startF(k), n: v.length, sum: v.length?sum(v):null, mean: v.length ? mean(v) : NaN, partial });
        }
        const full = periods.filter(p => !p.partial);
        const T = { gran, periods, nFull: full.length, nPartial: periods.length - full.length, future: fut, empty, tmin, tmax, nPts: pts.length };
        if (full.length >= 6 && empty === 0) {
          const fit = ols(full.map(p => p.sum));
          T.fit = { ...fit, ci: fisherCI(fit.r, full.length) };
          const f3 = full.slice(0, 3), l3 = full.slice(-3);
          const agg = (a, key) => mean(a.map(p => p[key]));
          T.cmp = { sumFirst: agg(f3, 'sum'), sumLast: agg(l3, 'sum'), nFirst: agg(f3, 'n'), nLast: agg(l3, 'n'), meanFirst: mean(f3.filter(p => p.n).map(p => p.mean)), meanLast: mean(l3.filter(p => p.n).map(p => p.mean)) };
        }
        A.trend = T;
      }
    }

    // correlações
    A.corr = null;
    const cand = D.cols.filter(c => c.type === 'numérica').map(c => { let n = 0; const s = []; for (const i of base) if (c.num[i] !== null) { n++; s.push(c.num[i]); } return { c, n, sd: sd(s) }; }).filter(x => x.n >= 10 && x.sd > 0).sort((a, b) => b.n - a.n).slice(0, 8);
    if (cand.length >= 2) {
      const names = cand.map(x => x.c.name), pairs = [];
      const M = names.map(() => names.map(() => null));
      for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) {
        const x = [], y = [];
        for (const i of base) { const p = cand[a].c.num[i], q = cand[b].c.num[i]; if (p !== null && q !== null) { x.push(p); y.push(q); } }
        if (x.length < 10) continue;
        const r = pearson(x, y), rs = pearson(ranks(x), ranks(y));
        if (!isFinite(r) || !isFinite(rs)) continue;
        const e = { a: names[a], b: names[b], n: x.length, r, rs, ci: fisherCI(r, x.length) };
        pairs.push(e); M[a][b] = M[b][a] = e;
      }
      A.corr = { names, M, pairs: pairs.sort((p, q) => Math.abs(q.rs) - Math.abs(p.rs)) };
    }

    // ausência por grupo (coluna com mais ausências × 1ª dimensão)
    A.missByGroup = null;
    const worst = [...A.cols].filter(c => c.missingPct >= .05 && c.type !== 'vazia').sort((a, b) => b.missingPct - a.missingPct)[0];
    if (worst) {
      const wc = D.cols.find(c => c.name === worst.name);
      for (const dcol of D.cols.filter(c => c.type === 'categórica' && c.name !== worst.name)) {
        const g = new Map();
        for (const i of base) { if (isMissing(dcol.raw[i])) continue; const k = norm(dcol.raw[i]); if (!g.has(k)) g.set(k, { l: String(dcol.raw[i]).trim(), n: 0, m: 0 }); const e = g.get(k); e.n++; if (isMissing(wc.raw[i])) e.m++; }
        const list = [...g.values()].filter(e => e.n >= 20).map(e => ({ label: e.l, n: e.n, miss: e.m, rate: e.m / e.n }));
        if (list.length >= 2) {
          list.sort((a, b) => b.rate - a.rate);
          const gap = list[0].rate - list[list.length - 1].rate;
          if (!A.missByGroup || gap > A.missByGroup.gap) A.missByGroup = { col: worst.name, dim: dcol.name, hi: list[0], lo: list[list.length - 1], gap };
        }
      }
    }

    A.issues = issues.sort((a, b) => ({ alta: 0, 'média': 1, baixa: 2 }[a.sev] - { alta: 0, 'média': 1, baixa: 2 }[b.sev]));
    return A;
  }

  return { parseCSV, parseNum, buildDataset, prepare, findColumn, uniqueNames, analyze, describe, isMissing, norm, quantile, pearson, ranks, fences, ols, fisherCI };
})();
if(typeof module!=='undefined') module.exports=Engine;
