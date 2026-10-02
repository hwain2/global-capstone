window.AST = window.AST || {};
AST.fields = [
  {group:'기체',items:[['aircraft.mass','최대이륙질량 MTOW','kg'],['aircraft.nLimit','제한 하중계수','—'],['aircraft.fs','안전계수','—'],['aircraft.g','중력가속도','m/s²']]},
  {group:'주익',items:[['wing.area','날개 면적 S','m²'],['wing.autoAR','주익 형상 입력 기준','bool'],['wing.span','날개폭 b','m'],['wing.ar','가로세로비 AR','—'],['wing.taper','테이퍼비','—'],['wing.autoChords','시위 입력 기준','bool'],['wing.rootChord','익근 시위','m'],['wing.tipChord','익단 시위','m'],['wing.mac','평균공력시위 MAC','m'],['wing.equivChord','등가 직사각형 시위 S/b','m'],['wing.sweep','앞전 후퇴각','deg'],['wing.quarterSweep','1/4 시위 후퇴각','deg'],['wing.tc','최대 두께비 t/c','—']]},
  {group:'동체',items:[['fuselage.length','동체 길이','m'],['fuselage.width','최대 폭','m'],['fuselage.height','최대 높이','m'],['fuselage.wettedArea','기준·젖은 면적','m²'],['fuselage.ld','길이/직경비 l/d','—'],['fuselage.lt','Raymer Lt','m']]},
  {group:'비행 조건',items:[['flight.speed','순항속도 V','m/s'],['flight.rho','공기밀도 ρ','kg/m³'],['flight.q','동압 q = ½ρV²','Pa'],['flight.cruiseCL','순항 CL','—'],['flight.ld','순항 L/D','—'],['flight.gustSpeed','돌풍속도 Ude','m/s'],['flight.liftSlope','양력곡선기울기 a','1/rad'],['flight.muG','돌풍 질량비 μg','—']]},
  {group:'착륙 조건',items:[['landing.drop','낙하 높이 h','m'],['landing.stop','정지 거리 s','m']]},
  {group:'재료·구조',items:[['material.density','재료 밀도','kg/m³'],['material.capStress','캡 허용응력','MPa'],['material.webStress','웹 허용전단응력','MPa'],['material.elasticModulusGPa','스파 탄성계수 E','GPa']]},
  {group:'스파 자동 탐색 · STRUCT',items:[['sparDesign.depthFactor','깊이 활용률 (0~1)','—'],['sparDesign.localThicknessMm','스파 위치 익형두께','mm'],['sparDesign.capWidthMm','캡 폭','mm'],['sparDesign.manufacturingMinCapMm','제작 최소 캡 두께','mm'],['sparDesign.manufacturingMinWebMm','제작 최소 웹 두께','mm']]},
  {group:'기존 스파 단면 비교 · STRUCT',advanced:true,items:[['sparDesign.requestedDepthMm','기존 선정 스파 깊이','mm'],['sparDesign.selectedCapAreaMm2','기존 선정 캡 면적','mm²'],['sparDesign.selectedWebThicknessMm','기존 선정 웹 두께','mm']]},
  {group:'고급 계수',advanced:true,items:[['material.krw','Kρ,w','참고값'],['material.krf','Kρ,f','참고값'],['material.kinlet','K inlet','참고값'],['material.pmax','P max','참고값']]}
];
AST.inputSteps = Object.freeze({
  'aircraft.mass':0.1, 'aircraft.nLimit':0.05, 'aircraft.fs':0.01, 'aircraft.g':0.01,
  'wing.area':0.01, 'wing.span':0.02, 'wing.ar':0.05,
  'wing.rootChord':0.005, 'wing.tipChord':0.005, 'wing.mac':0.005, 'wing.equivChord':0.005,
  'wing.taper':0.01, 'wing.sweep':0.5, 'wing.quarterSweep':0.5, 'wing.tc':0.001,
  'fuselage.length':0.01, 'fuselage.width':0.002, 'fuselage.height':0.002,
  'fuselage.wettedArea':0.01, 'fuselage.ld':0.05, 'fuselage.lt':0.005,
  'flight.speed':0.1, 'flight.rho':0.005, 'flight.q':1, 'flight.cruiseCL':0.01, 'flight.ld':0.1,
  'flight.gustSpeed':0.05, 'flight.liftSlope':0.05, 'flight.muG':0.1,
  'landing.drop':0.005, 'landing.stop':0.001,
  'material.density':5, 'material.krw':0.01, 'material.krf':0.01,
  'material.kinlet':0.01, 'material.pmax':0.01,
  'material.capStress':2, 'material.webStress':1, 'material.elasticModulusGPa':1,
  'sparDesign.depthFactor':0.01, 'sparDesign.localThicknessMm':0.5,
  'sparDesign.requestedDepthMm':0.5, 'sparDesign.selectedCapAreaMm2':0.1,
  'sparDesign.selectedWebThicknessMm':0.01, 'sparDesign.manufacturingMinWebMm':0.01,
  'sparDesign.capWidthMm':0.5, 'sparDesign.manufacturingMinCapMm':0.01,
  'design.customLoad':5,
  'feasibility.mtowLimit':0.1, 'feasibility.designTarget':0.1,
  'feasibility.tipDeflectionMm':0.5, 'feasibility.tipDeflectionLimitMm':0.5,
  'feasibility.stallSpeedLimit':0.1, 'feasibility.airfoilClMax':0.01,
  'weightBudget.wingStructure':0.1,'weightBudget.fuselageStructure':0.1,'weightBudget.tailStructure':0.1,
  'weightBudget.landingGear':0.1,'weightBudget.propulsion':0.1,'weightBudget.battery':0.1,
  'weightBudget.avionics':0.1,'weightBudget.wiring':0.1,'weightBudget.payload':0.1,'weightBudget.other':0.1
});
AST.feasibilityFields = [
  ['feasibility.mtowLimit','MTOW 상한','kg'],['feasibility.designTarget','설계중량 목표','kg'],
  ['feasibility.tipDeflectionLimitMm','허용 날개끝 처짐','mm'],
  ['feasibility.stallSpeedLimit','실속속도 상한','m/s'],['feasibility.airfoilClMax','항공기 CLmax','—']
];
AST.budgetFields=Object.entries(AST.budgetLabels).map(([key,label])=>['weightBudget.'+key,label,'kg']);
AST.fieldLabel = function(path){if(path==='design.customLoad')return '사용자 지정 총양력';for(const [p,label] of AST.feasibilityFields.concat(AST.budgetFields))if(p===path)return label;for(const g of AST.fields)for(const [p,label] of g.items)if(p===path)return label;return path;};
AST.isDerived = path => path==='wing.span'?!AST.state.wing.autoAR:path==='wing.ar'?AST.state.wing.autoAR:path==='wing.taper'?!AST.state.wing.autoChords:['wing.rootChord','wing.tipChord'].includes(path)?AST.state.wing.autoChords:['wing.mac','wing.equivChord','wing.quarterSweep','flight.q','fuselage.ld'].includes(path);
AST.sourceFor = path => AST.isDerived(path)?'CALC':AST.get(AST.state,path)===null?'TBD':AST.state.sources[path]||(path==='feasibility.stallSpeedLimit'?'REQ':path.startsWith('sparDesign.')||path.startsWith('weightBudget.')||path==='design.customLoad'?'STRUCT':'ASSUMED');
AST.sourceOptions = path => `<select class="source-select" data-source-path="${path}" aria-label="${AST.escape(AST.fieldLabel(path))} 입력 출처" ${AST.get(AST.state,path)===null?'disabled':''}>${['INHA','REQ','STRUCT','ASSUMED','TBD'].map(v=>`<option value="${v}" ${AST.sourceFor(path)===v?'selected':''}>${v}</option>`).join('')}</select>`;
AST.allSourcePaths=()=>AST.fields.flatMap(g=>g.items).filter(([, ,unit])=>unit!=='bool').map(x=>x[0]).concat(AST.state.design.source==='custom'?['design.customLoad']:[],AST.feasibilityFields.map(x=>x[0]),AST.budgetFields.map(x=>x[0]));
AST.resultDefs = [
  {section:'기체',label:'최대이륙질량',unit:'kg',read:r=>r.state.aircraft.mass,equation:'사용자 입력값: 최대이륙질량 [kg].',status:'입력값'},
  {section:'기체',label:'날개폭',unit:'m',read:r=>r.state.wing.span,equation:'사용자 입력값 또는 AR에서 계산: 날개폭 b [m].',status:'입력·계산값'},
  {section:'기체',label:'날개 면적',unit:'m²',read:r=>r.state.wing.area,equation:'사용자 입력값: 날개 면적 S [m²].',status:'입력값'},
  {section:'기체',label:'가로세로비',unit:'—',read:r=>r.state.wing.ar,equation:'날개폭 입력 시 AR = b² / S, AR 입력 시 b = √(AR × S).',status:'입력·계산값'},
  {section:'기체',label:'등가 직사각형 시위',unit:'m',read:r=>r.state.wing.equivChord,equation:'c equivalent = S / b.',status:'CALC'},
  {section:'기체',label:'익근 최대두께 상한',unit:'mm',read:r=>r.spar.rootMaxThicknessMm,equation:'h max,root = cr × (t/c) × 1000. 실제 스파 위치 두께가 아님.',status:'상한값 · 익형 검증 필요'},
  {section:'중량',label:'Finger 공허중량',unit:'kg',read:r=>r.weight.finger,equation:'We = 0.699 × MTOW^0.949. MTOW와 We는 kg.',status:'전체 공허중량'},
  {section:'중량',label:'Raymer 주익',unit:'kg',read:r=>r.weight.raymerWing,equation:'Ww = 0.036 Sw^0.758 Wfw^0.0035 (AR/cos²Λ)^0.6 q^0.006 λ^0.04 [100(t/c)/cosΛ]^−0.3 (Nult Wdg)^0.49. Sw는 ft², q는 psf, Wdg는 lb; 결과 lb를 kg으로 변환. 날개 내 연료 없음: Wfw = 1.',status:'경험식'},
  {section:'중량',label:'Sadraey 주익 식 값',unit:'참고값',read:r=>r.weight.sadraeyWing,equation:'Wwing = S c̄ (t/c)max ρmat Kρ,w [AR nult / cosΛc/4]^0.6 λ^0.04 g. 원문 식에 SI 입력값을 그대로 대입.',status:'계수·단위 검증 필요'},
  {section:'중량',label:'Raymer 동체',unit:'kg',read:r=>r.weight.raymerFuse,equation:'Wf = 0.052 Sf^1.086 (Nult Wdg)^0.177 Lt^−0.051 (l/d)^−0.072 q^0.241. Sf는 ft², Wdg는 lb, Lt는 ft, q는 psf; 결과 lb를 kg으로 변환.',status:'Lt 정의 검증 필요'},
  {section:'중량',label:'Sadraey 동체 식 값',unit:'참고값',read:r=>r.weight.sadraeyFuse,equation:'Wfuse = ρmat Kρ,f Pmax [((wmax + hmax)/2) lfuse]^1.2 nult^0.3 Kinlet g. 원문 식에 SI 입력값을 그대로 대입.',status:'계수·단위 검증 필요'},
  {section:'하중',label:'기체 중량 W',unit:'N',read:r=>r.loads.weight,equation:'W = m × g.'},
  {section:'하중',label:'극한 하중계수',unit:'g',read:r=>r.loads.nUlt,equation:'Nult = Nlimit × FS.'},
  {section:'하중',label:'극한 양력',unit:'N',read:r=>r.loads.ultimate,equation:'Lult = Nlimit × FS × W.'},
  {section:'하중',label:'돌풍 완화계수 Kg',unit:'—',read:r=>r.loads.kg,equation:'Kg = 0.88 μg / (5.3 + μg).'},
  {section:'하중',label:'날개 하중 W/S',unit:'N/m²',read:r=>r.loads.wingLoading,equation:'W/S = m g / S.'},
  {section:'하중',label:'동압 q',unit:'Pa',read:r=>r.state.flight.q,equation:'q = ½ρV².'},
  {section:'하중',label:'돌풍 하중계수 증가량 Δn',unit:'g',read:r=>r.loads.deltaN,equation:'Δn = Kg ρ Ude V a / [2(W/S)].'},
  {section:'하중',label:'양의 돌풍 하중계수',unit:'g',read:r=>r.loads.gustPlus,equation:'n gust+ = 1 + Δn.'},
  {section:'하중',label:'음의 돌풍 하중계수',unit:'g',read:r=>r.loads.gustMinus,equation:'n gust− = 1 − Δn.'},
  {section:'하중',label:'양의 돌풍 제한하중',unit:'N',read:r=>r.loads.gustPlusLoad,equation:'L gust,limit = n gust+ × W.'},
  {section:'하중',label:'양의 돌풍 극한하중',unit:'N',read:r=>r.loads.gustUltimate,equation:'L gust,ultimate = FS × n gust+ × W.'},
  {section:'하중',label:'음의 돌풍 등가하중',unit:'N',read:r=>r.loads.gustMinusLoad,equation:'L gust− = n gust− × W. 부호를 유지한 값.'},
  {section:'하중',label:'평균 착륙 충격력',unit:'N',read:r=>r.loads.impact,equation:'Favg = m g (1 + h/s).'},
  {section:'스파',label:'선택한 하중',unit:'N',read:r=>r.spar.load,equation:'극한 기동·극한 돌풍·착륙 평균 충격력 또는 사용자 지정 하중 중 선택. 착륙은 날개 하중 경로와 다름.'},
  {section:'스파',label:'사용 가능 스파 깊이',unit:'mm',read:r=>r.spar.availableDepthMm,equation:'스파 위치 두께 × 깊이 활용률. 익형 두께 미입력 시 cr(t/c)를 상한으로 사용.',status:'익형 위치 두께 확인 필요'},
  {section:'스파',label:'선정 단면 최소 필요 깊이',unit:'mm',read:r=>r.spar.requiredDepthMm,equation:'max(|Mroot|×1000/(σallow×선정 캡 면적), |Vroot|/(τallow×선정 웹 두께)). 선정 단면의 강도상 최소 깊이이며 형상·좌굴 검증은 별도.',status:'STRUCT 단면 입력 필요'},
  {section:'스파',label:'루트 전단력',unit:'N',read:r=>r.spar.rootShear,equation:'각 반날개에서 Vroot = L / 2.'},
  {section:'스파',label:'루트 굽힘모멘트',unit:'N·m',read:r=>r.spar.rootMoment,equation:'타원 양력분포에서 Mroot = L b / (3π).'},
  {section:'스파',label:'필요 캡 면적',unit:'mm²',read:r=>r.spar.capAreaMm2,equation:'Acap ≥ |Mroot| / (σallow × 사용 가능 스파 깊이). 기존 스파 식을 사용.'},
  {section:'스파',label:'웹 이론 최소두께',unit:'mm',read:r=>r.spar.webThicknessMm,equation:'tweb ≥ |Vroot| / (τallow × 사용 가능 스파 깊이). 제작 가능한 최소 적층두께가 아님.',status:'제작 최소두께 별도 필요'},
  {section:'스파',label:'제작 기준 채택 웹 두께',unit:'mm',read:r=>r.spar.adoptedWebThicknessMm,equation:'max(웹 이론 최소두께, 구조팀 제작 최소두께).',status:'STRUCT 입력 필요'}
];
AST.resultAssumptions={
  'Finger 공허중량':['aircraft.mass'],
  'Raymer 주익':['wing.taper','wing.sweep','wing.tc','aircraft.nLimit'],
  'Sadraey 주익 식 값':['wing.taper','wing.sweep','wing.tc','material.density','material.krw'],
  'Raymer 동체':['fuselage.wettedArea','fuselage.lt','fuselage.length','fuselage.width','fuselage.height'],
  'Sadraey 동체 식 값':['fuselage.length','fuselage.width','fuselage.height','material.density','material.krf','material.pmax','material.kinlet']
};
AST.resultMeta=function(d){
  const paths=AST.resultAssumptions[d.label]||[];
  const assumed=paths.filter(path=>['ASSUMED','TBD'].includes(AST.sourceFor(path)));
  const direct={'최대이륙질량':'aircraft.mass','날개폭':'wing.span','날개 면적':'wing.area','가로세로비':'wing.ar'};
  const source=d.section==='기체'&&direct[d.label]?AST.sourceFor(direct[d.label]):'CALC';
  const note=assumed.length?'가정 입력: '+assumed.map(AST.fieldLabel).join(', '):d.status||'';
  return {source,status:assumed.length?'PROVISIONAL':d.status||'계산값',note};
};
AST.fmt = (v,places=2) => Number.isFinite(v) ? new Intl.NumberFormat('ko-KR',{maximumFractionDigits:places,minimumFractionDigits:places}).format(v) : '—';
AST.escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
AST.state=AST.clone(AST.defaults);
AST.lastResult=null;
AST.fieldHTML = function([path,label,unit],advanced) {
  const val=AST.get(AST.state,path), boolean=unit==='bool';
  const locked=AST.state.presetLocked && AST.inhaTwoProp.lockedPaths.includes(path);
  const tip=advanced || path==='fuselage.lt' ? ' title="계수 정의 확인 필요"' : '';
  if(path==='wing.autoAR')return `<label class="field"><span>${AST.escape(label)}</span><select data-path="wing.autoAR" ${locked?'disabled':''}><option value="span" ${val?'selected':''}>날개폭 입력 · AR 자동 계산</option><option value="ar" ${val?'':'selected'}>AR 입력 · 날개폭 자동 계산</option></select><span class="source-badge">STRUCT</span></label>`;
  if(path==='wing.autoChords')return `<label class="field"><span>${AST.escape(label)}</span><select data-path="wing.autoChords"><option value="auto" ${val?'selected':''}>S·b·테이퍼비로 시위 계산</option><option value="chords" ${val?'':'selected'}>익근·익단 시위 직접 입력</option></select><span class="source-badge">STRUCT</span></label>`;
  if(boolean)return `<label class="check-field"><input type="checkbox" data-path="${path}" ${val?'checked':''} ${locked?'disabled':''}><span>${AST.escape(label)}</span></label>`;
  const step=AST.inputSteps[path] ?? 'any';
  const optional=AST.get(AST.defaults,path)===null, derived=AST.isDerived(path);
  return `<div class="field"><label for="input-${path}">${AST.escape(label)}${advanced || path==='fuselage.lt' ? '<span class="verify-icon"'+tip+'>?</span>':''}</label><span class="input-unit"><input id="input-${path}" type="number" inputmode="decimal" data-path="${path}" step="${step}" value="${val===null?'':AST.escape(val)}" placeholder="${optional?'미입력 · TBD':''}" title="증감 단위: ${step} ${AST.escape(unit)}" ${locked||derived?'readonly':''}><em>${AST.escape(unit)}</em></span><div class="field-source"><span>출처</span>${derived?'<span class="source-badge">CALC</span>':AST.sourceOptions(path)}</div></div>`;
};
AST.buildInputs = function() {
  document.getElementById('inputGroups').innerHTML=AST.fields.map(g=>`<details class="input-group" ${['기체','주익','스파 자동 탐색 · STRUCT'].includes(g.group)?'open':''}><summary>${AST.escape(g.group)} <span>${g.items.length}</span></summary><div class="fields">${g.items.map(x=>AST.fieldHTML(x,g.advanced)).join('')}</div>${g.group==='주익'?'<p id="wingConsistency" class="micro wing-consistency" role="status"></p>':''}</details>`).join('')+
  `<details class="input-group" open><summary>스파 설계 하중 <span>2</span></summary><div class="fields"><label class="field"><span>하중 조건</span><select data-path="design.source"><option value="ultimate">극한 기동하중</option><option value="gust">극한 양의 돌풍</option><option value="landing">착륙 충격력 · 별도 경로</option><option value="custom">사용자 지정 날개 하중</option></select><span class="source-badge">STRUCT</span></label><div id="customLoadWrap" ${AST.state.design.source==='custom'?'':'hidden'}>${AST.fieldHTML(['design.customLoad','사용자 지정 총양력','N'],false)}</div></div></details>`;
  const container=document.getElementById('inputGroups');
  container.oninput=AST.onInput;
  container.onchange=AST.onInput;
  const feasibility=document.getElementById('feasibilityInputs');
  feasibility.innerHTML=AST.feasibilityFields.map(x=>AST.fieldHTML(x,false)).join('');
  feasibility.oninput=AST.onInput;
  feasibility.onchange=AST.onInput;
  const budget=document.getElementById('weightBudgetInputs');
  budget.innerHTML=AST.budgetFields.map(x=>AST.fieldHTML(x,false)).join('');
  budget.oninput=AST.onInput;budget.onchange=AST.onInput;
};
AST.applyInhaPreset = function() {
  const next=AST.clone(AST.defaults);
  next.aircraft.mass=24.9;
  next.aircraft.g=9.81;
  next.wing.area=0.74;
  next.wing.autoAR=false;
  next.wing.ar=12;
  next.wing.autoChords=true;
  next.flight.speed=30.71;
  next.flight.rho=1;
  next.flight.cruiseCL=0.70;
  next.flight.ld=10;
  next.feasibility.designTarget=22.4;
  next.feasibility.mtowLimit=24.9;
  for(const path of ['aircraft.mass','aircraft.g','wing.area','wing.ar','flight.speed','flight.rho','flight.cruiseCL','flight.ld','feasibility.mtowLimit','feasibility.designTarget'])next.sources[path]='INHA';
  next.sources['feasibility.stallSpeedLimit']='REQ';
  next.sensitivity.variable='wing.ar';
  next.presetLocked=true;
  AST.state=AST.synchronize(next);
  AST.buildInputs();
  AST.render();
  document.getElementById('presetStatus').textContent='인하대 기준값 적용 · 잠금 중';
};
AST.onInput = function(e) {
  const el=e.target;
  if(el.dataset.sourcePath){AST.state.sources[el.dataset.sourcePath]=el.value;AST.render();return;}
  const path=el.dataset.path;if(!path)return;
  if(AST.state.presetLocked && AST.inhaTwoProp.lockedPaths.includes(path))return;
  if(path==='wing.autoAR') {
    const current=AST.resolve(AST.state).wing;
    AST.state.wing.span=current.span;
    AST.state.wing.ar=current.ar;
  }
  if(path==='wing.autoChords' && el.value==='chords') {
    const current=AST.resolve(AST.state).wing;
    for(const key of ['rootChord','tipChord','mac'])AST.state.wing[key]=current[key];
  }
  const value=path==='wing.autoAR'?el.value==='span':path==='wing.autoChords'?el.value==='auto':el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:el.value.trim()===''?(AST.get(AST.defaults,path)===null?null:NaN):Number(el.value);
  AST.set(AST.state,path,value);
  if(el.type==='number'&&!AST.isDerived(path)){
    AST.state.sources[path]=value===null?'TBD':path.startsWith('sparDesign.')||path.startsWith('weightBudget.')||path==='design.customLoad'?'STRUCT':'ASSUMED';
    const sourceEl=document.querySelector(`[data-source-path="${path}"]`);if(sourceEl){sourceEl.value=AST.state.sources[path];sourceEl.disabled=value===null;}
  }
  AST.synchronize(AST.state);
  if(['wing.autoAR','wing.autoChords','design.source'].includes(path))AST.buildInputs();
  const presetStatus=document.getElementById('presetStatus');
  if(presetStatus.textContent && !AST.state.presetLocked) presetStatus.textContent='기준값 적용 후 수정됨';
  AST.render();
};
AST.resultHTML = function(d,r) {
  const meta=AST.resultMeta(d),value=d.read(r);
  const note=value===null?'TBD · 입력 필요':meta.status==='계산값'?'':AST.escape(meta.status)+(meta.note&&meta.note!==meta.status?' · '+AST.escape(meta.note):'');
  return `<div class="result-row"><div class="result-line"><span>${AST.escape(d.label)} <span class="source-badge">${meta.source}</span></span><strong>${AST.fmt(value,d.unit==='mm'?3:2)} <small>${AST.escape(d.unit)}</small></strong></div>${note?`<div class="result-status">${note}</div>`:''}<details class="equation"><summary>계산식 보기</summary><code>${AST.escape(d.equation)}</code></details></div>`;
};
AST.primaryResults={
  '중량':['Finger 공허중량','Raymer 주익','Raymer 동체'],
  '하중':['날개 하중 W/S','극한 양력','양의 돌풍 극한하중','평균 착륙 충격력'],
  '스파':['사용 가능 스파 깊이','루트 전단력','루트 굽힘모멘트']
};
AST.renderResults = function(r) {
  ['중량','하중','스파'].forEach(section=>{
    const id=section==='중량'?'weightResults':section==='하중'?'loadResults':'sparResults';
    const defs=AST.resultDefs.filter(d=>d.section===section),primary=AST.primaryResults[section];
    const main=defs.filter(d=>primary.includes(d.label)).map(d=>AST.resultHTML(d,r)).join('');
    const more=defs.filter(d=>!primary.includes(d.label)).map(d=>AST.resultHTML(d,r)).join('');
    const target=document.getElementById(id),expanded=target.querySelector('.result-more')?.open;
    target.innerHTML=main+`<details class="result-more" ${expanded?'open':''}><summary>${section==='중량'?'참고 경험식':section==='하중'?'하중 중간 계산값':'기존 단면 비교'} 보기</summary>${more}</details>`;
  });
  document.getElementById('overviewCards').innerHTML=[
    ['설계 계산질량',r.state.aircraft.mass,'kg'],['날개면적 S',r.state.wing.area,'m²'],['날개폭 b',r.state.wing.span,'m'],['가로세로비 AR',r.state.wing.ar,'']
  ].map(([label,v,unit])=>`<div class="overview-card"><span>${label}</span><strong>${AST.fmt(v)} <small>${unit}</small></strong></div>`).join('');
  const rows=AST.resultDefs.map(d=>{const m=AST.resultMeta(d),v=d.read(r);return `<tr><td>${AST.escape(d.section)}</td><td>${AST.escape(d.label)}</td><td>${AST.fmt(v,4)}</td><td>${AST.escape(d.unit)}</td><td><span class="source-badge">${m.source}</span></td><td>${v===null?'TBD':AST.escape(m.status)}</td><td>${AST.escape(m.note)}</td><td><details class="equation"><summary>계산식 보기</summary><code>${AST.escape(d.equation)}</code></details></td></tr>`;}).join('');
  document.getElementById('summaryTable').innerHTML=`<table><thead><tr><th>구분</th><th>결과</th><th>값</th><th>단위</th><th>Source</th><th>Status</th><th>Assumption / Note</th><th>계산식</th></tr></thead><tbody>${rows}</tbody></table>`;
};
AST.renderToggles = function(){
  const labels={aircraft:'기체',lift:'양력분포',weight:'기체 중량',shear:'루트 전단력',moment:'루트 굽힘모멘트',gust:'돌풍',impact:'착륙 충격',spar:'스파',cg:'무게중심',dimensions:'치수'};
  document.getElementById('displayToggles').innerHTML=Object.entries(labels).map(([key,label])=>`<label class="toggle"><input type="checkbox" data-display="${key}" ${AST.state.display[key]?'checked':''}><span>${label}</span></label>`).join('');
};
AST.renderSensitivityUI = function(){
  const eqEl=document.getElementById('sensitivityEquation');
  eqEl.innerHTML=Object.entries(AST.sensitivityDefs).map(([key,d])=>`<option value="${key}">${AST.escape(d.label)}</option>`).join('');
  if(!AST.sensitivityDefs[AST.state.sensitivity.equation])AST.state.sensitivity.equation='raymerWing';
  eqEl.value=AST.state.sensitivity.equation;
  const sen=AST.sensitivity(AST.state,AST.state.sensitivity.equation,AST.state.sensitivity.variable,AST.state.sensitivity.range);
  if(!sen){
    document.getElementById('sensitivityVariable').innerHTML='';
    document.getElementById('sensitivityTable').innerHTML='<tr><td colspan="7">이 계산식에 필요한 구조 입력이 아직 없습니다.</td></tr>';
    for(const id of ['sensitivityCurve','sensitivityBars']){const target=document.getElementById(id);if(window.Plotly&&target.data)Plotly.purge(target);target.innerHTML='<div class="plot-fallback">구조 입력이 정해지면 민감도를 계산합니다.</div>';}
    return;
  }
  AST.state.sensitivity.variable=sen.chosen;
  const vEl=document.getElementById('sensitivityVariable');
  vEl.innerHTML=sen.paths.map(path=>`<option value="${path}">${AST.escape(AST.fieldLabel(path))}</option>`).join('');vEl.value=sen.chosen;
  const range=Number(AST.state.sensitivity.range), rangeEl=document.getElementById('sensitivityRange');
  rangeEl.value=AST.customRangeMode?'custom':([10,20,30].includes(range)?String(range):'custom');
  document.getElementById('customRangeWrap').hidden=rangeEl.value!=='custom';
  document.getElementById('customRange').value=range;
  document.getElementById('sensitivityTable').innerHTML=sen.table.map(p=>`<tr><td>${AST.escape(AST.fieldLabel(p.path))}</td><td>${AST.fmt(p.baseline,3)}</td><td>${AST.fmt(p.index,3)}</td><td>${p.direction}</td><td>${AST.fmt(p.minus20,3)}</td><td>${AST.fmt(p.base,3)}</td><td>${AST.fmt(p.plus20,3)}</td></tr>`).join('');
  if(document.getElementById('sensitivityDetails').open)AST.renderSensitivity(sen);
};
AST.render = function() {
  const r=AST.calculate(AST.state), banner=document.getElementById('validation');
  banner.hidden=!r.errors.length;
  banner.innerHTML=r.errors.length?`<strong>입력값을 확인하세요</strong><ul>${r.errors.map(e=>`<li>${AST.escape(e)}</li>`).join('')}</ul>`:'';
  const resolved=r.state,checks=AST.geometryChecks(resolved),warnings=checks.filter(x=>x.warning);
  const wingNotice=document.getElementById('wingConsistency');
  wingNotice.textContent=warnings.length?'Geometry inconsistency: '+warnings.map(x=>x.name).join(' · '):'';
  const warningBox=document.getElementById('geometryWarnings');
  warningBox.hidden=!warnings.length;
  warningBox.innerHTML=warnings.length?'<strong>Geometry inconsistency · 형상 입력 확인</strong><ul>'+warnings.map(x=>`<li>${AST.escape(x.name)}</li>`).join('')+'</ul>':'';
  document.getElementById('geometryChecks').innerHTML=checks.map(x=>`<li>${AST.escape(x.name)}: ${AST.fmt(x.actual,3)} ${AST.escape(x.unit||'')} ${x.warning?'<strong>확인 필요</strong>':'<span class="source-badge">CALC</span>'}</li>`).join('');
  for(const path of ['wing.span','wing.ar','wing.rootChord','wing.tipChord','wing.taper','wing.mac','wing.equivChord','wing.quarterSweep','flight.q','fuselage.ld']) {
    const el=document.querySelector(`[data-path="${path}"]`);
    if(!el)continue;
    el.readOnly=(AST.state.presetLocked && AST.inhaTwoProp.lockedPaths.includes(path)) || AST.isDerived(path);
    if(el.readOnly && Number.isFinite(AST.get(resolved,path)))el.value=AST.get(resolved,path).toFixed(4);
  }
  const sourceEl=document.querySelector('[data-path="design.source"]');if(sourceEl)sourceEl.value=AST.state.design.source;
  document.getElementById('unlockPreset').hidden=!AST.state.presetLocked;
  const customWrap=document.getElementById('customLoadWrap');if(customWrap)customWrap.hidden=AST.state.design.source!=='custom';
  AST.renderToggles();
  for(const id of ['downloadCSV','downloadText','downloadPNG','saveJSON'])document.getElementById(id).disabled=!!r.errors.length;
  if(r.errors.length){
    AST.lastResult=null;
    document.getElementById('loadSelection').hidden=true;
    ['weightResults','loadResults','sparResults','summaryTable','overviewCards','sensitivityTable','feasibilityVerdict','feasibilityCards','feasibilityDetailCards','feasibilityActions','inputConfidence','criticalAssumptions','optimizationSummary','candidateDetail'].forEach(id=>document.getElementById(id).innerHTML='<p class="muted">입력값을 수정하면 결과를 계산합니다.</p>');
    for(const id of ['aircraftPlot','liftPlot','shearPlot','momentPlot','sensitivityCurve','sensitivityBars','optimizationMass','optimizationCap','optimizationWeb','optimizationDeflection','optimizationMargin']){
      const target=document.getElementById(id);
      if(window.Plotly && target.data)Plotly.purge(target);
      target.innerHTML='<div class="plot-fallback">입력값을 수정하면 그래프를 갱신합니다.</div>';
    }
    return;
  }
  AST.lastResult=r;AST.renderResults(r);AST.renderOptimization(r);AST.renderFeasibility(r);AST.render3D(resolved,r);AST.renderCharts(r,resolved);AST.renderSensitivityUI();
};
AST.sanitizeImported = function(input){
  if(!input || typeof input!=='object')throw Error('JSON에는 객체가 있어야 합니다.');
  const next=AST.clone(AST.defaults);
  for(const group of ['aircraft','wing','fuselage','flight','landing','material','sparDesign','design','display','sensitivity','feasibility','weightBudget']) {
    if(!input[group]||typeof input[group]!=='object')continue;
    for(const key of Object.keys(next[group])){
      if(!(key in input[group]))continue;
      const defaultValue=next[group][key],value=input[group][key];
      if(typeof defaultValue==='number' && typeof value==='number' && Number.isFinite(value))next[group][key]=value;
      else if(defaultValue===null && (value===null || typeof value==='number' && Number.isFinite(value)))next[group][key]=value;
      else if(typeof defaultValue==='boolean' && typeof value==='boolean')next[group][key]=value;
      else if(typeof defaultValue==='string' && typeof value==='string')next[group][key]=value;
    }
  }
  if(input.sources && typeof input.sources==='object')for(const [path,source] of Object.entries(input.sources)){
    if(['INHA','REQ','STRUCT','ASSUMED','TBD'].includes(source) && (AST.fields.some(g=>g.items.some(x=>x[0]===path))||AST.feasibilityFields.some(x=>x[0]===path)||AST.budgetFields.some(x=>x[0]===path)||path==='design.customLoad'))next.sources[path]=source;
  }
  if(!['ultimate','gust','landing','custom'].includes(next.design.source))next.design.source='ultimate';
  next.presetLocked=input.presetLocked===true;
  if(next.presetLocked){
    if(next.flight.cruiseCL===null)next.flight.cruiseCL=0.70;
    if(next.flight.ld===null)next.flight.ld=10;
    for(const path of ['aircraft.mass','aircraft.g','wing.area','wing.ar','flight.speed','flight.rho','flight.cruiseCL','flight.ld','feasibility.mtowLimit','feasibility.designTarget'])next.sources[path]='INHA';
    next.sources['feasibility.stallSpeedLimit']='REQ';
  }
  if(!AST.sensitivityDefs[next.sensitivity.equation])next.sensitivity.equation='raymerWing';
  if(input.wing && !('autoChords' in input.wing))next.wing.autoChords=false;
  const resolved=AST.resolve(next);
  if(AST.validate(resolved).length)throw Error('불러온 입력값에 유효하지 않은 값이 있습니다.');
  return AST.synchronize(next);
};
document.addEventListener('DOMContentLoaded',()=>{
  AST.synchronize(AST.state);
  AST.buildInputs();
  document.getElementById('loadChartsDetails').addEventListener('toggle',e=>{if(e.target.open&&AST.lastResult)AST.renderCharts(AST.lastResult,AST.lastResult.state);});
  document.getElementById('sensitivityDetails').addEventListener('toggle',e=>{if(e.target.open&&AST.lastResult)AST.renderSensitivityUI();});
  document.getElementById('tradeStudyDetails').addEventListener('toggle',e=>{if(e.target.open&&AST.lastResult)AST.renderOptimization(AST.lastResult);});
  document.getElementById('displayToggles').addEventListener('change',e=>{const key=e.target.dataset.display;if(key){AST.state.display[key]=e.target.checked;AST.render();}});
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>AST.setCamera(b.dataset.camera)));
  document.getElementById('applyInhaPreset').addEventListener('click',AST.applyInhaPreset);
  document.getElementById('unlockPreset').addEventListener('click',()=>{AST.state.presetLocked=false;AST.buildInputs();AST.render();document.getElementById('presetStatus').textContent='기준값 잠금 해제됨';});
  document.getElementById('resetInputs').addEventListener('click',()=>{AST.state=AST.synchronize(AST.clone(AST.defaults));AST.buildInputs();AST.render();document.getElementById('presetStatus').textContent='';});
  document.getElementById('sensitivityEquation').addEventListener('change',e=>{AST.state.sensitivity.equation=e.target.value;AST.state.sensitivity.variable='';AST.renderSensitivityUI();});
  document.getElementById('sensitivityVariable').addEventListener('change',e=>{AST.state.sensitivity.variable=e.target.value;AST.renderSensitivityUI();});
  document.getElementById('sensitivityRange').addEventListener('change',e=>{AST.customRangeMode=e.target.value==='custom';if(!AST.customRangeMode)AST.state.sensitivity.range=Number(e.target.value);AST.renderSensitivityUI();});
  document.getElementById('customRange').addEventListener('input',e=>{AST.state.sensitivity.range=Math.min(80,Math.max(1,Number(e.target.value)||20));AST.renderSensitivityUI();});
  document.getElementById('downloadCSV').addEventListener('click',()=>AST.lastResult&&AST.exportCSV(AST.lastResult));
  document.getElementById('saveJSON').addEventListener('click',()=>AST.exportJSON(AST.state));
  document.getElementById('downloadText').addEventListener('click',()=>AST.lastResult&&AST.exportText(AST.lastResult));
  document.getElementById('downloadPNG').addEventListener('click',()=>{if(window.Plotly&&AST.lastResult)Plotly.downloadImage('aircraftPlot',{format:'png',filename:'항공기-개략-3D',width:1200,height:800});});
  document.getElementById('loadJSON').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    const status=document.getElementById('importStatus');
    try{AST.state=AST.sanitizeImported(JSON.parse(await file.text()));AST.buildInputs();AST.render();document.getElementById('presetStatus').textContent=AST.state.presetLocked?'불러온 기준값 · 잠금 중':'';status.textContent=file.name+'에서 입력값을 불러왔습니다.';}
    catch(err){status.textContent='JSON을 불러오지 못했습니다: '+err.message;}
    e.target.value='';
  });
  AST.render();
  if(!window.Plotly){const script=document.querySelector('script[src*="plotly"]');script.addEventListener('load',()=>AST.render(),{once:true});}
});
