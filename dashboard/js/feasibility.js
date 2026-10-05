window.AST = window.AST || {};
AST.budgetLabels = {
  wingStructure:'주익 구조', fuselageStructure:'동체 구조', tailStructure:'미익 구조',
  landingGear:'착륙장치', propulsion:'추진계', battery:'배터리·전원',
  avionics:'항전', wiring:'배선·PMU', payload:'탑재물', other:'기타'
};
AST.assessFeasibility = function(r){
  const s=r.state,b=s.weightBudget,o=r.optimization,L=r.loads,fmt=AST.fmt;
  const wing=r.weight.raymerWing,fuselage=r.weight.raymerFuse,empty=r.weight.finger;
  const sized=o.recommended||o.provisional;
  const inputsReady=o.buildInputsReady&&s.material.elasticModulusGPa!==null&&
    s.feasibility.tipDeflectionLimitMm!==null;
  const sparStatus=!inputsReady?'TBD':o.recommended?'PASS':'FAIL';
  const stiffnessReady=s.material.elasticModulusGPa!==null&&s.feasibility.tipDeflectionLimitMm!==null;
  const stiffnessStatus=!stiffnessReady||!sized?'TBD':sized.stiffnessPass?'PASS':'FAIL';
  // Spar is already part of the Raymer wing estimate. Use the larger value as a lower bound, never their sum.
  const wingLower=Math.max(wing,sized?.massKg??0),structuralLower=wingLower+fuselage;
  const entries=Object.entries(b),complete=entries.every(([,value])=>value!==null);
  const budgetTotal=entries.reduce((sum,[,value])=>sum+(value??0),0);
  const otherKnown=entries.filter(([key,value])=>key!=='wingStructure'&&key!=='fuselageStructure'&&value!==null)
    .reduce((sum,[,value])=>sum+value,0);
  const knownLower=otherKnown+Math.max(wingLower,b.wingStructure??0)+Math.max(fuselage,b.fuselageStructure??0);
  const empiricalFail=empty>s.feasibility.designTarget || empty>s.feasibility.mtowLimit ||
    structuralLower>empty || (sized&&sized.massKg>=wing);
  const budgetFail=knownLower>s.feasibility.mtowLimit || complete &&
    (budgetTotal>s.feasibility.mtowLimit || b.wingStructure<wingLower || b.fuselageStructure<fuselage);
  const weightStatus=!inputsReady||!sized?'TBD':!o.recommended&&sized.massKg<wing?'TBD':
    empiricalFail||budgetFail?'FAIL':'PASS';
  const governing=Math.max(L.ultimate,L.gustUltimate);
  const loadStatus=Number.isFinite(o.designLoad)&&o.designLoad>=governing-1e-8?'PASS':'TBD';
  const cards=[
    {title:'구조중량',status:weightStatus,value:`Wing ${fmt(wing)} kg / Spar ${sized?fmt(sized.massKg):'TBD'} kg`,
      criterion:`Finger 공허중량 ${fmt(empty)} kg ≤ 설계 목표 ${fmt(s.feasibility.designTarget,1)} kg; 구조 하한 ${fmt(structuralLower)} kg ≤ 공허중량. 전체 MTOW는 별도.`,
      margin:`공허중량 추정 여유 ${fmt(s.feasibility.designTarget-empty)} kg`,
      cause:weightStatus==='PASS'?'경험식 주익 중량에 스파가 포함되어 있으며 추정 스파 질량이 전체 주익 경험식 중량보다 작습니다. 전체 구성품 MTOW는 미검증입니다.':
        !o.recommended&&sized&&sized.massKg>=wing?'장착되지 않는 진단 후보조차 주익 경험식 중량을 초과합니다.':
        '경험식 공허중량, 구조중량 하한 또는 입력된 중량 예산이 목표를 초과합니다.',
      action:weightStatus==='PASS'?'추진계·배터리·탑재물 질량이 확정되면 전체 MTOW를 확인하세요.':'중량 목표와 형상·구조 중량 가정을 검토하세요.'},
    {title:'설계하중',status:loadStatus,value:`Ultimate lift ${fmt(o.designLoad/1000,2)} kN`,
      criterion:'극한 기동하중과 양의 돌풍하중 중 지배값을 스파 sizing에 적용',
      margin:'—',cause:loadStatus==='PASS'?'지배 극한하중을 자동 sizing에 반영했습니다.':'지배 날개 하중을 산정할 수 없습니다.',
      action:loadStatus==='PASS'?'하중 조건의 입력 근거를 확인하세요.':'기동·돌풍 하중 입력을 확인하세요.'},
    {title:'스파 간이 Sizing',status:sparStatus,
      value:sized?`${o.recommended?'Selected':'Required'} outer ${fmt(sized.depthMm+(sized.rootCapThicknessMm??0),1)} mm / Footprint ${fmt(sized.rootFootprintAvailableMm,1)} mm`:
        `Spar station ${fmt(o.availableRootMm,1)} mm / 해 없음`,
      criterion:'선정 캡·웹의 강도, 강성, 내부 공간 및 제작 최소두께 확인',
      margin:sized?`Spar ${fmt(sized.massKg,3)} kg`:sparStatus==='FAIL'?'가정 범위에서 장착 가능한 단면 없음':'가정 범위에 따라 판정 변경',
      cause:sparStatus==='PASS'?'선정한 강도·강성 충족 단면이 개념 내부 공간에 들어갑니다.':
        sparStatus==='FAIL'?'강성까지 만족하는 스파 단면이 현재 개념 내부 공간에 들어가지 않습니다.':'필수 제작값이나 강성 입력이 누락됐습니다.',
      action:sparStatus==='FAIL'?'t/c 또는 익근 시위를 늘리고 스파 구조를 검토하세요.':
        sparStatus==='TBD'?'깊이 활용률과 캡·웹 제작 가정을 확인하세요.':'실제 익형 두께와 상세 구조를 후속 검증하세요.'},
    {title:'강성',status:stiffnessStatus,
      value:`Tip deflection ${sized?.predictedDeflectionMm===null||!sized?'TBD':fmt(sized.predictedDeflectionMm,1)+' mm'} / Allowable ${s.feasibility.tipDeflectionLimitMm===null?'TBD':fmt(s.feasibility.tipDeflectionLimitMm,0)+' mm'}`,
      criterion:'반날개 균일 제한 기동하중 · 캡/웹 EI · 날개끝 처짐',
      margin:sized&&stiffnessReady?`처짐 여유 ${fmt(s.feasibility.tipDeflectionLimitMm-sized.predictedDeflectionMm,1)} mm`:'—',
      cause:stiffnessStatus==='PASS'?'산정된 간이 스파 단면이 허용 처짐을 만족합니다. 장착 가능 여부는 별도로 판정합니다.':
        stiffnessStatus==='FAIL'?'현재 날개 내부의 탐색 후보가 제한하중 처짐 기준을 만족하지 못합니다.':'탄성계수·허용 처짐 또는 구조 후보 확인이 필요합니다.',
      action:stiffnessStatus==='FAIL'?'캡 강성, 익형 두께, 익근 시위 또는 스파 구조를 재검토하세요.':'E와 처짐 기준을 확인하세요.'}
  ];
  const verdict=!inputsReady?'입력 부족':cards.some(c=>c.status==='FAIL')?'경험식 기준 불가능':'경험식 기준 가능';
  const conclusion=verdict==='경험식 기준 가능'?'구조팀 가정 범위에서 경험식·간이 스파 sizing 기준으로 Baseline 형상 사용 가능':
    sparStatus==='FAIL'?`폭·깊이 탐색에서 개념 익형에 들어가는 강도·강성 스파를 찾지 못함${sized&&sized.massKg>=wing?' · 가장 가까운 진단 후보도 주익 경험식 중량 초과':''} → t/c·시위 또는 스파 구조 검토 필요`:
    stiffnessStatus==='FAIL'?'제한 기동하중에서 날개끝 처짐 기준 초과 → 스파 강성 또는 날개 형상 수정 필요':
    sized&&sized.massKg>=wing?'장착 가능한 최소질량 스파가 주익 전체 경험식 중량 이상 → 현재 경험식 기준 형상 재검토 필요':
    weightStatus==='FAIL'?'중량 경험식 또는 중량 예산이 목표 초과 → 형상과 중량 배분 수정 필요':
    '깊이·제작 가정에 따라 스파 결과가 달라짐 → 구조팀 가정 확인 필요';
  const modulusText=s.material.elasticModulusGPa===null?'TBD':fmt(s.material.elasticModulusGPa,1)+' GPa';
  const limitText=s.feasibility.tipDeflectionLimitMm===null?'TBD':fmt(s.feasibility.tipDeflectionLimitMm,0)+' mm';
  const note=`개념설계 경험식·간이 보 모델 판정입니다. NACA4 개념 익형의 캡 폭 전체를 검사했으며 실제 익형 좌표는 미적용입니다. E ${modulusText} [${s.sources['material.elasticModulusGPa']||'ASSUMED'}], 허용 처짐 ${limitText} [${s.sources['feasibility.tipDeflectionLimitMm']||'ASSUMED'}]. 전체 MTOW·좌굴·적층·접합부·FEA는 별도 검증이 필요합니다.`;
  return {cards,verdict,conclusion,note,lead:conclusion,actions:cards.filter(c=>c.status!=='PASS').map(c=>c.action),
    budget:{total:budgetTotal,missing:entries.filter(([,v])=>v===null).map(([k])=>AST.budgetLabels[k])}};
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
  document.getElementById('feasibilityCards').innerHTML=['구조중량','설계하중','스파 간이 Sizing','강성'].map(title=>
    `<div class="feasibility-brief-row status-tbd"><strong>${title}</strong><span class="status-pill status-tbd">TBD</span><span>입력값 확인 필요</span></div>`).join('');
  document.getElementById('feasibilityConclusion').textContent='입력 오류를 수정한 뒤 경험식 기준 판정을 확인하세요.';
  document.getElementById('feasibilityNote').textContent='본 판정은 개념설계 단계의 경험식/간이 모델 기준이며 상세 구조해석 결과가 아닙니다.';
};
