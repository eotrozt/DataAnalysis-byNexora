const Charts=(()=>{
const nf=Insights.nf,num=Insights.num;
const COL={cyan:'#55C7E8',amber:'#FFBE45'};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function niceTicks(max,n=4){const raw=max/n,p=Math.pow(10,Math.floor(Math.log10(raw||1))),f=raw/p,s=(f<=1?1:f<=2?2:f<=5?5:10)*p;const t=[];for(let v=0;v<=max+s*.01;v+=s)t.push(v);if(t[t.length-1]<max)t.push(t[t.length-1]+s);return t}
function histSVG(vals,name){
  if(vals.length<5)return '<div class="empty">Valores insuficientes para o histograma.</div>';
  const W=640,H=270,ml=44,mr=10,mt=10,mb=55,mn=vals.reduce((a,b)=>Math.min(a,b),Infinity),mx=vals.reduce((a,b)=>Math.max(a,b),-Infinity);
  if(mn===mx)return '<div class="empty">Todos os valores são iguais.</div>';
  const k=Math.min(30,Math.max(8,Math.ceil(Math.log2(vals.length)+1))),w=(mx-mn)/k,bins=new Array(k).fill(0);
  for(const v of vals){bins[Math.min(k-1,Math.floor((v-mn)/w))]++}
  const ticks=niceTicks(Math.max(...bins)),ymax=ticks[ticks.length-1],iw=W-ml-mr,ih=H-mt-mb,bw=iw/k;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histograma de ${esc(name)}">`;
  for(const t of ticks){const y=mt+ih-t/ymax*ih;s+=`<line class="grid" x1="${ml}" x2="${W-mr}" y1="${y}" y2="${y}"/><text x="${ml-6}" y="${y+4}" text-anchor="end">${nf(t)}</text>`}
  bins.forEach((c,i)=>{const h=c/ymax*ih,x=ml+i*bw;s+=`<rect x="${x+1}" y="${mt+ih-h}" width="${Math.max(1,bw-2)}" height="${h}" rx="2" fill="${COL.cyan}" data-tip="${num(mn+i*w)} a ${num(mn+(i+1)*w)}: ${nf(c)} linhas"/>`});
  s+=`<line class="axis" x1="${ml}" x2="${W-mr}" y1="${mt+ih}" y2="${mt+ih}"/>`;
  for(let i=0;i<=4;i++){const x=ml+iw*i/4;s+=`<text x="${x}" y="${H-28}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${num(mn+(mx-mn)*i/4)}</text>`}
  return s+`<text x="44" y="264">Eixo X: ${esc(name)} · eixo Y: frequência de registros</text></svg>`;
}
function timeSVG(T,name){
 const P=T.periods,W=700,H=280,ml=65,mr=15,mt=16,mb=52,iw=W-ml-mr,ih=H-mt-mb,bw=iw/P.length;
 const values=P.filter(p=>p.n>0).map(p=>p.sum);if(T.fit){values.push(T.fit.intercept,T.fit.intercept+T.fit.slope*(T.nFull-1))}
 const low=Math.min(0,...values),high=Math.max(1,...values),span=high-low;
 const y=v=>mt+ih-(v-low)/span*ih,zero=y(0);
 const lab=p=>new Date(p.start).toLocaleDateString('pt-BR',{timeZone:'UTC',month:'short',year:'2-digit',...(T.gran==='mês'?{}:{day:'2-digit'})});
 let svg=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Soma de ${esc(name)} por ${T.gran}">`;
 for(let i=0;i<=4;i++){const v=low+span*i/4;svg+=`<line class="grid" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}"/><text x="${ml-7}" y="${y(v)+4}" text-anchor="end">${num(v)}</text>`}
 P.forEach((p,i)=>{if(!p.n)return;const x=ml+i*bw+1.5,top=Math.min(zero,y(p.sum)),height=Math.abs(zero-y(p.sum));svg+=`<rect x="${x}" y="${top}" width="${Math.max(1,bw-3)}" height="${height}" fill="${p.partial?'none':COL.cyan}" ${p.partial?`stroke="${COL.cyan}" stroke-dasharray="3 3"`:''} data-tip="${esc(lab(p))}: ${num(p.sum)} · ${p.n} registros"/>`});
 const step=Math.ceil(P.length/8);P.forEach((p,i)=>{if(i%step===0)svg+=`<text x="${ml+(i+.5)*bw}" y="${H-27}" text-anchor="middle">${esc(lab(p))}</text>`});
 if(T.fit){const off=P.findIndex(p=>!p.partial);svg+=`<line x1="${ml+(off+.5)*bw}" x2="${ml+(off+T.nFull-.5)*bw}" y1="${y(T.fit.intercept)}" y2="${y(T.fit.intercept+T.fit.slope*(T.nFull-1))}" stroke="${COL.amber}" stroke-width="2"/>`}
 return svg+`<line class="axis" x1="${ml}" x2="${W-mr}" y1="${zero}" y2="${zero}"/><text x="${ml}" y="${H-7}">Período (${T.gran}) · eixo Y: soma de ${esc(name)}</text></svg><p class="sub">Ciano: soma observada · tracejado: período parcial · âmbar: tendência descritiva${T.empty?' · lacunas sem registros, não preenchidas com zero':''}.</p>`;
}
return {histSVG,timeSVG};
})();
