window.AST = window.AST || {};
AST.download = function (name,content,type) {
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
AST.exportJSON = state => AST.download('항공기-입력값.json',JSON.stringify(state,null,2),'application/json');
AST.exportCSV = function (r) {
  const rows=[['구분','항목','값','단위','Source','Status','Margin','Assumption / Note']];
  for(const path of AST.allSourcePaths()){
    const value=AST.get(r.state,path),label=AST.fieldLabel(path);
    const def=AST.fields.flatMap(group=>group.items).concat(AST.feasibilityFields,AST.budgetFields).find(item=>item[0]===path);
    rows.push(['입력값',label,Number.isFinite(value)?String(value):'',def?.[2]||'N',AST.sourceFor(path),value===null?'TBD':'입력값','','']);
  }
  AST.resultDefs.forEach(d=>{
    const value=d.read(r),meta=AST.resultMeta(d);
    rows.push([d.section,d.label,Number.isFinite(value)?String(value):'',d.unit,meta.source,value===null?'TBD':meta.status,'',meta.note]);
  });
  const assessment=AST.assessFeasibility(r);
  rows.push(['Baseline Feasibility','종합 판정',assessment.verdict,'','CALC',assessment.verdict,'',assessment.lead]);
  assessment.cards.forEach(card=>rows.push(['Baseline Feasibility',card.title,card.value,'','CALC',card.status,card.margin,`기준: ${card.criterion} · 원인: ${card.cause} · 조치: ${card.action}`]));
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  AST.download('항공기-계산결과.csv','\uFEFF'+csv,'text/csv;charset=utf-8');
};
AST.exportText = function (r) {
  const assessment=AST.assessFeasibility(r);
  const body=['항공기 구조 설계 도구','',...AST.resultDefs.map(d=>{const m=AST.resultMeta(d);return `${d.section} / ${d.label}: ${AST.fmt(d.read(r),4)} ${d.unit} [${m.source} · ${m.status}] ${m.note}`;}),'','Baseline Feasibility: '+assessment.verdict,assessment.lead,...assessment.cards.map(card=>`${card.title}: ${card.status}\n값: ${card.value}\n기준: ${card.criterion}\nMargin: ${card.margin}\n원인: ${card.cause}\n조치: ${card.action}`),'','권장 조치',...assessment.actions.map((action,i)=>`${i+1}. ${action}`)].join('\n');
  AST.download('항공기-요약.txt',body,'text/plain;charset=utf-8');
};
