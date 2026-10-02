window.AST = window.AST || {};
AST.assessFeasibility = function (r) {
  const s=r.state, f=s.feasibility, a=s.aircraft, w=s.wing, loads=r.loads, spar=r.spar;
  const valid=n=>Number.isFinite(n)&&n>0;
  const fmt=(n,d=2)=>AST.fmt(n,d);
  const cards=[];
  const actions=[];
  const mass=f.estimatedMTOW;
  if(valid(mass)) {
    const margin=f.mtowLimit-mass, ratio=mass/f.mtowLimit;
    cards.push({title:'Weight · 중량',status:ratio>1?'FAIL':ratio>0.9?'MARGINAL':'PASS',lines:[`예상 MTOW ${fmt(mass)} / 상한 ${fmt(f.mtowLimit)} kg`,`여유 ${margin>=0?'+':''}${fmt(margin)} kg (${fmt(100*margin/f.mtowLimit,1)}%)`],note:'예상 MTOW는 완전한 질량 예산 입력값입니다. Finger 공허중량을 대체값으로 사용하지 않습니다.'});
    if(ratio>1)actions.push('질량 예산을 줄이거나 MTOW 상한을 재검토하세요.');
  } else {
    cards.push({title:'Weight · 중량',status:'TBD',lines:[`설계 계산질량 ${fmt(a.mass)} kg · 상한 ${fmt(f.mtowLimit)} kg`],note:'전체 질량 예산의 예상 MTOW를 입력하면 여유를 판정합니다.'});
    actions.push('구성품별 질량 예산을 합산해 예상 MTOW를 입력하세요.');
  }

  const requiredDepth=Math.max(s.material.capHeight,s.material.webHeight);
  const maxRootDepth=w.rootChord*w.tc*1000;
  const fit=requiredDepth/maxRootDepth;
  const fitStatus=fit>1?'FAIL':'TBD';
  cards.push({title:'Spar Fit · 스파 장착',status:fitStatus,lines:[`필요 최소 깊이 ${fmt(requiredDepth,1)} mm · 익근 최대 두께 ${fmt(maxRootDepth,1)} mm`,`깊이 비율 ${fmt(100*fit,1)}% ${fit<=0.8?'· 최대 두께 기준 여유':fit<=1?'· 최대 두께 기준 여유 작음':'· 최대 두께도 초과'}`],note:fit>1?'익근 최대 두께보다 캡/웹 유효 높이가 큽니다. 현 형상에는 장착할 수 없습니다.':'t/c로 구한 익근 최대 두께는 상한입니다. 실제 스파 위치와 날개폭 방향의 익형 두께를 확인해야 합니다.'});
  actions.push(fit>1?'스파 유효 높이, 시위 또는 익형 두께를 조정하세요.':'스파 위치의 실제 익형 두께와 날개폭 방향 간섭을 확인하세요.');

  const maneuver=loads.ultimate, gust=loads.gustUltimate;
  const governing=Math.max(maneuver,gust);
  const selected=spar.load;
  const loadStatus=selected+1e-9<governing?'FAIL':'PASS';
  const cap=valid(f.actualCapAreaMm2)?spar.capAreaMm2/f.actualCapAreaMm2:null;
  const web=valid(f.actualWebThicknessMm)?spar.webThicknessMm/f.actualWebThicknessMm:null;
  const maxUtil=Math.max(cap??0,web??0);
  const strengthStatus=cap===null||web===null||loadStatus==='FAIL'?'TBD':maxUtil>1?'FAIL':maxUtil>0.8?'MARGINAL':'PASS';
  cards.push({title:'Strength · 강도',status:strengthStatus,lines:[`캡 ${cap===null?`필요 ${fmt(spar.capAreaMm2,2)} mm² · 실제 단면 TBD`:`활용률 ${fmt(cap*100,1)}% · 실제 ${fmt(f.actualCapAreaMm2,2)} mm²`}`,`웹 ${web===null?`필요 ${fmt(spar.webThicknessMm,3)} mm · 실제 두께 TBD`:`활용률 ${fmt(web*100,1)}% · 실제 ${fmt(f.actualWebThicknessMm,3)} mm`}`],note:'현재 선택한 스파 설계 하중과 입력한 허용응력을 기준으로 한 1차 단면 비교입니다.'});
  if(strengthStatus==='FAIL')actions.push('캡 면적 또는 웹 두께를 늘리고 허용응력을 다시 확인하세요.');
  else if(strengthStatus==='TBD')actions.push('선정한 스파의 실제 캡 면적과 웹 두께를 입력하세요.');

  const def=valid(f.tipDeflectionMm)?f.tipDeflectionMm:null;
  const defLimit=valid(f.tipDeflectionLimitMm)?f.tipDeflectionLimitMm:null;
  const defRatio=def!==null&&defLimit!==null?def/defLimit:null;
  cards.push({title:'Stiffness · 처짐',status:defRatio===null?'TBD':defRatio>1?'FAIL':defRatio>0.8?'MARGINAL':'PASS',lines:[`날개끝 처짐 ${def===null?'TBD':fmt(def,1)+' mm'} · 허용 ${defLimit===null?'TBD':fmt(defLimit,1)+' mm'}`],note:'예상 처짐은 별도 해석·시험값을 입력합니다. 허용 기준이 없으면 합격 판정하지 않습니다.'});
  if(defRatio===null)actions.push('날개끝 처짐 해석값과 허용 기준을 확정하세요.');

  cards.push({title:'Flight Load · 지배 하중',status:loadStatus,lines:[`날개 지배 조건 ${maneuver>=gust?'극한 기동':'극한 돌풍'} · ${fmt(governing,0)} N`,`극한 기동 ${fmt(maneuver,0)} N · 극한 돌풍 ${fmt(gust,0)} N`,`현재 스파 설계 ${fmt(selected,0)} N · 루트 모멘트 ${fmt(spar.rootMoment,1)} N·m`,`착륙 평균 충격력 ${fmt(loads.impact,0)} N (별도 하중 경로)`],note:'기동과 돌풍을 동일한 극한하중 기준으로 비교합니다. 착륙 하중은 날개 양력과 직접 비교하지 않습니다.'});
  if(loadStatus==='FAIL')actions.push('스파 설계 하중을 날개 지배 하중 이상으로 선택하세요.');

  const clRequired=2*loads.weight/(s.flight.rho*w.area*f.stallSpeedLimit**2);
  const clActual=valid(f.airfoilClMax)?f.airfoilClMax:null;
  const stallActual=clActual===null?null:Math.sqrt(2*loads.weight/(s.flight.rho*w.area*clActual));
  cards.push({title:'Aero · 실속 성능',status:clActual===null?'TBD':stallActual>f.stallSpeedLimit?'FAIL':stallActual>0.9*f.stallSpeedLimit?'MARGINAL':'PASS',lines:[`날개하중 ${fmt(loads.wingLoading,1)} N/m² · 요구 CLmax ${fmt(clRequired,2)}`,`익형/고양력장치 CLmax ${clActual===null?'TBD':fmt(clActual,2)} · 실속속도 ${stallActual===null?'TBD':fmt(stallActual,1)+' m/s'}`,`요구 실속속도 ≤ ${fmt(f.stallSpeedLimit,1)} m/s`],note:'CLmax는 항공기 전체의 구성과 장치 조건에 맞는 검증값을 입력해야 합니다.'});
  if(clActual===null)actions.push('선정 익형과 고양력장치의 항공기 CLmax를 확인하세요.');
  else if(stallActual>f.stallSpeedLimit)actions.push('날개면적 또는 최대 양력 성능을 늘리세요.');

  const failures=cards.filter(c=>c.status==='FAIL');
  const pending=cards.filter(c=>c.status==='TBD');
  const marginal=cards.filter(c=>c.status==='MARGINAL');
  const verdict=failures.length?'재설계 필요':pending.length||marginal.length?'조건부 가능 · 추가 검증':'1차 조건 충족';
  const lead=failures.length?`우선 수정: ${failures.map(c=>c.title.split(' · ')[0]).join(', ')}`:pending.length?`검증 대기 ${pending.length}개 항목`:'입력한 1차 판정 기준을 모두 만족합니다.';
  return {cards,verdict,lead,actions,clRequired,requiredDepth,maxRootDepth};
};

