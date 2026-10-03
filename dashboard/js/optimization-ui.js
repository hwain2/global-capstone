window.AST = window.AST || {};
AST.sparSectionSVG=function(r,pick){
  const o=r.optimization,s=r.state,fmt=AST.fmt,esc=AST.escape;
  const rootChordMm=s.wing.rootChord*1000,scaleY=90/o.rootMaxThicknessMm;
  const point=x=>[20+280*x,75-AST.naca4ThicknessFactor(Math.max(.0001,x))*45];
  const top=Array.from({length:51},(_,i)=>point(i/50));
  const outline='M '+top.map(([x,y])=>x.toFixed(1)+' '+y.toFixed(1)).join(' L ')+
    ' L '+top.slice().reverse().map(([x,y])=>x.toFixed(1)+' '+(150-y).toFixed(1)).join(' L ')+' Z';
  const x=20+280*s.sparDesign.sparXc,available=o.availableRootMm*scaleY;
  const depth=pick?pick.depthMm*scaleY:0;
  const cap=pick?.rootCapThicknessMm===null||!pick?null:pick.rootCapThicknessMm*scaleY;
  const web=pick?.manufacturingStatus==='PASS'?pick.rootSelectedWebThicknessMm:null;
  const webPx=web===null?null:Math.max(1,web*280/rootChordMm);
  const capWidth=Math.max(3,o.rootCapWidthMm*280/rootChordMm);
  const fitRatio=pick&&cap!==null?(pick.depthMm+pick.rootCapThicknessMm)/o.availableRootMm:null;
  const fit=!pick||cap===null||web===null?'tbd':!pick.packagingPass||fitRatio>1?'fail':fitRatio>.8?'near':'pass';
  const color={pass:'#64d9a0',near:'#f3c26f',fail:'#f1858d',tbd:'#97adc0'}[fit];
  const status={pass:'장착 여유',near:'장착 여유 작음',fail:'장착 불가',tbd:'선정 단면 TBD'}[fit];
  return `<div class="spar-section-compact"><svg viewBox="0 0 380 150" role="img" aria-label="${esc('익근 에어포일 개념 단면과 스파: '+status)}">
    <path d="${outline}" fill="#254257" stroke="#78b4d2" stroke-width="2"/>
    <rect x="${(x-capWidth/2-5).toFixed(1)}" y="${(75-available/2).toFixed(1)}" width="${(capWidth+10).toFixed(1)}" height="${available.toFixed(1)}" fill="#4c9baf28" stroke="#8bd0e2" stroke-width="1.5" stroke-dasharray="4 3"/>
    ${pick&&cap!==null?`<rect x="${(x-capWidth/2).toFixed(1)}" y="${(75-depth/2-cap/2).toFixed(1)}" width="${capWidth.toFixed(1)}" height="${Math.max(1,cap).toFixed(1)}" fill="${color}"/>
    <rect x="${(x-capWidth/2).toFixed(1)}" y="${(75+depth/2-cap/2).toFixed(1)}" width="${capWidth.toFixed(1)}" height="${Math.max(1,cap).toFixed(1)}" fill="${color}"/>
    ${webPx===null?'':`<rect x="${(x-webPx/2).toFixed(1)}" y="${(75-depth/2).toFixed(1)}" width="${webPx.toFixed(1)}" height="${depth.toFixed(1)}" fill="${color}"/>`}
    <path d="M${(x+capWidth/2+9).toFixed(1)} ${(75-depth/2).toFixed(1)} V${(75+depth/2).toFixed(1)}" stroke="${color}" stroke-width="2" marker-start="url(#spar-arrow)" marker-end="url(#spar-arrow)"/>`:`<text x="${x.toFixed(1)}" y="77" text-anchor="middle" fill="#d2e3ec" font-size="10">Cap / Web TBD</text>`}
    <defs><marker id="spar-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M0 5 L2.5 0 L5 5" fill="${color}"/></marker></defs>
    <text x="310" y="42" fill="#a9dcea" font-size="10">Available</text>
    <text x="310" y="78" fill="${color}" font-size="10">${o.recommended?'Selected':'Required'}</text>
  </svg><div class="spar-section-facts"><strong style="color:${color}">${status}</strong><span>Wing max thickness ${fmt(o.rootMaxThicknessMm,1)} mm</span><span>Available depth ${fmt(o.availableRootMm,1)} mm</span><span>${o.recommended?'Selected':'Required'} spar ${pick?fmt(pick.depthMm,1)+' mm':'TBD'}</span></div><small>Conceptual section based on t/c — actual airfoil geometry not applied</small></div>`;
};
AST.renderOptimization=function(r){
  const o=r.optimization,fmt=AST.fmt,esc=AST.escape;
  const pick=o.recommended||o.provisional;
  const summary=document.getElementById('optimizationSummary');
  const missing=[];
  if(r.state.sparDesign.capWidthMm===null&&r.state.sparDesign.capWidthRatio===null)missing.push('캡 폭');
  if(r.state.sparDesign.manufacturingMinCapMm===null)missing.push('제작 최소 캡 두께');
  if(r.state.sparDesign.manufacturingMinWebMm===null)missing.push('제작 최소 웹 두께');
  if(r.state.material.elasticModulusGPa===null)missing.push('탄성계수 E');
  if(r.state.feasibility.tipDeflectionLimitMm===null)missing.push('허용 날개끝 처짐');
  const assessment=AST.assessFeasibility(r);
  const outcome=assessment.verdict;
  const reason=assessment.conclusion;
  summary.innerHTML=`<div class="optimization-head"><div><span class="feasibility-verdict ${outcome==='경험식 기준 가능'?'status-pass':outcome==='입력 부족'?'status-tbd':'status-fail'}">${outcome}</span><h3>${pick?fmt(pick.depthMm,1)+' mm':'선정 후보 없음'}</h3><p>익근 최대두께 ${fmt(o.rootMaxThicknessMm,1)} mm · 사용 가능 깊이 ${fmt(o.availableRootMm,1)} mm · 탐색 ${fmt(o.candidates[0].depthMm,1)}–${fmt(o.candidates.at(-1).depthMm,1)} mm</p></div><p class="micro">${o.verifiedThickness?'입력한 스파 위치 두께를 사용했습니다.':`NACA 4계열 형상 가정 · x/c ${fmt(r.state.sparDesign.sparXc,2)} · 깊이 활용률 ${fmt(r.state.sparDesign.depthFactor,2)}. 실제 익형 좌표는 후속 확인이 필요합니다.`}</p></div>`+
    AST.sparSectionSVG(r,pick)+
    (pick?`<div class="optimization-metrics"><div><span>강도 필요 캡 면적</span><strong>${fmt(pick.rootCapAreaMm2,1)} mm²</strong></div><div><span>강성 필요 캡 면적</span><strong>${pick.rootStiffnessCapAreaMm2===null?'TBD':fmt(pick.rootStiffnessCapAreaMm2,1)+' mm²'}</strong></div><div><span>선정 캡 면적 / 두께</span><strong>${pick.rootSelectedCapAreaMm2===null?'TBD':fmt(pick.rootSelectedCapAreaMm2,1)+' mm² / '+fmt(pick.rootCapThicknessMm,1)+' mm'}</strong></div><div><span>선정 웹 두께</span><strong>${pick.manufacturingStatus==='PASS'?fmt(pick.rootSelectedWebThicknessMm,2)+' mm':'TBD'}</strong></div><div><span>날개끝 처짐</span><strong>${pick.predictedDeflectionMm===null?'TBD':fmt(pick.predictedDeflectionMm,1)+' / '+fmt(r.state.feasibility.tipDeflectionLimitMm,0)+' mm'}</strong></div><div><span>필요 스파 질량 · 양쪽 날개</span><strong>${fmt(pick.massKg,2)} kg</strong></div><div><span>주익 경험식 중량</span><strong>${fmt(o.empiricalWingMassKg,2)} kg</strong></div><div><span>스파 / 주익 경험식</span><strong>${fmt(100*o.sparToWingRatio,0)}% · WEIGHT REVIEW</strong></div></div>`:'')+
    `<p class="micro">${esc(reason)} · Vertical packaging ${pick?(pick.packagingPass?'PASS':'FAIL'):'TBD'} · Cap geometry PROVISIONAL (${r.state.sparDesign.capWidthMm===null?'캡 폭 시위비 가정':'캡 폭 입력값'}, 익형 좌표 미적용). ${pick&&!o.recommended?'표시한 강성 필요 단면은 추천안이 아닙니다. ':''}</p><p class="micro">${missing.length?'필수 입력: '+esc(missing.join(', ')): 'Raymer 주익 중량에는 스파가 포함됩니다. 스파 질량을 더하지 않으며 차이를 skin/rib 질량으로 해석하지 않습니다.'}</p>`;
  const chartDefs=[['optimizationMass','massKg','최종 스파 질량 [kg]'],['optimizationCap','rootSelectedCapAreaMm2','익근 선정 캡 면적 [mm²]'],['optimizationWeb','rootSelectedWebThicknessMm','익근 선정 웹 두께 [mm]'],['optimizationDeflection','predictedDeflectionMm','최종 날개끝 처짐 [mm]'],['optimizationMargin','strengthMargin','최소 Strength MS']];
  if(!document.getElementById('tradeStudyDetails').open){AST.renderCandidateDetail(r);return;}
  for(const [id,key,yTitle] of chartDefs){
    const target=document.getElementById(id);
    if(!window.Plotly){target.textContent='그래프를 불러오는 중입니다.';continue;}
    if(key==='predictedDeflectionMm'&&!o.candidates.some(c=>c[key]!==null)){
      if(target.data)Plotly.purge(target);
      target.innerHTML='<div class="plot-fallback">탄성계수 E 입력 후 처짐을 계산합니다.</div>';continue;
    }
    const colors=o.candidates.map(c=>c.eligible&&c.massKg<o.empiricalWingMassKg?'#48d6a3':c.manufacturingStatus==='TBD'?'#f4bf69':'#ef8792');
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
    <span>익근 캡: 강도 / 강성 / 선정</span><strong>${fmt(c.rootCapAreaMm2,2)} / ${c.rootStiffnessCapAreaMm2===null?'TBD':fmt(c.rootStiffnessCapAreaMm2,2)} / ${c.rootSelectedCapAreaMm2===null?'TBD':fmt(c.rootSelectedCapAreaMm2,2)} mm²</strong>
    <span>익근 웹 이론 / 선정</span><strong>${fmt(c.rootWebThicknessMm,3)} / ${c.manufacturingStatus==='PASS'?fmt(c.rootSelectedWebThicknessMm,3)+' mm':'TBD'}</strong>
    <span>상·하 캡 / 웹 질량</span><strong>${fmt(c.upperCapMassKg,3)} / ${fmt(c.lowerCapMassKg,3)} / ${fmt(c.webMassKg,3)} kg</strong>
    <span>합계 / 이론 하한</span><strong>${fmt(c.massKg,3)} / ${fmt(c.theoreticalMassKg,3)} kg</strong>
    <span>캡 / 웹 MS</span><strong>${fmt(c.capMargin,2)} / ${fmt(c.webMargin,2)}</strong>
    <span>최대 캡 응력 / 웹 전단</span><strong>${fmt(c.capStressMpa,1)} / ${fmt(c.webShearMpa,1)} MPa</strong>
    <span>예상 날개끝 처짐</span><strong>${c.predictedDeflectionMm===null?'TBD':fmt(c.predictedDeflectionMm,2)+' mm'}</strong></div><p class="micro">${esc(c.eligible?'강도·강성·내부공간 충족':'추천 조건 미충족: 강성 필요 단면의 공간·질량 확인')} · 일정한 캡 증량비를 반날개에 적용한 간이 모델입니다. 국부 좌굴·접합부·동체 관통 공간은 미검증입니다.</p>`;
};
