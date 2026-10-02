window.AST = window.AST || {};
AST.renderOptimization=function(r){
  const o=r.optimization,fmt=AST.fmt,esc=AST.escape;
  const pick=o.recommended||o.provisional;
  const summary=document.getElementById('optimizationSummary');
  const missing=[];
  if(!o.verifiedThickness)missing.push('스파 x/c의 실제 익형 두께');
  if(r.state.sparDesign.capWidthMm===null)missing.push('캡 폭');
  if(r.state.sparDesign.manufacturingMinCapMm===null)missing.push('제작 최소 캡 두께');
  if(r.state.sparDesign.manufacturingMinWebMm===null)missing.push('제작 최소 웹 두께');
  if(r.state.material.elasticModulusGPa===null)missing.push('탄성계수 E');
  if(r.state.feasibility.tipDeflectionLimitMm===null)missing.push('허용 날개끝 처짐');
  const massBudget=Object.entries(r.state.weightBudget),wingMass=r.state.weightBudget.wingStructure;
  const otherMass=massBudget.filter(([key,value])=>key!=='wingStructure'&&value!==null).reduce((sum,[,value])=>sum+value,0);
  const knownCount=massBudget.filter(([,value])=>value!==null).length;
  const massImpact=pick&&wingMass===null?`입력된 다른 구성품 ${fmt(otherMass,2)} kg + 스파 ${fmt(pick.massKg,3)} kg = 최소 ${fmt(otherMass+pick.massKg,3)} kg`:
    pick?`입력된 주익 구조 ${fmt(wingMass,3)} kg 중 스파 ${fmt(pick.massKg,3)} kg · 이중 합산 없음`:'TBD';
  summary.innerHTML=`<div class="optimization-head"><div><span class="feasibility-verdict ${o.recommended?'status-pass':'status-tbd'}">${o.recommended?'최저 질량 추천안':'잠정 후보 · 검증 보류'}</span><h3>${pick?fmt(pick.depthMm,1)+' mm':'사용 가능한 후보 없음'}</h3><p>익근 최대두께 상한 ${fmt(o.rootMaxThicknessMm,1)} mm · 사용 가능 깊이 ${fmt(o.availableRootMm,1)} mm · 탐색 ${fmt(o.candidates[0].depthMm,1)}–${fmt(o.candidates.at(-1).depthMm,1)} mm</p></div><p class="micro">${o.verifiedThickness?'입력한 스파 위치 두께를 사용했습니다.':'t/c × 시위의 최대두께 상한을 사용했습니다. 실제 x/c 두께 확인 전에는 장착을 확정할 수 없습니다.'}</p></div>`+
    (pick?`<div class="optimization-metrics"><div><span>익근 캡 면적 / 두께</span><strong>${fmt(pick.rootCapAreaMm2,2)} mm² 필요 · ${pick.rootCapThicknessMm===null?'선정 TBD':fmt(pick.rootCapThicknessMm*r.state.sparDesign.capWidthMm,2)+' mm² 선정 / '+fmt(pick.rootCapThicknessMm,2)+' mm'}</strong></div><div><span>웹 두께</span><strong>${fmt(pick.rootWebThicknessMm,3)} mm 이론 · ${pick.manufacturingStatus==='PASS'?fmt(pick.rootSelectedWebThicknessMm,3)+' mm 선정':'TBD 선정'}</strong></div><div><span>양쪽 날개 스파 질량</span><strong>${fmt(pick.massKg,3)} kg ${pick.manufacturingStatus==='PASS'?'제작 최소값 반영':'이론 최소값'}</strong></div><div><span>강도 MS · 처짐</span><strong>${fmt(pick.strengthMargin,2)} · ${pick.predictedDeflectionMm===null?'TBD':fmt(pick.predictedDeflectionMm,1)+' mm'}</strong></div><div><span>주익 전체 구조중량</span><strong>${wingMass===null?'TBD':fmt(wingMass,3)+' kg'}</strong></div><div><span>제작 최소값 질량 영향</span><strong>${pick.manufacturingStatus==='PASS'?'+'+fmt(pick.massKg-pick.theoreticalMassKg,3)+' kg':'TBD'}</strong></div></div>`:'')+
    `<p class="micro">${esc(massImpact)} · MTOW 잔여 상한(입력분 기준) ${pick?fmt(r.state.feasibility.mtowLimit-(otherMass+(wingMass??pick.massKg)),3)+' kg':'TBD'}${knownCount<10?' · 미입력 구성품이 있어 MTOW PASS 판정 불가':''}</p><p class="micro">${missing.length?'확인 필요: '+esc(missing.join(', ')):'입력된 강도·강성·제작 조건으로 탐색했습니다.'}</p>`;
  const chartDefs=[['optimizationMass','massKg','스파 질량 [kg]'],['optimizationCap','rootCapAreaMm2','익근 캡 필요 면적 [mm²]'],['optimizationWeb','rootWebThicknessMm','익근 웹 이론 두께 [mm]'],['optimizationDeflection','predictedDeflectionMm','날개끝 처짐 [mm]'],['optimizationMargin','strengthMargin','최소 Strength MS']];
  for(const [id,key,yTitle] of chartDefs){
    const target=document.getElementById(id);
    if(!window.Plotly){target.textContent='그래프를 불러오는 중입니다.';continue;}
    if(key==='predictedDeflectionMm'&&!o.candidates.some(c=>c[key]!==null)){
      if(target.data)Plotly.purge(target);
      target.innerHTML='<div class="plot-fallback">탄성계수 E 입력 후 처짐을 계산합니다.</div>';continue;
    }
    const colors=o.candidates.map(c=>c.eligible?'#48d6a3':c.manufacturingStatus==='TBD'?'#f4bf69':'#ef8792');
    Plotly.react(target,[{type:'scatter',mode:'lines+markers',x:o.candidates.map(c=>c.depthMm),y:o.candidates.map(c=>c[key]),
      marker:{color:colors,size:9,line:{color:'#1b3045',width:1}},line:{color:'#7192ac',width:1},
      customdata:o.candidates.map(c=>c.index),hovertemplate:'깊이 %{x:.1f} mm<br>결과 %{y:.3f}<extra>점을 눌러 상세 보기</extra>'}],{
      ...AST.plotLayout(yTitle),xaxis:{title:'익근 스파 깊이 [mm]',gridcolor:'#30485f'},margin:{l:60,r:16,t:10,b:52}
    },{responsive:true,displaylogo:false});
    if(!target.astClickBound){target.on('plotly_click',ev=>{AST.selectedCandidateIndex=ev.points[0].customdata;AST.renderCandidateDetail(AST.lastResult);});target.astClickBound=true;}
  }
  AST.renderCandidateDetail(r);
};
AST.renderCandidateDetail=function(r){
  const o=r.optimization,esc=AST.escape,fmt=AST.fmt;
  const c=o.candidates[AST.selectedCandidateIndex??o.recommended?.index??o.provisional?.index??0];
  if(!c)return;
  document.getElementById('candidateDetail').innerHTML=`<h3>후보 ${c.index+1} / ${o.candidates.length} · ${fmt(c.depthMm,1)} mm</h3><div class="candidate-grid">
    <span>장착 깊이</span><strong>${c.packagingStatus}</strong><span>강도</span><strong>${c.strengthPass?'PASS':'FAIL'}</strong>
    <span>제작 최소값</span><strong>${c.manufacturingStatus}</strong><span>강성</span><strong>${c.stiffnessPass===null?'TBD':c.stiffnessPass?'PASS':'FAIL'}</strong>
    <span>익근 캡 면적 / 선정 두께</span><strong>${fmt(c.rootCapAreaMm2,2)} mm² / ${c.rootCapThicknessMm===null?'TBD':fmt(c.rootCapThicknessMm,3)+' mm'}</strong>
    <span>익근 웹 이론 / 선정</span><strong>${fmt(c.rootWebThicknessMm,3)} / ${c.manufacturingStatus==='PASS'?fmt(c.rootSelectedWebThicknessMm,3)+' mm':'TBD'}</strong>
    <span>상·하 캡 / 웹 질량</span><strong>${fmt(c.upperCapMassKg,3)} / ${fmt(c.lowerCapMassKg,3)} / ${fmt(c.webMassKg,3)} kg</strong>
    <span>합계 / 이론 하한</span><strong>${fmt(c.massKg,3)} / ${fmt(c.theoreticalMassKg,3)} kg</strong>
    <span>캡 / 웹 MS</span><strong>${fmt(c.capMargin,2)} / ${fmt(c.webMargin,2)}</strong>
    <span>최대 캡 응력 / 웹 전단</span><strong>${fmt(c.capStressMpa,1)} / ${fmt(c.webShearMpa,1)} MPa</strong>
    <span>예상 날개끝 처짐</span><strong>${c.predictedDeflectionMm===null?'TBD':fmt(c.predictedDeflectionMm,2)+' mm'}</strong></div><p class="micro">${esc(c.eligible?'추천 조건 통과':'추천 조건 미충족 또는 추가 입력 필요')} · EI는 캡 2개와 웹의 단면 2차모멘트로 계산한 선형 보 근사입니다. 국부 좌굴·접합부·동체 관통 공간은 미검증입니다.</p>`;
};