AST.renderFeasibility = function(r) {
  const a=AST.assessFeasibility(r), esc=AST.escape;
  const statusClass=s=>'status-'+s.toLowerCase();
  document.getElementById('feasibilityVerdict').innerHTML=`<span class="feasibility-verdict ${a.cards.some(c=>c.status==='FAIL')?'status-fail':'status-tbd'}">${esc(a.verdict)}</span><p>${esc(a.lead)}</p>`;
  document.getElementById('feasibilityCards').innerHTML=a.cards.map(c=>`<article class="feasibility-card ${statusClass(c.status)}"><div class="feasibility-card-head"><h3>${esc(c.title)}</h3><span class="status-pill ${statusClass(c.status)}">${c.status}</span></div>${c.lines.map(line=>`<p>${esc(line)}</p>`).join('')}<small>${esc(c.note)}</small></article>`).join('');
  document.getElementById('feasibilityActions').innerHTML=a.actions.map(x=>`<li>${esc(x)}</li>`).join('');
  const paths=AST.fields.flatMap(g=>g.items).filter(([path,,unit])=>unit!=='bool'&&!AST.isDerived(path)).map(x=>x[0]).concat(['design.customLoad',...Object.keys(AST.state.feasibility).map(k=>'feasibility.'+k)]);
  const active=paths.filter(path=>path!=='design.customLoad'||AST.state.design.source==='custom').filter(path=>AST.get(AST.state,path)!==null);
  const counts={INHA:0,REQ:0,ASSUMED:0,TBD:0};
  active.forEach(path=>{const source=AST.sourceFor(path);if(source in counts)counts[source]++;});
  counts.TBD+=paths.filter(path=>AST.get(AST.state,path)===null).length;
  const confidence=counts.TBD>0?'낮음':counts.ASSUMED>counts.INHA+counts.REQ?'보통':'높음';
  document.getElementById('inputConfidence').innerHTML=`<strong>Input Confidence · ${confidence}</strong><span>INHA ${counts.INHA} · REQ ${counts.REQ} · ASSUMED ${counts.ASSUMED} · TBD ${counts.TBD}</span><small>태그는 입력값의 출처를 표시합니다. ASSUMED 값은 검증 전 가정입니다.</small>`;
  const assumptions=[['wing.taper','테이퍼비',''],['wing.tc','익형 t/c',''],['wing.sweep','후퇴각','°'],['fuselage.length','동체 길이','m'],['fuselage.width','동체 폭','m'],['fuselage.height','동체 높이','m']];
  document.getElementById('criticalAssumptions').innerHTML=assumptions.map(([path,label,unit])=>`<li>${esc(label)} ${AST.fmt(AST.get(r.state,path),path==='wing.tc'?3:2)}${esc(unit)} <span class="source-badge">${esc(AST.sourceFor(path))}</span></li>`).join('');
};
