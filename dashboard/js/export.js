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
  const o=r.optimization;
  rows.push(['스파 자동 탐색','판정',o.overall,'','CALC',o.overall,'',o.verifiedThickness?'스파 위치 두께 입력':'t/c 상한 사용 · 실제 두께 검증 필요']);
  for(const c of o.candidates)rows.push(['스파 후보',`후보 ${c.index+1}: 깊이 ${c.depthMm.toFixed(3)} mm`,c.massKg.toFixed(6),'kg','CALC',c.eligible?'추천 가능':c.packagingStatus==='TBD'||c.manufacturingStatus==='TBD'?'TBD':'부적합',
    c.strengthMargin.toFixed(4),`캡 필요 ${c.rootCapAreaMm2.toFixed(3)} mm² · 웹 이론 ${c.rootWebThicknessMm.toFixed(4)} mm · 처짐 ${c.predictedDeflectionMm===null?'TBD':c.predictedDeflectionMm.toFixed(3)+' mm'} · 장착 ${c.packagingStatus} · 제작 ${c.manufacturingStatus}`]);
  const assessment=AST.assessFeasibility(r);
  rows.push(['Baseline Feasibility','종합 판정',assessment.verdict,'','CALC',assessment.verdict,'',assessment.lead]);
  assessment.cards.forEach(card=>rows.push(['Baseline Feasibility',card.title,card.value,'','CALC',card.status,card.margin,`기준: ${card.criterion} · 원인: ${card.cause} · 조치: ${card.action}`]));
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  AST.download('항공기-계산결과.csv','\uFEFF'+csv,'text/csv;charset=utf-8');
};
AST.exportText = function (r) {
  const assessment=AST.assessFeasibility(r);
  const recommended=r.optimization.recommended;
  const body=['항공기 구조 설계 도구','',...AST.resultDefs.map(d=>{const m=AST.resultMeta(d);return `${d.section} / ${d.label}: ${AST.fmt(d.read(r),4)} ${d.unit} [${m.source} · ${m.status}] ${m.note}`;}),'',
    '스파 자동 탐색: '+r.optimization.overall,recommended?`추천 깊이 ${AST.fmt(recommended.depthMm,2)} mm · 스파 질량 ${AST.fmt(recommended.massKg,3)} kg · Strength MS ${AST.fmt(recommended.strengthMargin,2)} · 처짐 ${AST.fmt(recommended.predictedDeflectionMm,2)} mm`:'추천 가능한 제작 후보 없음',
    '','Baseline Feasibility: '+assessment.verdict,assessment.lead,...assessment.cards.map(card=>`${card.title}: ${card.status}\n값: ${card.value}\n기준: ${card.criterion}\nMargin: ${card.margin}\n원인: ${card.cause}\n조치: ${card.action}`),'','권장 조치',...assessment.actions.map((action,i)=>`${i+1}. ${action}`)].join('\n');
  AST.download('항공기-요약.txt',body,'text/plain;charset=utf-8');
};
