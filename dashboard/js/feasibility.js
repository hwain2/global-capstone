window.AST = window.AST || {};
AST.budgetLabels = {
  wingStructure:'주익 구조', fuselageStructure:'동체 구조', tailStructure:'미익 구조',
  landingGear:'착륙장치', propulsion:'추진계', battery:'배터리·전원',
  avionics:'항전', wiring:'배선·PMU', payload:'탑재물', other:'기타'
};
AST.assessFeasibility = function(r){
  const s=r.state,w=s.wing,f=s.feasibility,sp=r.spar,L=r.loads,o=r.optimization;
  const fmt=(n,p=2)=>AST.fmt(n,p), has=n=>Number.isFinite(n)&&n>0;
  const cards=[],actions=[];
  const add=card=>{cards.push(card);if(card.action)actions.push(card.action);};
  const checks=AST.geometryChecks(s),badGeometry=checks.filter(x=>x.warning);
  const planform=w.span*(w.rootChord+w.tipChord)/2;
  add({title:'Baseline Geometry · 기준 형상',status:badGeometry.length?'MARGINAL':'PASS',
    value:`S ${fmt(w.area)} m² · AR ${fmt(w.ar)} · b ${fmt(w.span)} m · cₑ ${fmt(w.equivChord,3)} m`,
    criterion:'AR=b²/S, S=b(cr+ct)/2',margin:`면적 차이 ${fmt(100*(planform/w.area-1),1)}%`,
    cause:badGeometry.length?badGeometry.map(x=>x.name).join(' · '):'입력 기준과 자동 계산된 형상은 일치합니다. 테이퍼·익형·동체 치수의 출처는 별도 확인이 필요합니다.',
    action:badGeometry.length?'날개 면적·날개폭·익근/익단 시위를 일치시키세요.':'테이퍼, 익형 및 동체 형상 출처를 확인하세요.'});

  const recommended=o.recommended,provisional=o.provisional;
  add({title:'Automatic Spar Sizing · 자동 탐색',status:recommended?o.overall==='PASS'?'PASS':'MARGINAL':o.overall==='STRUCTURAL REDESIGN REQUIRED'?'FAIL':'TBD',
    value:recommended?`추천 깊이 ${fmt(recommended.depthMm,1)} mm · 양쪽 날개 스파 ${fmt(recommended.massKg,3)} kg`:
      provisional?`잠정 후보 ${fmt(provisional.depthMm,1)} mm · ${o.buildInputsReady?'제작 최소값 반영':'이론'} 스파 질량 ${fmt(provisional.massKg,3)} kg`:'추천 조건을 만족하는 후보 없음',
    criterion:`가용 깊이 ${fmt(o.availableRootMm,1)} mm · 50–95% 범위에서 ${o.candidates.length}개 탐색`,
    margin:recommended?`최소 강도 MS ${fmt(recommended.strengthMargin,2)} · 처짐 ${recommended.predictedDeflectionMm===null?'TBD':fmt(recommended.predictedDeflectionMm,1)+' mm'}`:'제작 조건 또는 형상 검증 필요',
    cause:recommended?o.verifiedThickness?'입력한 스파 위치 두께를 기준으로 산정했습니다.':'익근 최대두께 상한을 사용했으므로 실제 x/c 두께 검증이 필요합니다.':
      o.buildInputsReady?'설정된 제작·장착·강성 조건에서 해를 찾지 못했습니다.':'캡 폭 및 캡/웹 제작 최소두께가 없어 이론 후보만 계산했습니다.',
    action:recommended?'익형 좌표와 제작 공정, 국부 좌굴 및 접합부를 검증하세요.':o.buildInputsReady?
      '익형 t/c 증가 → 익근 시위 증가 → box/multi-spar 변경 → 재료 변경 → 날개 평면형 변경 순서로 재설계하세요.':
      '캡 폭과 캡/웹 제작 최소두께를 입력해 현실적인 후보를 선별하세요.',scope:'optimization'});

  const structuralReady=sp.capAreaMm2!==null&&sp.webThicknessMm!==null;
  add({title:'기존 스파 단면 비교',status:sp.depthConflict?'MARGINAL':!structuralReady?'TBD':sp.localThicknessVerified?'PASS':'MARGINAL',
    value:structuralReady?`캡 필요 ≥ ${fmt(sp.capAreaMm2,2)} mm² · 웹 이론 최소 ≥ ${fmt(sp.webThicknessMm,3)} mm`:'스파 깊이 활용률 또는 날개 하중 경로 미정',
    criterion:`익근 최대두께 상한 ${fmt(sp.rootMaxThicknessMm,1)} mm · 사용 가능 깊이 ${sp.availableDepthMm===null?'TBD':fmt(sp.availableDepthMm,1)+' mm'}`,
    margin:sp.sizingDepthMm===null?'TBD':`사이징 깊이 ${fmt(sp.sizingDepthMm,1)} mm`,
    cause:sp.depthConflict?sp.requestedDepthConflict?'선정 스파 깊이가 사용 가능 깊이를 초과합니다. 구조 설계 가정이 유효하지 않습니다.':'선정한 캡/웹 단면이 강도상 요구하는 최소 깊이가 사용 가능 깊이를 초과합니다.':!structuralReady?'90/100 mm와 같은 임의 유효 높이는 사용하지 않습니다. 깊이 활용률을 정해야 단면을 계산합니다.':sp.localThicknessVerified?'입력한 스파 위치 두께를 기준으로 1차 단면을 계산했습니다.':'익근 최대두께를 상한으로 사용한 잠정 사이징입니다. 실제 스파 위치 두께는 미확인입니다.',
    action:sp.depthConflict?'선정 스파 깊이를 줄이거나 스파 구조를 변경하세요.':!structuralReady?'스파 깊이 활용률을 정하고, 가능하면 익형 좌표의 스파 위치 두께를 입력하세요.':'캡 면적과 웹 제작 최소 적층두께를 선정하세요.',
    scope:'structural'});

  const budget=Object.entries(s.weightBudget),known=budget.filter(([,n])=>n!==null),missing=budget.filter(([,n])=>n===null).map(([key])=>AST.budgetLabels[key]);
  const total=known.reduce((sum,[,n])=>sum+n,0);
  const targetMargin=f.designTarget-total,limitMargin=f.mtowLimit-total;
  const sparMass=(recommended||provisional)?.massKg??null;
  const partialWithSpar=total+(s.weightBudget.wingStructure===null?(sparMass??0):0);
  const sparExceedsWing=s.weightBudget.wingStructure!==null&&sparMass!==null&&sparMass>s.weightBudget.wingStructure;
  const weightFail=partialWithSpar>f.mtowLimit||sparExceedsWing;
  add({title:'Weight · 중량 예산',status:weightFail?'FAIL':missing.length?'TBD':total>f.designTarget?'MARGINAL':'PASS',
    value:`${missing.length?'Partial weight estimate':'전체 중량 합계'} ${fmt(total)} kg`,
    criterion:`설계 목표 ${fmt(f.designTarget)} kg · MTOW 상한 ${fmt(f.mtowLimit)} kg`,
    margin:`입력분 + 스파 기준 MTOW 잔여 ${fmt(f.mtowLimit-partialWithSpar,2)} kg${sparMass===null?' · 스파 질량 TBD':''}`,
    cause:sparExceedsWing?'계산된 스파 질량이 입력된 전체 주익 구조중량보다 큽니다.':missing.length?`미입력: ${missing.join(', ')}. 현재 여유는 미입력 중량을 제외한 값입니다.`:'모든 중량 항목이 입력되었습니다. 경험식 결과를 자동으로 합산하지 않아 중복 계산을 피합니다.',
    action:missing.length?'미입력 구성품의 질량을 채워 전체 중량 예산을 완성하세요.':total>f.mtowLimit?'구성품 중량을 줄이거나 MTOW 상한을 재검토하세요.':'중량 예산과 실제 부품 목록을 대조하세요.',
    baselineFail:weightFail});

  const selectedCap=s.sparDesign.selectedCapAreaMm2,selectedWeb=s.sparDesign.selectedWebThicknessMm;
  const capU=has(selectedCap)&&has(sp.capAreaMm2)?sp.capAreaMm2/selectedCap:null;
  const webU=has(selectedWeb)&&has(sp.webThicknessMm)?sp.webThicknessMm/selectedWeb:null;
  const capMS=capU===null?null:1/capU-1,webMS=webU===null?null:1/webU-1;
  const minWeb=s.sparDesign.manufacturingMinWebMm;
  const webBuildConflict=has(minWeb)&&has(selectedWeb)&&selectedWeb<minWeb;
  const strengthStatus=capU===null||webU===null?'TBD':Math.max(capU,webU)>1||webBuildConflict?'FAIL':Math.max(capU,webU)>0.8||!sp.localThicknessVerified||minWeb===null?'MARGINAL':'PASS';
  add({title:'기존 단면 Strength · 캡/웹',status:strengthStatus,
    value:`캡 U ${capU===null?'TBD':fmt(capU*100,1)+'%'} · 웹 U ${webU===null?'TBD':fmt(webU*100,1)+'%'}`,
    criterion:`허용응력 캡 ${fmt(s.material.capStress,0)} MPa · 웹 ${fmt(s.material.webStress,0)} MPa · U≤100%`,
    margin:`Margin of Safety: 캡 ${capMS===null?'TBD':fmt(capMS,2)} · 웹 ${webMS===null?'TBD':fmt(webMS,2)}`,
    cause:strengthStatus==='TBD'?'선정 캡 면적·웹 두께 또는 스파 유효 깊이가 없어 실제 응력/허용응력을 비교할 수 없습니다.':webBuildConflict?'선정 웹 두께가 구조팀 제작 최소두께보다 작습니다.':strengthStatus==='FAIL'?'선정 단면의 계산 응력/허용응력이 100%를 초과합니다.':minWeb===null?'웹 제작 최소 적층두께가 미정입니다. 강도 여유만으로 제작 가능성을 확정할 수 없습니다.':'기존 스파 식에 따른 1차 강도 비교입니다. 허용응력 출처와 국부 좌굴은 별도 검증 대상입니다.',
    action:strengthStatus==='FAIL'?'캡 면적 또는 웹 두께를 늘리고 허용응력을 검증하세요.':strengthStatus==='TBD'?'선정 캡 면적과 웹 두께를 입력하세요.':'선정 단면과 허용응력의 근거를 확인하세요.',
    scope:'structural'});

  const def=recommended?.predictedDeflectionMm??null,allow=f.tipDeflectionLimitMm;
  const defRatio=has(def)&&has(allow)?def/allow:null;
  add({title:'Stiffness · 처짐',status:defRatio===null?'TBD':defRatio>1?'FAIL':defRatio>0.8?'MARGINAL':'PASS',
    value:`날개끝 처짐 ${has(def)?fmt(def,1)+' mm':'TBD'}`,criterion:`허용 처짐 ${has(allow)?fmt(allow,1)+' mm':'TBD'}`,
    margin:defRatio===null?'TBD':`${fmt(allow-def,1)} mm`,
    cause:defRatio===null?'추천 단면의 탄성계수 E 또는 허용 처짐 기준이 정의되지 않았습니다.':'추천 단면의 EI와 반날개 모멘트 분포를 적분한 선형 보 근사입니다.',
    action:defRatio===null?'탄성계수 E와 허용 처짐 기준을 입력하세요.':defRatio>1?'스파 강성을 높이거나 허용 기준과 운용 조건을 재검토하세요.':'EI와 처짐 해석의 근거를 확인하세요.',
    scope:'structural'});

  const depths=[s.sparDesign.requestedDepthMm,sp.requiredDepthMm].filter(has);
  const chosenDepth=depths.length?Math.max(...depths):null;
  const depthRatio=chosenDepth!==null&&sp.availableDepthMm!==null?chosenDepth/sp.availableDepthMm:null;
  const packagingStatus=sp.depthConflict?'FAIL':depthRatio===null||!sp.localThicknessVerified?'TBD':depthRatio>0.8?'MARGINAL':'PASS';
  add({title:'기존 단면 Packaging · 스파 장착',status:packagingStatus,
    value:`선정/강도상 필요 깊이 ${chosenDepth===null?'TBD':fmt(chosenDepth,1)+' mm'} · 사용 가능 깊이 ${sp.availableDepthMm===null?'TBD':fmt(sp.availableDepthMm,1)+' mm'}`,
    criterion:`익근 최대두께 절대 상한 ${fmt(sp.rootMaxThicknessMm,1)} mm`,
    margin:depthRatio===null?'TBD':`깊이 사용률 ${fmt(depthRatio*100,1)}%`,
    cause:sp.depthConflict?'INVALID STRUCTURAL ASSUMPTION — 선정 깊이가 허용 공간을 초과합니다. 이는 Baseline 형상의 실패 판정이 아닙니다.':!sp.localThicknessVerified?'t/c×익근 시위는 최대두께 상한일 뿐 실제 스파 위치 두께가 아닙니다. 깊이 방향 장착 판정은 보류합니다.':'입력한 스파 위치 두께를 기준으로 깊이 방향을 비교했습니다. 폭/날개폭 방향 간섭은 별도 확인이 필요합니다.',
    action:sp.depthConflict?'스파 깊이를 줄이거나 다른 스파 형식·시위·익형을 검토하세요.':!sp.localThicknessVerified?'익형 좌표에서 스파 x/c 위치의 실제 두께를 확인하세요.':'스파 폭과 날개폭 방향 내부 간섭을 확인하세요.',
    scope:'structural'});

  const governing=Math.max(L.ultimate,L.gustUltimate);
  const loadStatus=sp.wingLoad===null?'TBD':sp.wingLoad<governing?'FAIL':'PASS';
  add({title:'Flight Load · 지배 하중',status:loadStatus,
    value:`극한 기동 ${fmt(L.ultimate,0)} N · 극한 양의 돌풍 ${fmt(L.gustUltimate,0)} N`,
    criterion:`날개 설계 하중 ≥ ${fmt(governing,0)} N`,
    margin:sp.wingLoad===null?'TBD':`${fmt(sp.wingLoad-governing,0)} N`,
    cause:sp.wingLoad===null?'착륙 충격력은 날개 양력 하중 경로와 다릅니다. 날개 스파 사이징에 직접 대입하지 않습니다.':loadStatus==='FAIL'?'선택한 날개 설계 하중이 계산된 지배 하중보다 작습니다.':'기동과 양의 돌풍을 같은 극한하중 기준으로 비교했습니다. 음의 돌풍과 착륙 하중 경로는 별도 검토가 필요합니다.',
    action:sp.wingLoad===null?'착륙장치·동체 하중 경로를 별도 해석하세요.':loadStatus==='FAIL'?'날개 스파 설계 하중을 지배 하중 이상으로 선택하세요.':'음의 돌풍과 착륙 하중 경로를 확인하세요.',
    scope:'structural'});

  const clReq=2*L.weight/(s.flight.rho*w.area*f.stallSpeedLimit**2);
  const clMax=f.airfoilClMax;
  const stall=has(clMax)?Math.sqrt(2*L.weight/(s.flight.rho*w.area*clMax)):null;
  add({title:'Aero · 실속 성능',status:stall===null?'TBD':stall>f.stallSpeedLimit?'FAIL':stall>0.9*f.stallSpeedLimit?'MARGINAL':'PASS',
    value:`W/S ${fmt(L.wingLoading,1)} N/m² · 요구 CLmax ${fmt(clReq,2)}`,
    criterion:`실속속도 ≤ ${fmt(f.stallSpeedLimit,1)} m/s`,
    margin:stall===null?'TBD':`예상 ${fmt(stall,1)} m/s · 속도 여유 ${fmt(f.stallSpeedLimit-stall,1)} m/s`,
    cause:stall===null?'항공기 구성에 맞는 검증된 CLmax가 없습니다. 순항 CL을 CLmax로 사용하지 않습니다.':'입력한 항공기 CLmax와 요구 실속속도를 비교했습니다.',
    action:stall===null?'공력팀에서 항공기 CLmax를 확인하세요.':stall>f.stallSpeedLimit?'날개면적 또는 최대 양력 성능을 늘리세요.':'공력팀의 CLmax 근거와 형상 조건을 확인하세요.',
    baselineFail:stall!==null&&stall>f.stallSpeedLimit});

  const critical=['sparDesign.localThicknessMm','sparDesign.capWidthMm','sparDesign.manufacturingMinCapMm','sparDesign.manufacturingMinWebMm','material.elasticModulusGPa','feasibility.tipDeflectionLimitMm','feasibility.airfoilClMax'];
  const incomplete=critical.filter(path=>AST.get(s,path)===null).concat(missing.map(name=>'중량: '+name));
  const assumptionCount=Object.values(s.sources).filter(x=>x==='ASSUMED').length;
  add({title:'Input Completeness · 근거',status:incomplete.length?'TBD':assumptionCount?'MARGINAL':'PASS',
    value:`미확정 핵심 항목 ${incomplete.length}개`,criterion:'Baseline / REQ / STRUCT / ASSUMED·TBD / CALC 분류',
    margin:'—',cause:incomplete.length?incomplete.join(', '):'필수 설계·검증 입력이 채워졌습니다. 출처 태그는 별도로 확인하세요.',
    action:incomplete.length?'미확정 입력의 출처와 값을 확보하세요.':'ASSUMED 입력의 출처를 확인하세요.'});

  const baselineFail=cards.some(c=>c.baselineFail);
  const hasBaseline=['aircraft.mass','wing.area','wing.ar','flight.speed','flight.rho'].every(path=>s.sources[path]==='INHA'||s.sources[path]==='REQ');
  const verdict=o.overall==='STRUCTURAL REDESIGN REQUIRED'?'STRUCTURAL REDESIGN REQUIRED':baselineFail?'FAIL':
    !recommended?'INSUFFICIENT DATA':badGeometry.length?'REVIEW REQUIRED':!hasBaseline?'INSUFFICIENT DATA':
    cards.some(c=>c.status==='TBD'||c.status==='MARGINAL')?'CONDITIONALLY FEASIBLE':'PASS';
  const lead=verdict==='STRUCTURAL REDESIGN REQUIRED'?'No feasible spar solution within current wing geometry. 익형 두께·시위·스파 구조를 다시 검토하세요.':
    baselineFail?'확인된 요구조건 위반이 있습니다.':!recommended?'제작 조건이 확정되기 전에는 이론 후보만 제시합니다.':
    'Baseline structurally feasible with redesigned spar. 익형·강성·중량 조건을 추가 확인하세요.';
  return {cards,verdict,lead,actions,checks,budget:{total,missing,targetMargin,limitMargin},clReq};
};
AST.renderFeasibility=function(r){
  const a=AST.assessFeasibility(r),esc=AST.escape;
  const statusClass=s=>'status-'+s.toLowerCase().replaceAll(' ','-');
  const primaryTitles=['Automatic Spar Sizing · 자동 탐색','Weight · 중량 예산','Stiffness · 처짐','Flight Load · 지배 하중','Aero · 실속 성능'];
  const cardHTML=(c,compact=false)=>`<article class="feasibility-card ${statusClass(c.status)}"><div class="feasibility-card-head"><h3>${esc(c.title)}</h3><span class="status-pill ${statusClass(c.status)}">${c.status}</span></div><p><strong>계산값</strong> ${esc(c.value)}</p><p><strong>기준</strong> ${esc(c.criterion)}</p><p><strong>Margin</strong> ${esc(c.margin)}</p>${compact?'':`<small>${esc(c.cause)}</small><p class="card-action"><strong>Action</strong> ${esc(c.action)}</p>`}</article>`;
  document.getElementById('feasibilityVerdict').innerHTML=`<span class="feasibility-verdict ${statusClass(a.verdict)}">${esc(a.verdict)}</span><p>${esc(a.lead)}</p>`;
  document.getElementById('feasibilityCards').innerHTML=a.cards.filter(c=>primaryTitles.includes(c.title)).map(c=>cardHTML(c,true)).join('');
  document.getElementById('feasibilityDetailCards').innerHTML=a.cards.filter(c=>!primaryTitles.includes(c.title)).map(c=>cardHTML(c,false)).join('');
  const actions=a.cards.filter(c=>primaryTitles.includes(c.title)&&c.status!=='PASS').map(c=>c.action).filter(Boolean).slice(0,4);
  document.getElementById('feasibilityActions').innerHTML=(actions.length?actions:['입력값과 상세 구조 해석 결과를 확인하세요.']).map(x=>`<li>${esc(x)}</li>`).join('');
  const paths=AST.allSourcePaths().filter(path=>!AST.isDerived(path));
  const counts={INHA:0,REQ:0,STRUCT:0,ASSUMED:0,TBD:0};
  paths.forEach(path=>{const tag=AST.sourceFor(path);if(tag in counts)counts[tag]++;});
  const confidence=counts.TBD?'낮음':counts.ASSUMED>counts.INHA+counts.REQ?'보통':'높음';
  document.getElementById('inputConfidence').innerHTML=`<strong>Input Confidence · ${confidence}</strong><span>INHA ${counts.INHA} · REQ ${counts.REQ} · STRUCT ${counts.STRUCT} · ASSUMED ${counts.ASSUMED} · TBD ${counts.TBD}</span><small>출처 태그는 값의 근거를 구분합니다. STRUCT는 구조팀 설계값이며 검증 완료를 뜻하지 않습니다.</small>`;
  const assumptions=[['wing.taper','테이퍼비',''],['wing.tc','익형 t/c',''],['wing.sweep','후퇴각','°'],['fuselage.length','동체 길이','m'],['fuselage.width','동체 폭','m'],['fuselage.height','동체 높이','m']];
  document.getElementById('criticalAssumptions').innerHTML=assumptions.map(([path,label,unit])=>`<li>${esc(label)} ${AST.fmt(AST.get(r.state,path),path==='wing.tc'?3:2)}${esc(unit)} <span class="source-badge">${esc(AST.sourceFor(path))}</span></li>`).join('');
};
