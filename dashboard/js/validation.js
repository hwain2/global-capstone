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
    ['material.capHeight','캡 유효 높이'], ['material.webHeight','웹 유효 높이']
  ];
  positive.forEach(([path, label]) => { const n = AST.get(s, path); if (!Number.isFinite(n) || n <= 0) errors.push(label + ': 0보다 큰 값을 입력하세요.'); });
  [['flight.gustSpeed','돌풍속도'], ['landing.drop','낙하 높이'], ['design.customLoad','사용자 지정 총양력']].forEach(([path,label]) => {
    const n = AST.get(s,path); if (!Number.isFinite(n) || n < 0) errors.push(label + ': 0 이상의 값을 입력하세요.');
  });
  ['wing.sweep','wing.quarterSweep'].forEach(path => {
    const n = AST.get(s,path);
    if (!Number.isFinite(n) || Math.abs(Math.cos(n * Math.PI / 180)) < 0.05) errors.push((path==='wing.sweep'?'앞전 후퇴각':'1/4 시위 후퇴각') + '의 코사인 값이 0에 너무 가깝습니다.');
  });
  if (s.wing.autoAR && Math.abs(s.wing.ar) > 1e5) errors.push('자동 계산된 가로세로비가 허용 범위를 벗어났습니다.');
  return errors;
};
