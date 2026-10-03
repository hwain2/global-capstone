window.AST = window.AST || {};
AST.validate = function (s) {
  const errors = [];
  const positive = [
    ['aircraft.mass','최대이륙질량'], ['aircraft.nLimit','제한 하중계수'], ['aircraft.fs','안전계수'], ['aircraft.g','중력가속도'],
    ['wing.area','날개 면적'], ['wing.span','날개폭'], ['wing.ar','가로세로비'], ['wing.rootChord','익근 시위'],
    ['wing.tipChord','익단 시위'], ['wing.mac','평균공력시위'], ['wing.taper','테이퍼비'], ['wing.tc','두께비'],
    ['fuselage.length','동체 길이'], ['fuselage.width','동체 폭'], ['fuselage.height','동체 높이'],
    ['fuselage.wettedArea','동체 기준 면적'], ['fuselage.ld','동체 길이/직경비'], ['fuselage.lt','Raymer Lt'],
    ['flight.speed','비행속도'], ['flight.rho','공기밀도'], ['flight.q','동압'],
    ['flight.liftSlope','양력곡선기울기'], ['flight.muG','돌풍 질량비'],
    ['landing.stop','정지 거리'], ['material.density','재료 밀도'],
    ['material.krw','주익 Kρ,w'], ['material.krf','동체 Kρ,f'], ['material.kinlet','K inlet'],
    ['material.pmax','P max'], ['material.capStress','캡 허용응력'], ['material.webStress','웹 허용전단응력'],
    ['feasibility.mtowLimit','MTOW 상한'],['feasibility.designTarget','설계중량 목표'],['feasibility.stallSpeedLimit','실속속도 상한']
  ];
  positive.forEach(([path, label]) => { const n = AST.get(s, path); if (!Number.isFinite(n) || n <= 0) errors.push(label + ': 0보다 큰 값을 입력하세요.'); });
  [['flight.gustSpeed','돌풍속도'], ['landing.drop','낙하 높이']].forEach(([path,label]) => {
    const n = AST.get(s,path); if (!Number.isFinite(n) || n < 0) errors.push(label + ': 0 이상의 값을 입력하세요.');
  });
  ['wing.sweep','wing.quarterSweep'].forEach(path => {
    const n = AST.get(s,path);
    if (!Number.isFinite(n) || Math.abs(Math.cos(n * Math.PI / 180)) < 0.05) errors.push((path==='wing.sweep'?'앞전 후퇴각':'1/4 시위 후퇴각') + '의 코사인 값이 0에 너무 가깝습니다.');
  });
  if (s.wing.autoAR && Math.abs(s.wing.ar) > 1e5) errors.push('자동 계산된 가로세로비가 허용 범위를 벗어났습니다.');
  if(s.wing.tc>=1)errors.push('날개 최대 두께비 t/c는 1보다 작아야 합니다.');
  if(s.design.source==='custom' && (!Number.isFinite(s.design.customLoad)||s.design.customLoad<=0))errors.push('사용자 지정 총양력: 0보다 큰 값을 입력하세요.');
  for(const [path,label] of [['flight.cruiseCL','순항 CL'],['flight.ld','순항 L/D'],['material.elasticModulusGPa','탄성계수 E'],['sparDesign.localThicknessMm','스파 위치 익형두께'],['sparDesign.requestedDepthMm','선정 스파 깊이'],['sparDesign.selectedCapAreaMm2','선정 캡 면적'],['sparDesign.selectedWebThicknessMm','선정 웹 두께'],['sparDesign.capWidthMm','캡 폭'],['sparDesign.manufacturingMinCapMm','제작 최소 캡 두께'],['sparDesign.manufacturingMinWebMm','제작 최소 웹 두께'],['feasibility.tipDeflectionMm','예상 처짐'],['feasibility.tipDeflectionLimitMm','허용 처짐'],['feasibility.airfoilClMax','항공기 CLmax']]){
    const n=AST.get(s,path);if(n!==null && (!Number.isFinite(n)||n<=0))errors.push(label+': 0보다 큰 값을 입력하세요.');
  }
  const factor=s.sparDesign.depthFactor;
  if(factor!==null && (!Number.isFinite(factor)||factor<=0||factor>1))errors.push('스파 깊이 활용률: 0보다 크고 1 이하여야 합니다.');
  const sparXc=s.sparDesign.sparXc;
  if(!Number.isFinite(sparXc)||sparXc<=0||sparXc>=1)errors.push('가정 스파 위치 x/c: 0과 1 사이로 입력하세요.');
  const capWidthRatio=s.sparDesign.capWidthRatio;
  if(!Number.isFinite(capWidthRatio)||capWidthRatio<=0||capWidthRatio>1)errors.push('가정 캡 폭 / 시위: 0보다 크고 1 이하여야 합니다.');
  for(const [key,n] of Object.entries(s.weightBudget))if(n!==null && (!Number.isFinite(n)||n<0))errors.push(key+': 중량은 0 이상이어야 합니다.');
  return errors;
};
AST.geometryChecks = function(s){
  const w=s.wing,f=s.fuselage,checks=[];
  const relative=(a,b)=>Math.abs(a-b)/Math.max(Math.abs(b),1e-9);
  const add=(name,actual,expected,unit,warning=false)=>checks.push({name,actual,expected,unit,warning});
  add('AR = b²/S',w.ar,w.span*w.span/w.area,'—');
  add('S = b(cr+ct)/2',w.span*(w.rootChord+w.tipChord)/2,w.area,'m²',!w.autoChords&&relative(w.span*(w.rootChord+w.tipChord)/2,w.area)>0.02);
  add('Taper = ct/cr',w.taper,w.tipChord/w.rootChord,'—');
  add('MAC (trapezoid)',w.mac,AST.trapezoidMAC(w.rootChord,w.tipChord),'m');
  add('1/4 시위 후퇴각 (앞전 후퇴각·시위에서 계산)',w.quarterSweep,Math.atan(Math.tan(w.sweep*Math.PI/180)-(w.rootChord-w.tipChord)/(2*w.span))*180/Math.PI,'deg');
  add('익근 최대두께 = cr(t/c)',w.rootChord*w.tc*1000,w.rootChord*w.tc*1000,'mm');
  add('동체 l/d ≈ L/[(폭+높이)/2]',f.ld,f.length/((f.width+f.height)/2),'—');
  if(s.presetLocked){
    add('INHA 제공 날개폭 ≈ 2.98 m',w.span,AST.inhaTwoProp.referenceSpan,'m',relative(w.span,AST.inhaTwoProp.referenceSpan)>0.01);
    add('INHA 제공 등가시위 ≈ 0.248 m',w.equivChord,AST.inhaTwoProp.referenceEquivalentChord,'m',relative(w.equivChord,AST.inhaTwoProp.referenceEquivalentChord)>0.01);
  }
  if(s.sparDesign.localThicknessMm!==null && s.sparDesign.localThicknessMm>w.rootChord*w.tc*1000)
    checks.push({name:'스파 위치 두께가 익근 최대두께 상한을 초과합니다. 구조 가정을 재검토하세요.',warning:true});
  return checks;
};
