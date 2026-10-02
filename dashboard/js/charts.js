window.AST = window.AST || {};
AST.plotLayout = function (yTitle) {
  return {paper_bgcolor:'transparent',plot_bgcolor:'transparent',margin:{l:62,r:16,t:10,b:48},
    font:{family:'Inter, system-ui, sans-serif',color:'#bdcddd',size:11},
    xaxis:{title:'반날개 위치 y [m]',gridcolor:'#30485f',zerolinecolor:'#30485f'},
    yaxis:{title:yTitle,gridcolor:'#30485f',zerolinecolor:'#30485f'},showlegend:false};
};
AST.renderCharts = function (r,s) {
  if(!window.Plotly||!document.getElementById('loadChartsDetails').open)return;
  const cfg={responsive:true,displaylogo:false};
  [['liftPlot','distribution','분포 양력 [N/m]','#65c9ff'],
   ['shearPlot','shear','전단력 [N]','#f8b45e'],
   ['momentPlot','moment','굽힘모멘트 [N·m]','#d99eff']].forEach(([id,key,title,color])=>{
    Plotly.react(id,[{type:'scatter',mode:'lines',x:r.span.map(p=>p.y),y:r.span.map(p=>p[key]),line:{color,width:3},fill:'tozeroy',fillcolor:color+'22',hovertemplate:'위치 y = %{x:.3f} m<br>결과 = %{y:.3f}<extra></extra>'}],AST.plotLayout(title),cfg);
  });
};
AST.renderSensitivity = function (sen) {
  if(!window.Plotly || !sen)return;
  const cfg={responsive:true,displaylogo:false};
  Plotly.react('sensitivityCurve',[{type:'scatter',mode:'lines+markers',x:sen.curve.map(p=>p.pct),y:sen.curve.map(p=>p.value),line:{color:'#65c9ff',width:3},marker:{size:5,color:'#a3dfff'}}],{
    ...AST.plotLayout(sen.def.label+' ['+sen.def.unit+']'),xaxis:{title:'변수 변화 [%]',gridcolor:'#30485f'},showlegend:false
  },cfg);
  const rows=sen.table.slice(0,12).reverse();
  Plotly.react('sensitivityBars',[{type:'bar',orientation:'h',x:rows.map(p=>Math.abs(p.index)),y:rows.map(p=>AST.fieldLabel(p.path)),marker:{color:rows.map(p=>p.index>=0?'#65c9ff':'#ef8792')},hovertemplate:'|S| = %{x:.3f}<extra></extra>'}],{
    ...AST.plotLayout('|S|'),margin:{l:145,r:16,t:10,b:48},xaxis:{title:'국소 민감도 절댓값 |S|',gridcolor:'#30485f'},yaxis:{automargin:true,color:'#bdcddd'},showlegend:false
  },cfg);
};
