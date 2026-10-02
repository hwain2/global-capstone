window.AST = window.AST || {};
AST.budgetLabels = {
  wingStructure:'주익 구조', fuselageStructure:'동체 구조', tailStructure:'미익 구조',
  landingGear:'착륙장치', propulsion:'추진계', battery:'배터리·전원',
  avionics:'항전', wiring:'배선·PMU', payload:'탑재물', other:'기타'
};
AST.assessFeasibility = function(r){
  const s=r.state,b=s.weightBudget,o=r.optimization,L=r.loads;
  const fmt=(n,p=2)=>AST.fmt(n,p);
  const wing=r.weight.raymerWing,fuselage=r.weight.raymerFuse;
  const entries=Object.entries(b),complete=entries.every(([,value])=>value!==null);
  const budgetTotal=entries.reduce((sum,[,value])=>sum+(value??0),0);
  const otherKnown=entries.filter(([key,value])=>key!=='wingStructure'&&key!=='fuselageStructure'&&value!==null)
    .reduce((sum,[,value])=>sum+value,0);
  const empiricalLowerBound=otherKnown+Math.max(wing,b.wingStructure??0)+Math.max(fuselage,b.fuselageStructure??0);
  const weightFail=empiricalLowerBound>s.feasibility.mtowLimit || complete &&
    (budgetTotal>s.feasibility.mtowLimit || b.wingStructure<wing || b.fuselageStructure<fuselage);
  const weightStatus=weightFail?'FAIL':complete?'PASS':'TBD';
  const governing=Math.max(L.ultimate,L.gustUltimate);
  const loadStatus=Number.isFinite(o.designLoad)&&o.designLoad>=governing-1e-8?'PASS':'TBD';
  // The empirical summary deliberately leaves deflection and detailed structural criteria to the spar study.
  const sizingCandidates=o.candidates.filter(c=>c.packagingStatus==='PASS'&&c.strengthPass&&c.manufacturingStatus==='PASS');
  const sized=sizingCandidates.reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const sparStatus=sized?'PASS':o.verifiedThickness&&o.buildInputsReady?'FAIL':'TBD';
  const provisional=o.provisional;
  const cards=[
    {title:'구조중량',status:weightStatus,value:`Wing ${fmt(wing)} kg / Fuselage ${fmt(fuselage)} kg`,
      criterion:`전체 중량 예산 ≤ ${fmt(s.feasibility.mtowLimit,1)} kg; 주익·동체 배분 ≥ 경험식 추정치`,
      margin:complete?`${fmt(s.feasibility.mtowLimit-budgetTotal,2)} kg`:'전체 중량 예산 미완성',
      cause:weightFail?'경험식 추정치와 입력된 구성품 예산이 MTOW 또는 구조중량 배분을 초과합니다.':complete?'전체 구성품 중량 예산과 Raymer 구조중량 추정치가 기준 안에 있습니다.':'누락된 구성품 질량 때문에 전체 MTOW를 판정할 수 없습니다.',
      action:weightFail?'중량 배분과 날개·동체 형상을 다시 검토하세요.':complete?'경험식 계수와 부품 목록을 확인하세요.':'전체 구성품 중량 예산을 입력하세요.'},
    {title:'설계하중',status:loadStatus,value:`Ultimate lift ${fmt(o.designLoad/1000,2)} kN`,
      criterion:'극한 기동하중과 양의 돌풍하중 중 지배값을 스파 sizing에 적용',
      margin:'—',cause:loadStatus==='PASS'?'지배 극한하중을 자동 sizing에 반영했습니다.':'지배 날개 하중을 산정할 수 없습니다.',
      action:loadStatus==='PASS'?'하중 조건의 입력 근거를 확인하세요.':'기동·돌풍 하중 입력을 확인하세요.'},
    {title:'스파 간이 Sizing',status:sparStatus,
      value:`Available ${fmt(o.availableRootMm,1)} mm / ${sized?'Selected '+fmt(sized.depthMm,1)+' mm':provisional?'잠정 '+fmt(provisional.depthMm,1)+' mm':'해 없음'}`,
      criterion:'가용 깊이 안에서 캡·웹 강도와 제작 최소두께 충족',
      margin:sized?`Spar ${fmt(sized.massKg,3)} kg`:sparStatus==='FAIL'?'장착 가능한 단면 없음':'실제 두께·제작 기준 미확정',
      cause:sparStatus==='PASS'?'현재 입력값에서 장착·강도·제작 조건을 만족하는 단면이 있습니다.':sparStatus==='FAIL'?'현재 내부 공간과 제작 조건에서 요구 구조 단면을 확보할 수 없습니다.':'스파 위치 두께 또는 제작 최소값이 없어 이론 후보만 확인했습니다.',
      action:sparStatus==='FAIL'?'t/c 또는 익근 시위를 늘리고 스파 구조를 다시 검토하세요.':sparStatus==='TBD'?'스파 위치 두께와 캡 폭·제작 최소두께를 확인하세요.':'상세 해석으로 처짐·좌굴·적층을 확인하세요.'}
  ];
  const verdict=cards.some(c=>c.status==='FAIL')?'경험식 기준 불가능':cards.some(c=>c.status==='TBD')?'입력 부족':'경험식 기준 가능';
  const conclusion=verdict==='경험식 기준 가능'?'현재 경험식과 스파 간이 sizing 기준으로 Baseline 형상 사용 가능':
    sparStatus==='FAIL'?'현재 날개 내부 공간에서 요구 구조 단면 확보 불가 → t/c 또는 익근 시위 수정 필요':
    weightStatus==='FAIL'?'구조중량 경험식 또는 중량 예산이 기준 초과 → 중량 배분과 형상 수정 필요':
    '구조중량 예산과 스파 위치 두께·제작 기준 확인 후 최종 판정 가능';
  const note='본 판정은 개념설계 단계의 경험식/간이 모델 기준이며 상세 구조해석 결과가 아닙니다. 처짐·좌굴·적층은 별도 확인이 필요합니다.';
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
  document.getElementById('feasibilityCards').innerHTML=['구조중량','설계하중','스파 간이 Sizing'].map(title=>
    `<div class="feasibility-brief-row status-tbd"><strong>${title}</strong><span class="status-pill status-tbd">TBD</span><span>입력값 확인 필요</span></div>`).join('');
  document.getElementById('feasibilityConclusion').textContent='입력 오류를 수정한 뒤 경험식 기준 판정을 확인하세요.';
  document.getElementById('feasibilityNote').textContent='본 판정은 개념설계 단계의 경험식/간이 모델 기준이며 상세 구조해석 결과가 아닙니다.';
};
