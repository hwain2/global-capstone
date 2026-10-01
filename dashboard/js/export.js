window.AST = window.AST || {};
AST.download = function (name,content,type) {
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
AST.exportJSON = state => AST.download('항공기-입력값.json',JSON.stringify(state,null,2),'application/json');
AST.exportCSV = function (r) {
  const rows=[['구분','항목','값','단위','해석']];
  AST.resultDefs.forEach(d=>{
    const value=d.read(r);
    rows.push([d.section,d.label,Number.isFinite(value)?String(value):'',d.unit,d.status||'초기 추정값']);
  });
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  AST.download('항공기-계산결과.csv','\uFEFF'+csv,'text/csv;charset=utf-8');
};
AST.exportText = function (r) {
  const body=['항공기 구조 설계 도구','',...AST.resultDefs.map(d=>`${d.section} / ${d.label}: ${AST.fmt(d.read(r),4)} ${d.unit}${d.status?' ['+d.status+']':''}`)].join('\n');
  AST.download('항공기-요약.txt',body,'text/plain;charset=utf-8');
};
