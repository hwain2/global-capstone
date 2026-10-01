window.AST = window.AST || {};
AST.spar = function (s, loads) {
  const source = s.design.source;
  const load = source === 'gust' ? loads.gustPlusLoad : source === 'custom' ? s.design.customLoad : loads.ultimate;
  const rootShear = load / 2;
  const rootMoment = load * s.wing.span / (3 * Math.PI);
  const capArea = Math.abs(rootMoment) / (AST.units.mpaToPa(s.material.capStress) * AST.units.mmToM(s.material.capHeight));
  const webThickness = Math.abs(rootShear) / (AST.units.mpaToPa(s.material.webStress) * AST.units.mmToM(s.material.webHeight));
  return { load, rootShear, rootMoment, capAreaMm2: AST.units.m2ToMm2(capArea), webThicknessMm: AST.units.mToMm(webThickness) };
};
AST.spanLoads = function (load, span, points = 61) {
  const R = span / 2, rows = [];
  for (let i = 0; i < points; i++) {
    const y = R * i / (points - 1), u = y / R, root = Math.sqrt(Math.max(0, 1 - u * u));
    const distribution = 2 * load / (Math.PI * R) * root;
    const shear = load / 2 * (1 - 2 / Math.PI * (Math.asin(u) + u * root));
    const moment = 2 * load * R / (3 * Math.PI) * Math.pow(Math.max(0, 1 - u * u), 1.5) - y * shear;
    rows.push({ y, distribution, shear: i === points - 1 ? 0 : shear, moment: i === points - 1 ? 0 : moment });
  }
  return rows;
};
AST.calculate = function (input) {
  const s = AST.resolve(input), errors = AST.validate(s);
  if (errors.length) return { state:s, errors };
  const weight = AST.weight(s), loads = AST.loads(s), spar = AST.spar(s, loads);
  const values = { ...weight, ...loads, ...spar };
  if (Object.values(values).some(v => !Number.isFinite(v))) return { state:s, errors:['계산 결과가 유한하지 않습니다. 입력 범위를 확인하세요.'] };
  return { state:s, errors:[], weight, loads, spar, span:AST.spanLoads(spar.load, s.wing.span) };
};
