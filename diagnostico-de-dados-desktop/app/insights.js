const Insights = (() => {
  const nf = (x, d = 0) => (x == null || !isFinite(x)) ? '–' : x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = x => { if (x == null || !isFinite(x)) return '–'; const a = Math.abs(x); return nf(x, a >= 1000 ? 0 : a >= 10 ? 1 : 2); };
  const pct = (x, d = 1) => (x == null || !isFinite(x)) ? '–' : nf(x * 100, d) + '%';

  const CTX = {
    geral: { nome: 'Geral', metric: 'a métrica', grupo: 'investigar com a área responsável o que diferencia o grupo de maior média observada (processo, mix, público ou período) antes de replicar qualquer prática', conc: 'avaliar o risco de depender de poucos grupos e definir um acompanhamento específico para eles', tend: 'acompanhar o indicador por período e confirmar com a área responsável o que mudou entre o início e o fim da série', dec: 'decisões de gestão' },
    vendas: { nome: 'Vendas e comercial', metric: 'a receita', grupo: 'revisar preço, desconto, mix de produtos e abordagem comercial do grupo de maior média observada e testar, em escala pequena, o que for replicável', conc: 'mapear o risco de concentração da carteira e definir metas de diversificação ou retenção para os grupos dominantes', tend: 'separar volume (número de vendas) de ticket médio e confirmar com o time comercial campanhas, mudanças de preço e sazonalidade do período', dec: 'decisões comerciais' },
    financeiro: { nome: 'Financeiro', metric: 'o valor', grupo: 'conciliar as diferenças entre grupos com a contabilidade e verificar critérios de lançamento antes de tirar conclusões de desempenho', conc: 'avaliar exposição a poucos grupos (clientes, contas ou centros de custo) e definir limites de acompanhamento', tend: 'validar com a contabilidade eventos extraordinários e regime de competência dos períodos comparados', dec: 'decisões financeiras' },
    marketing: { nome: 'Marketing', metric: 'o resultado', grupo: 'comparar custo, público e criativo dos canais ou campanhas de maior média observada e testar a diferença com experimento controlado', conc: 'verificar a dependência de poucos canais ou campanhas e planejar testes em canais subexplorados', tend: 'cruzar a série com o calendário de campanhas e verificar mudanças de rastreamento antes de interpretar a variação', dec: 'decisões de investimento em marketing' },
    operacoes: { nome: 'Operações e logística', metric: 'o indicador', grupo: 'observar o processo, a equipe e as condições operacionais do grupo de maior média observada antes de padronizar', conc: 'checar gargalos e dependência de poucas unidades, rotas ou fornecedores', tend: 'confirmar mudanças de processo, capacidade e calendário que coincidam com a variação', dec: 'decisões operacionais' },
    contabilidade: { nome:'Contabilidade', grupo:'conferir classificações e conciliar registros com a fonte antes de orientar lançamentos', conc:'avaliar concentração por conta ou cliente, sem presumir que os valores são financeiros', tend:'conferir competência, calendário e mudanças na coleta', dec:'decisões contábeis' },
    advocacia: { nome:'Advocacia', grupo:'verificar diferenças de tipo de caso, fase e complexidade antes de comparar grupos', conc:'verificar concentração por área, cliente ou tipo de demanda', tend:'conferir calendário processual e alterações no registro das atividades', dec:'gestão jurídica' },
    administracao: { nome:'Administração', grupo:'conferir volume, prazo e contexto de cada processo antes de comparar equipes', conc:'investigar concentração de atividades e dependências operacionais', tend:'conferir mudanças de fluxo e calendário administrativo', dec:'decisões administrativas' },
    rh: { nome: 'Pessoas (RH)', metric: 'o indicador', grupo: 'investigar fatores organizacionais (gestão, função, local) antes de qualquer ação individual; evitar comparar pessoas sem contexto', conc: 'verificar se poucas áreas concentram o fenômeno e priorizar conversas qualitativas com elas', tend: 'validar mudanças de política, contratação e calendário que coincidam com a variação', dec: 'decisões de pessoas' }
  };

  const conf = n => n >= 200 ? { lvl: 'maior', why: `n = ${nf(n)}; amostra grande para esta análise` } : n >= 30 ? { lvl: 'moderada', why: `n = ${nf(n)}; amostra média, margens de erro relevantes` } : { lvl: 'baixa', why: `n = ${nf(n)}; amostra pequena, resultado muito instável` };

  function build(D, A) {
    const cx = CTX[A.cfg.ctx] || CTX.geral;
    const out = [];
    const m = A.metric, mname = m ? m.name : null;
    const baseN = A.base.length;

    /* ---- confiabilidade dos dados ---- */
    const missCols = A.cols.filter(c => c.missingPct >= .05 && c.type !== 'vazia').sort((a, b) => b.missingPct - a.missingPct);
    if (missCols.length) {
      const ev = missCols.slice(0, 5).map(c => `${c.name}: ${nf(c.missing)} de ${nf(A.N)} linhas sem valor (${pct(c.missingPct)})`);
      const facts = ['Os cálculos de cada coluna usam apenas as linhas preenchidas; o n válido de cada uma aparece na área Explorar Dados.'];
      const hyp = [];
      if (A.missByGroup && A.missByGroup.gap >= .1) {
        const g = A.missByGroup;
        ev.push(`Em "${g.col}", a ausência é de ${pct(g.hi.rate)} em "${g.hi.label}" (n=${nf(g.hi.n)}) e ${pct(g.lo.rate)} em "${g.lo.label}" (n=${nf(g.lo.n)}), por "${g.dim}".`);
        facts.push(`A taxa de ausência de "${g.col}" difere entre grupos de "${g.dim}" (${nf(g.gap * 100, 1)} pontos percentuais).`);
        hyp.push('A ausência pode estar ligada a um processo de coleta ou sistema de origem específico desse grupo. Não foi testado.');
      } else hyp.push('Não há evidência aqui de que a ausência seja aleatória. Ela pode vir de campo opcional, falha de integração ou dado não aplicável. Não foi testado.');
      const worstC = missCols[0];
      out.push({ id: 'ausentes', sec: 'dados', title: `Dados ausentes em ${missCols.length} coluna(s) relevante(s)`, prio: missCols[0].missingPct >= .2 ? 'alta' : 'média', evidence: ev, facts, hyp,
        impact: `Em "${worstC.name}", ${pct(worstC.missingPct)} das linhas ficam fora do cálculo. Médias e somas dessa coluna descrevem só as linhas preenchidas e podem não representar o conjunto.`,
        rec: 'Confirmar com a origem dos dados se o campo é opcional e, quando não for, tornar o preenchimento obrigatório. Não preencher (imputar) valores sem um critério validado com a área responsável.',
        conf: conf(baseN) });
    }

    if (A.dup.extra || (A.dupId && A.dupId.conflict)) {
      const ev = [];
      if (A.dup.extra) ev.push(`${nf(A.dup.extra)} linhas idênticas a outra anterior (${pct(A.dup.pct)} de ${nf(A.dup.of || A.N)}). Linhas do arquivo: ${A.dup.rows.join(', ')}${A.dup.extra > A.dup.rows.length ? '…' : ''}.`);
      if (A.dupId) ev.push(`Identificador "${A.dupId.col}": ${nf(A.dupId.keys)} valores repetidos, dos quais ${nf(A.dupId.conflict)} com conteúdo diferente entre as linhas.`);
      const removed = !!A.dup.removed;
      let impact = removed ? `As ${nf(A.dup.extra)} duplicatas idênticas foram removidas do conjunto: todos os números deste relatório já as excluem. ` : (A.dup.extra ? 'As duplicatas continuam incluídas nos cálculos (a exclusão está desligada). ' : '');
      if (m && A.dup.extra) {
        let s = null;
        if (removed) s = A.pre.dupMetricSum;
        else {
          const mc = D.cols.find(c => c.name === mname); const seen = new Set(); s = 0;
          for (let i = 0; i < D.nRows; i++) { const k = JSON.stringify(D.cols.map(c=>c.raw[i]??null)); if (seen.has(k)) { if (mc.num[i] !== null) s += mc.num[i]; } else seen.add(k); }
        }
        if (s != null) { const tot = removed ? m.all.sum : m.all.sum - s; impact += `Somadas, essas linhas valem ${num(s)} em "${mname}"${tot > 0 ? ` (${pct(s / tot)} do total sem duplicatas)` : ''}.`; }
      }
      out.push({ id: 'duplicatas', sec: 'dados', title: 'Registros duplicados', prio: A.dup.pct >= .05 || (A.dupId && A.dupId.conflict) ? 'alta' : 'média', evidence: ev,
        facts: ['Linhas com exatamente os mesmos valores em todas as colunas aparecem mais de uma vez.', ...(A.dupId && A.dupId.conflict ? ['Há identificadores iguais com dados diferentes, o que indica conflito de cadastro, não só repetição.'] : [])],
        hyp: ['Pode ser carga duplicada ou exportação repetida. Também pode ser repetição legítima, se o arquivo não tiver identificador único. Não dá para distinguir só com estes dados.'],
        impact, rec: removed ? 'Confirmar com a origem se as linhas repetidas são legítimas. Se não forem, corrigir a carga na fonte. Desfaça a exclusão se a origem não confirmar que são repetições indevidas.' : 'Confirmar com a origem se as linhas repetidas são legítimas. Se não forem, ligue "Excluir linhas duplicadas idênticas" para tirá-las dos cálculos e corrija a carga na fonte.', conf: conf(A.N) });
    }

    const varIssues = A.issues.filter(i => i.kind === 'categorias inconsistentes');
    if (varIssues.length) {
      const ev = []; let aff = 0;
      for (const v of varIssues) for (const g of v.variants.slice(0, 3)) ev.push(`${v.col}: ${g.forms.map(f => `"${f.v}" (${nf(f.n)})`).join(' · ')}`);
      for (const v of varIssues) aff += v.count;
      out.push({ id: 'variacoes', sec: 'dados', title: 'Mesma categoria escrita de formas diferentes', prio: 'média', evidence: ev,
        facts: ['Os valores acima diferem só em maiúsculas, acentos ou espaços e permanecem distintos até a confirmação de uma correção de unificação.'],
        hyp: ['A origem provavelmente aceita texto livre nesse campo. Não verificado.'],
        impact: `${nf(aff)} células estão em categorias com mais de uma grafia. As grafias continuam em grupos separados nesta análise; revise sua equivalência antes de consolidar totais.`,
        rec: 'Padronizar o campo na origem com uma lista de valores permitida. Se as grafias representarem a mesma categoria, revise e confirme a unificação em Importação e configurações.', conf: conf(A.N) });
    }

    const inc = A.issues.filter(i => ['tipo misto', 'datas inválidas', 'datas futuras', 'negativos', 'estrutura', 'valor-sentinela'].includes(i.kind));
    if (inc.length) {
      out.push({ id: 'inconsistencias', sec: 'dados', title: 'Valores inconsistentes ou fora do esperado', prio: inc.some(i => i.sev === 'alta') ? 'alta' : 'média',
        evidence: inc.slice(0, 8).map(i => `${i.col}: ${i.text}${i.rows ? ` (linhas ${i.rows.join(', ')})` : ''}`),
        facts: ['Estes valores existem no arquivo. Textos em coluna numérica e datas inválidas não entram nos cálculos da coluna.', 'Valores negativos e datas futuras foram mantidos; datas futuras são ignoradas apenas na série temporal.'],
        hyp: ['Podem ser erro de digitação, ajuste legítimo (estorno, devolução) ou lançamento antecipado. Só quem conhece o processo pode dizer qual.'],
        impact: `Somam ${nf(inc.reduce((s, i) => s + i.count, 0))} ocorrências de alerta (a mesma célula pode aparecer em mais de um alerta). Os cálculos das colunas envolvidas usam só os valores válidos, e a soma pode estar subestimada ou superestimada se esses registros forem relevantes.`,
        rec: 'Listar as linhas indicadas com a área responsável e classificar cada caso como erro ou evento real antes de corrigir ou excluir.', conf: conf(A.N) });
    }

    /* ---- achados de negócio ---- */
    if (m && m.nOut) {
      const o = A.outliers.find(x => x.col === mname);
      const ev = [`${nf(m.nOut)} de ${nf(m.all.n)} valores de "${mname}" ficam fora das cercas de Tukey (${num(m.f.low)} a ${num(m.f.high)}).`, `Maiores: ${m.outRows.slice(0, 5).map(r => `${num(r.v)} (linha ${r.row})`).join(', ')}.`,
        `Média ${num(m.all.mean)} com todos os valores; ${num(m.clean.mean)} sem os atípicos. Mediana: ${num(m.all.median)} e ${num(m.clean.median)}.`];
      const facts = [`A média muda ${pct(Math.abs(m.all.mean - m.clean.mean) / Math.abs(m.clean.mean || 1))} quando os atípicos saem; a mediana muda ${pct(Math.abs(m.all.median - m.clean.median) / Math.abs(m.clean.median || 1))}.`];
      if (o && o.shareOfSum != null) facts.push(`Os atípicos somam ${pct(o.shareOfSum)} do total de "${mname}".`);
      out.push({ id: 'outliers', sec: 'negocio', title: `Valores atípicos em ${mname}`, prio: (o && o.shareOfSum > .1) ? 'alta' : 'média', evidence: ev, facts,
        hyp: ['Podem ser erro de digitação ou de unidade, ou vendas e eventos legítimos de grande porte. O app não tem como distinguir.', 'Em distribuições assimétricas, o critério de Tukey marca como atípicos valores que são normais para o negócio.'],
        impact: `As análises de grupo e tendência estão usando ${A.cfg.excludeOut ? 'a base sem' : 'a base com'} esses ${nf(m.nOut)} valores${o && o.shareOfSum != null ? `, que pesam ${pct(o.shareOfSum)} do total` : ''}. A escolha muda os resultados.`,
        rec: `Validar com a fonte os ${Math.min(5, m.nOut)} maiores registros (linhas ${m.outRows.slice(0, 5).map(r => r.row).join(', ')}) antes de excluir. Relatar sempre mediana junto com a média.`, conf: conf(m.all.n) });
    }

    for (const g of A.groups.slice(0, 3)) {
      const L = g.list; const eligible = L.filter(x => x.n >= 10);
      if (g.nonNeg && L.length >= 4 && L[0].share != null) {
        const bySum = [...L].sort((a, b) => b.sum - a.sum);
        const top1 = bySum[0], k = Math.max(1, Math.ceil(L.length * .2)); const topK = bySum.slice(0, k).reduce((s, x) => s + x.sum, 0) / (bySum.reduce((s, x) => s + x.sum, 0) || 1);
        if (top1.share >= .4 || topK >= .8) {
          out.push({ id: 'conc-' + g.dim, sec: 'negocio', title: `Concentração de ${mname} por ${g.dim}`, prio: top1.share >= .5 ? 'alta' : 'média',
            evidence: [`"${top1.label}" responde por ${pct(top1.share)} da soma de "${mname}" (n=${nf(top1.n)} linhas).`, `${k === 1 ? 'O maior' : 'Os ' + k + ' maiores'} de ${L.length} grupos ${k === 1 ? 'soma' : 'somam'} ${pct(topK)}.`],
            facts: ['A soma está distribuída de forma desigual entre os grupos, na base de cálculo atual.'],
            hyp: ['A concentração pode refletir o tamanho real de cada grupo no negócio ou diferenças de cobertura dos dados. Não testado.'],
            impact: `Uma variação em "${top1.label}" move a soma total de forma desproporcional: cada 10% de variação ali equivale a ${pct(top1.share * .1)} do total, por aritmética.`,
            rec: `Para ${cx.dec}: ${cx.conc}.`, conf: conf(A.nUsed) });
        }
      }
      if (eligible.length >= 2) {
        const hi = eligible[0], lo = eligible[eligible.length - 1];
        const sep = hi.ci && lo.ci && lo.ci[1] < hi.ci[0];
        const gap = hi.mean - lo.mean;
        out.push({ id: 'grupo-' + g.dim, sec: 'negocio', title: `Média de ${mname} difere entre grupos de ${g.dim}`, prio: sep ? 'alta' : 'baixa',
          evidence: [`"${hi.label}": média ${num(hi.mean)}, mediana ${num(hi.median)}, n=${nf(hi.n)}, IC95% aprox. ${num(hi.ci[0])} a ${num(hi.ci[1])}.`, `"${lo.label}": média ${num(lo.mean)}, mediana ${num(lo.median)}, n=${nf(lo.n)}, IC95% aprox. ${num(lo.ci[0])} a ${num(lo.ci[1])}.`, `Diferença entre médias: ${num(gap)}. Grupos comparados: ${eligible.length} com n ≥ 10 (de ${L.length}).`],
          facts: [sep ? 'Os intervalos de confiança aproximados não se sobrepõem: a diferença observada é maior do que a variação esperada só por amostragem, nesta base.' : 'Os intervalos de confiança aproximados se sobrepõem: com esta amostra, não dá para descartar que a diferença seja acaso.'],
          hyp: ['Uma diferença entre grupos não mostra o que a causa. Pode vir de mix de produtos, porte do cliente, período ou outras variáveis não incluídas. Nenhuma foi testada.', ...(m && m.nOut && !A.cfg.excludeOut ? [`A média é sensível aos ${nf(m.nOut)} valores atípicos mantidos na base. Compare também as medianas (${hi.label}: ${num(hi.median)}; ${lo.label}: ${num(lo.median)}) ou ligue a exclusão de atípicos.`] : []), ...(g.lost ? [`${nf(g.lost)} linhas sem "${g.dim}" ficaram fora desta comparação.`] : [])],
          impact: `A diferença de ${num(gap)} entre as médias merece investigação de contexto antes de orientar ${cx.dec}. Maior valor da métrica não significa melhor desempenho.`,
          rec: `Para ${cx.dec}: ${cx.grupo}.`, conf: conf(Math.min(hi.n, lo.n)) });
      }
    }

    if (A.trend && A.trend.fit) {
      const T = A.trend, f = T.fit, c = T.cmp;
      const sig = f.ci && (f.ci[0] > 0 || f.ci[1] < 0);
      const dir = f.slope > 0 ? 'cresce' : 'cai';
      const ev = [`${T.nFull} ${T.gran === 'mês' ? 'meses' : T.gran === 'semana' ? 'semanas' : 'dias'} completos analisados (${T.nPartial} parcial(is) excluído(s)${T.empty ? `, ${T.empty} sem registros, sem imputação` : ''}).`,
        `Soma por ${T.gran}: média dos 3 primeiros ${num(c.sumFirst)}; dos 3 últimos ${num(c.sumLast)} (${c.sumFirst ? ((c.sumLast / c.sumFirst - 1) * 100 >= 0 ? '+' : '') + nf((c.sumLast / c.sumFirst - 1) * 100, 1) + '%' : '–'}).`,
        `Registros por ${T.gran}: ${num(c.nFirst)} → ${num(c.nLast)}. Valor médio por registro: ${num(c.meanFirst)} → ${num(c.meanLast)}.`,
        `Inclinação linear: ${f.slope >= 0 ? '+' : ''}${num(f.slope)} por ${T.gran}; r = ${nf(f.r, 2)}${f.ci ? ` (IC95% ${nf(f.ci[0], 2)} a ${nf(f.ci[1], 2)})` : ''}.`];
      out.push({ id: 'tendencia', sec: 'negocio', title: sig ? `${mname} ${dir} ao longo do tempo` : `Sem tendência linear clara em ${mname}`, prio: sig ? 'alta' : 'baixa', evidence: ev,
        facts: [sig ? `A soma por ${T.gran} ${dir} de forma consistente com uma reta (o IC95% de r não inclui zero).` : 'O IC95% de r inclui zero: com este número de períodos, não dá para distinguir tendência de oscilação.', 'A comparação acima separa efeito de volume (registros) e de valor médio por registro.'],
        hyp: [`Variações podem vir de sazonalidade, campanhas, mudanças de preço ou de cadastro. Com ${T.nFull} períodos não é possível separar sazonalidade de tendência.`],
        impact: `Entre o início e o fim da série, a soma por ${T.gran} passou de ${num(c.sumFirst)} para ${num(c.sumLast)}. Extrapolar essa reta para períodos futuros não é recomendado sem validar o que mudou.`,
        rec: `Para ${cx.dec}: ${cx.tend}.`, conf: { lvl: T.nFull >= 24 ? 'moderada' : 'baixa', why: `${T.nFull} períodos completos; poucas observações para tendência` } });
    }

    if (A.corr) {
      const strong = A.corr.pairs.filter(p => Math.abs(p.rs) >= .5 && Math.abs(p.r) >= .5 && Math.sign(p.r) === Math.sign(p.rs) && p.n >= 30).slice(0, 3);
      if (strong.length) {
        out.push({ id: 'correlacao', sec: 'negocio', title: 'Variáveis numéricas que andam juntas', prio: 'média',
          evidence: strong.map(p => `${p.a} × ${p.b}: Pearson ${nf(p.r, 2)}${p.ci ? ` (IC95% ${nf(p.ci[0], 2)} a ${nf(p.ci[1], 2)})` : ''}, Spearman ${nf(p.rs, 2)}, n=${nf(p.n)}.`),
          facts: ['Nestas linhas, os valores dessas colunas variam juntos (mesma direção para Pearson e Spearman).'],
          hyp: ['Correlação não é causalidade. Uma coluna pode ser calculada a partir da outra (relação mecânica), ou ambas dependerem de um terceiro fator. Nenhuma dessas explicações foi testada.', ...(strong.some(p => Math.abs(p.r) > .98) ? ['Correlação acima de 0,98 sugere redundância ou coluna derivada.'] : [])],
          impact: 'Serve para escolher o que investigar. Não sustenta, por si só, a decisão de mexer em uma variável para mudar a outra.',
          rec: 'Antes de agir, checar se as colunas são definidas uma pela outra. Se não forem, testar a relação com um experimento ou com comparação controlada por outras variáveis.', conf: conf(Math.min(...strong.map(p => p.n))) });
      }
    }
    return out.map(it=>({...it,limitation:it.sec==='dados'?'Alertas de qualidade não comprovam erros: ausências e repetições podem ser legítimas. Confirme com a origem antes de corrigir.':it.id?.includes('correl')?'Correlação não implica causalidade. Pares usam somente valores válidos; variáveis externas e relações derivadas não foram controladas.':'Comparação descritiva desta amostra. Composição dos grupos, valores ausentes e fatores externos podem explicar diferenças; não há comprovação causal.'}));
  }

  function limitations(D, A) {
    const L = [];
    const pre = A.pre, parts = [];
    if (A.dup.removed) parts.push(`${nf(A.dup.extra)} duplicatas idênticas removidas`);
    if (pre.filterRemoved) parts.push(`${nf(pre.filterRemoved)} linhas removidas por filtro de vazios`);
    L.push(`Base de cálculo: ${nf(A.N)} de ${nf(pre.rawN)} linhas lidas${parts.length ? ` (${parts.join('; ')})` : ''}${A.metric ? `; para "${A.metric.name}", ${nf(A.nUsed)} linhas válidas${A.cfg.excludeOut ? `, com ${nf(A.metric.nOut)} atípicos excluídos` : ', atípicos mantidos'}` : ''}.`);
    if (pre.dropped.length) L.push(`Colunas excluídas a pedido: ${pre.dropped.join(', ')}. Elas não entram em nenhuma análise, nem na checagem de duplicatas.`);
    if (!A.dup.removed && A.dup.extra) L.push(`${nf(A.dup.extra)} duplicatas idênticas foram mantidas nos cálculos (exclusão desligada).`);
    L.push('Os resultados descrevem somente o arquivo carregado. Nenhum benchmark externo, meta ou dado de mercado foi usado ou inventado.');
    L.push('Todas as relações apresentadas são associações observadas. Nada neste relatório demonstra causa e efeito.');
    L.push('Valores ausentes são reconhecidos por: vazio, null, NA, N/A, NaN, -, --, n/d, s/d, none, nulo, #N/A. Outro código de ausência seria tratado como valor.');
    L.push('Números aceitam formato brasileiro (1.234,56) e internacional (1,234.56). Um valor como "1.234" é lido como 1,234, não como 1234.');
    L.push('Datas com dia e mês ambíguos (ex.: 03/04/2025) seguem o formato indicado pelas outras datas da coluna; sem indício, assume-se dia/mês.');
    L.push('Outliers usam a regra de Tukey (1,5 × amplitude interquartílica). É um critério estatístico, não um teste de erro.');
    L.push('Intervalos de confiança de médias usam aproximação normal (n ≥ 10) e os de correlação usam a transformação de Fisher. São indicativos, não testes formais de hipótese.');
    L.push('Níveis de suporte por tamanho de amostra (menos de 30 baixa, 30 a 199 moderada, 200 ou mais maior) são uma regra prática do app, não um resultado estatístico.');
    if (D.nRows < 100) L.push(`Amostra pequena (${D.nRows} linhas): estatísticas muito sensíveis a poucos registros.`);
    if (A.trend) {
      L.push(`Série temporal agregada por ${A.trend.gran}. Períodos parciais nas pontas (tolerância de ${A.trend.gran === 'mês' ? '3' : '2'} dias) ficam fora da tendência. Datas futuras (${nf(A.trend.future)}) foram ignoradas na série.`);
      if (A.trend.empty) L.push(`${A.trend.empty} período(s) sem nenhum registro estão sem observações e não foram preenchidos com zero. A tendência não é estimada com lacunas.`);
    } else if (A.cfg.date != null && A.metric) L.push('A série temporal não foi calculada: menos de 10 registros com data válida e métrica.');
    else L.push('Sem coluna de data selecionada, não há análise temporal.');
    const excl = D.cols.filter(c => c.type === 'texto' || c.type === 'vazia' || c.type === 'id');
    if (excl.length) L.push(`Colunas sem análise estatística (texto livre, identificador ou vazias): ${excl.map(c => c.name).join(', ')}.`);
    const hi = D.cols.filter(c => c.type === 'categórica').length - A.groups.length;
    if (hi > 0) L.push(`${hi} coluna(s) categórica(s) não geraram comparação de grupos (menos de 2 ou mais de 30 categorias, ou sem métrica).`);
    if (A.corr && A.corr.names.length === 8) L.push('A matriz de correlação considera as 8 colunas numéricas com mais valores preenchidos.');
    L.push('O que um dado ausente, atípico ou inconsistente significa para o negócio só pode ser confirmado com quem conhece o processo de origem.');
    return L;
  }

  /* ---------- dados de exemplo (sintéticos, seed fixa) ---------- */
  function makeSample() {
    let s = 20261029; const r = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const wpick = a => { let x = r() * a.reduce((q, y) => q + y[1], 0); for (const [v, w] of a) { x -= w; if (x <= 0) return v; } return a[0][0]; };
    const brl = x => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const prods = [['Plano Básico', 89.9], ['Plano Pro', 249], ['Plano Equipe', 590], ['Módulo Extra', 39.9], ['Treinamento', 1200]];
    const rows = [['id_pedido', 'data_pedido', 'regiao', 'canal', 'produto', 'segmento', 'quantidade', 'preco_unitario', 'desconto_pct', 'receita']];
    const start = Date.UTC(2025, 0, 1), end = Date.UTC(2026, 8, 30), span = (end - start) / 864e5;
    for (let n = 1; n <= 500; n++) {
      const day = Math.floor(Math.sqrt(r()) * span), d = new Date(start + day * 864e5);
      const canal = wpick([['Online', 5], ['Loja', 3], ['Parceiro', 2]]);
      const [prod, price] = prods[Math.floor(r() * prods.length)];
      const q = Math.max(1, Math.round((canal === 'Parceiro' ? 4 : canal === 'Loja' ? 2 : 1.5) + (r() - .4) * 3));
      const disc = Math.min(30, Math.round(q * 1.5 + r() * 8));
      let rev = q * price * (1 - disc / 100) * (.97 + r() * .06);
      let reg = wpick([['Sudeste', 42], ['Sul', 22], ['Nordeste', 22], ['Centro-Oeste', 14]]);
      const v = r(); if (reg === 'Sudeste' && v < .12) reg = 'sudeste'; else if (reg === 'Sul' && v < .1) reg = 'SUL '; if (r() < .02) reg = '';
      let dstr = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
      let qs = String(q), ds = r() < .07 ? (r() < .4 ? 'N/A' : '') : String(disc);
      let rs = brl(rev);
      if (n % 83 === 0) rs = brl(rev * 14);
      if (n === 57 || n === 301) qs = 'dez';
      if (n === 140 || n === 410 || n === 222) qs = '-1';
      if (n === 150 || n === 377) dstr = '15/03/2027';
      rows.push([`P${String(n).padStart(5, '0')}`, dstr, reg, canal, prod, wpick([['PME', 5], ['Enterprise', 2], ['Autônomo', 3]]), qs, brl(price), ds, rs]);
    }
    for (const i of [12, 50, 133, 201, 260, 333, 389, 421, 470]) rows.push([...rows[i]]);
    return rows.map(x => x.map(c => /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(';')).join('\n');
  }

  function reportText(D, A, items, meta) {
    const L = [];
    L.push('NEXORA INSIGHT — RELATÓRIO ANALÍTICO');
    L.push(`Arquivo: ${meta.fileName}${meta.isSample ? ' (exemplo sintético)' : ''}`);
    L.push(`Contexto: ${(CTX[A.cfg.ctx] || CTX.geral).nome}${meta.objective ? ' | Objetivo: ' + meta.objective : ''}`);
    L.push('');
    L.push('LIMITAÇÕES E EXCLUSÕES');
    limitations(D, A).forEach(x => L.push('- ' + x));
    L.push('');
    L.push('INSIGHTS');
    items.forEach((it, i) => {
      L.push(`${i + 1}. ${it.title} [prioridade ${it.prio}; suporte amostral ${it.conf.lvl}: ${it.conf.why}]`);
      L.push('  Evidência:'); it.evidence.forEach(x => L.push('   - ' + x));
      L.push('  Fatos observados:'); it.facts.forEach(x => L.push('   - ' + x));
      L.push('  Hipóteses (não testadas):'); it.hyp.forEach(x => L.push('   - ' + x));
      L.push('  Impacto potencial: ' + it.impact);
      L.push('  Recomendação: ' + it.rec);
      L.push('  Limitação: '+it.limitation);
      L.push('');
    });
    return L.join('\n');
  }

  return { build, limitations, makeSample, reportText, CTX, nf, num, pct };
})();
if(typeof module!=='undefined') module.exports=Insights;
