window.AST = window.AST || {};
AST.budgetLabels = {
  wingStructure:'주익 구조', fuselageStructure:'동체 구조', tailStructure:'미익 구조',
  landingGear:'착륙장치', propulsion:'추진계', battery:'배터리·전원',
  avionics:'항전', wiring:'배선·PMU', payload:'탑재물', other:'기타'
};
AST.assessFeasibility = function(r){
  const s=r.state,b=s.weightBudget,o=r.optimization,L=r.loads,fmt=AST.fmt;
  const wing=r.weight.raymerWing,fuselage=r.weight.raymerFuse,empty=r.weight.finger;
  const factors=[s.sparDesign.depthFactor-0.1,s.sparDesign.depthFactor,s.sparDesign.depthFactor+0.1]
    .map(v=>Math.min(1,Math.max(0.01,v)));
  const studies=factors.map(factor=>{
    if(Math.abs(factor-s.sparDesign.depthFactor)<1e-10)return o;
    const trial=AST.clone(s);
    trial.sparDesign.depthFactor=factor;
    return AST.optimizeSpar(trial,L);
  });
  // Detailed stiffness remains in the automatic sizing study; this is an empirical strength/fit screen.
  const best=study=>study.candidates.filter(c=>c.packagingPass&&c.strengthPass&&c.manufacturingStatus==='PASS')
    .reduce((selected,c)=>!selected||c.massKg<selected.massKg?c:selected,null);
  const scenarioCandidates=studies.map(best),sized=scenarioCandidates[1],successes=scenarioCandidates.filter(Boolean).length;
  const sparStatus=!o.buildInputsReady?'TBD':successes===studies.length?'PASS':successes===0?'FAIL':'TBD';
  // Spar is already part of the Raymer wing estimate. Use the larger value as a lower bound, never their sum.
  const wingLower=Math.max(wing,sized?.massKg??0),structuralLower=wingLower+fuselage;
  const entries=Object.entries(b),complete=entries.every(([,value])=>value!==null);
  const budgetTotal=entries.reduce((sum,[,value])=>sum+(value??0),0);
  const otherKnown=entries.filter(([key,value])=>key!=='wingStructure'&&key!=='fuselageStructure'&&value!==null)
    .reduce((sum,[,value])=>sum+value,0);
  const knownLower=otherKnown+Math.max(wingLower,b.wingStructure??0)+Math.max(fuselage,b.fuselageStructure??0);
  const empiricalFail=empty>s.feasibility.designTarget || empty>s.feasibility.mtowLimit || structuralLower>empty;
  const budgetFail=knownLower>s.feasibility.mtowLimit || complete &&
    (budgetTotal>s.feasibility.mtowLimit || b.wingStructure<wingLower || b.fuselageStructure<fuselage);
  const weightStatus=empiricalFail||budgetFail?'FAIL':'PASS';
  const governing=Math.max(L.ultimate,L.gustUltimate);
  const loadStatus=Number.isFinite(o.designLoad)&&o.designLoad>=governing-1e-8?'PASS':'TBD';
  const cards=[
    {title:'구조중량',status:weightStatus,value:`Wing ${fmt(wing)} kg / Fuselage ${fmt(fuselage)} kg`,
      criterion:`Finger 공허중량 ${fmt(empty)} kg ≤ 설계 목표 ${fmt(s.feasibility.designTarget,1)} kg; 구조 하한 ${fmt(structuralLower)} kg ≤ 공허중량. 전체 MTOW는 별도.`,
      margin:`공허중량 추정 여유 ${fmt(s.feasibility.designTarget-empty)} kg`,
      cause:weightStatus==='PASS'?'경험식 공허중량과 주익·동체·스파 중량 하한이 초기 목표 범위 안에 있습니다. 전체 구성품 MTOW는 미검증입니다.':
        '경험식 공허중량, 구조중량 하한 또는 입력된 중량 예산이 목표를 초과합니다.',
      action:weightStatus==='PASS'?'추진계·배터리·탑재물 질량이 확정되면 전체 MTOW를 확인하세요.':'중량 목표와 형상·구조 중량 가정을 검토하세요.'},
    {title:'설계하중',status:loadStatus,value:`Ultimate lift ${fmt(o.designLoad/1000,2)} kN`,
      criterion:'극한 기동하중과 양의 돌풍하중 중 지배값을 스파 sizing에 적용',
      margin:'—',cause:loadStatus==='PASS'?'지배 극한하중을 자동 sizing에 반영했습니다.':'지배 날개 하중을 산정할 수 없습니다.',
      action:loadStatus==='PASS'?'하중 조건의 입력 근거를 확인하세요.':'기동·돌풍 하중 입력을 확인하세요.'},
    {title:'스파 간이 Sizing',status:sparStatus,
      value:`Available ${fmt(o.availableRootMm,1)} mm / ${sized?'Selected '+fmt(sized.depthMm,1)+' mm':o.provisional?'잠정 '+fmt(o.provisional.depthMm,1)+' mm':'해 없음'}`,
      criterion:`가정 깊이 활용률 ${factors.map(v=>fmt(v,2)).join(' / ')}에서 캡·웹 강도, 장착, 최소두께 확인`,
      margin:sized?`Spar ${fmt(sized.massKg,3)} kg`:sparStatus==='FAIL'?'가정 범위에서 장착 가능한 단면 없음':'가정 범위에 따라 판정 변경',
      cause:sparStatus==='PASS'?'구조팀 가정 범위 모두에서 요구 단면이 날개 내부에 들어갑니다.':
        sparStatus==='FAIL'?'현재 가정 범위의 날개 내부에서 요구 단면을 확보할 수 없습니다.':'가정 깊이에 따라 가능 여부가 달라지거나 제작값이 누락됐습니다.',
      action:sparStatus==='FAIL'?'t/c 또는 익근 시위를 늘리고 스파 구조를 검토하세요.':
        sparStatus==='TBD'?'깊이 활용률과 캡·웹 제작 가정을 확인하세요.':'실제 익형 두께와 상세 구조를 후속 검증하세요.'}
  ];
  const verdict=cards.some(c=>c.status==='FAIL')?'경험식 기준 불가능':cards.some(c=>c.status==='TBD')?'입력 부족':'경험식 기준 가능';
  const conclusion=verdict==='경험식 기준 가능'?'구조팀 가정 범위에서 경험식·간이 스파 sizing 기준으로 Baseline 형상 사용 가능':
    sparStatus==='FAIL'?'현재 날개 내부에서 요구 스파 단면 확보 불가 → t/c 또는 익근 시위 수정 필요':
    weightStatus==='FAIL'?'중량 경험식 또는 중량 예산이 목표 초과 → 형상과 중량 배분 수정 필요':
    '깊이·제작 가정에 따라 스파 결과가 달라짐 → 구조팀 가정 확인 필요';
  const note='구조팀 가정 기반 개념설계 판정입니다. 전체 MTOW와 처짐·좌굴·적층 등 상세 구조해석은 별도 검증이 필요합니다.';
  return {cards,verdict,conclusion,note,lead:conclusion,actions:cards.filter(c=>c.status!=='PASS').map(c=>c.action),
    budget:{total:budgetTotal,missing:entries.filter(([,v])=>v===null).map(([k])=>AST.budgetLabels[k])},
    scenarios:factors.map((depthFactor,i)=>({depthFactor,candidate:scenarioCandidates[i]}))};
};
AST.renderFeasibility=function(r){
  const a=AST.assessFeasibility(r),esc=AST.escape;
  const state=a.verdict==='경험식 기준 가능'?'pass':a.verdict==='경험식 기준 불가능'?'fail':'tbd';
  document.getElementById('feasibilityVerdict').innerHTML=`<strong class="feasibility-verdict status-${state}">${esc(a.verdict)}</strong>`;
  document.getElementById('feasibilityCards').innerHTML=a.cards.map(c=>
    `<div class="feasibility-brief-row status-${c.status.toLowerCase()}"><strong>${esc(c.title)}</strong><span class="status-pill status-${c.status.toLowerCase()}">${c.status}</span><span>${esc(c.value)}</span></div>`).join('');
  document.getElementById('feasibilityConclusion').textContent=a.conclusion;
  document.getElementById('feasibilityNote').textContent=a.note;
};
AST.renderFeasibilityErrors=function(){
  document.getElementById('feasibilityVerdict').innerHTML='<strong class="feasibility-verdict status-tbd">입력 부족</strong>';
  document.getElementById('feasibilityCards').innerHTML=['구조중량','설계하중','스파 간이 Sizing'].map(title=>
    `<div class="feasibility-brief-row status-tbd"><strong>${title}</strong><span class="status-pill status-tbd">TBD</span><span>입력값 확인 필요</span></div>`).join('');
  document.getElementById('feasibilityConclusion').textContent='입력 오류를 수정한 뒤 경험식 기준 판정을 확인하세요.';
  document.getElementById('feasibilityNote').textContent='본 판정은 개념설계 단계의 경험식/간이 모델 기준이며 상세 구조해석 결과가 아닙니다.';
};
