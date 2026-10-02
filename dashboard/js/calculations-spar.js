window.AST = window.AST || {};
AST.spar = function (s, loads) {
  const source=s.design.source, d=s.sparDesign;
  const load=source==='gust'?loads.gustUltimate:source==='custom'?s.design.customLoad:source==='landing'?loads.impact:loads.ultimate;
  const wingLoad=source==='landing'?null:load;
  const rootShear=wingLoad===null?null:wingLoad/2;
  const rootMoment=wingLoad===null?null:wingLoad*s.wing.span/(3*Math.PI);
  const rootMaxThicknessMm=s.wing.rootChord*s.wing.tc*1000;
  // Without airfoil coordinates, rootMaxThicknessMm is only an upper bound at the root.
  const localThicknessMm=d.localThicknessMm===null?rootMaxThicknessMm:Math.min(d.localThicknessMm,rootMaxThicknessMm);
  const availableDepthMm=d.depthFactor===null?null:localThicknessMm*d.depthFactor;
  const depthConflict=availableDepthMm!==null && d.requestedDepthMm!==null && d.requestedDepthMm>availableDepthMm;
  const sizingDepthMm=availableDepthMm===null?null:Math.min(d.requestedDepthMm??availableDepthMm,availableDepthMm);
  const capAreaMm2=rootMoment===null||sizingDepthMm===null?null:Math.abs(rootMoment)*1000/(s.material.capStress*sizingDepthMm);
  const webThicknessMm=rootShear===null||sizingDepthMm===null?null:Math.abs(rootShear)/(s.material.webStress*sizingDepthMm);
  const adoptedWebThicknessMm=webThicknessMm===null||d.manufacturingMinWebMm===null?null:Math.max(webThicknessMm,d.manufacturingMinWebMm);
  const requiredDepthMm=rootMoment===null||d.selectedCapAreaMm2===null||d.selectedWebThicknessMm===null?null:Math.max(
    Math.abs(rootMoment)*1000/(s.material.capStress*d.selectedCapAreaMm2),
    Math.abs(rootShear)/(s.material.webStress*d.selectedWebThicknessMm)
  );
  const sectionDepthConflict=requiredDepthMm!==null&&availableDepthMm!==null&&requiredDepthMm>availableDepthMm;
  return {load,wingLoad,rootShear,rootMoment,rootMaxThicknessMm,localThicknessMm,availableDepthMm,sizingDepthMm,
    depthConflict:depthConflict||sectionDepthConflict,requestedDepthConflict:depthConflict,sectionDepthConflict,requiredDepthMm,
    capAreaMm2,webThicknessMm,adoptedWebThicknessMm,localThicknessVerified:d.localThicknessMm!==null&&d.localThicknessMm<=rootMaxThicknessMm};
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
  if (Object.values(values).some(v => v!==null && typeof v==='number' && !Number.isFinite(v))) return { state:s, errors:['계산 결과가 유한하지 않습니다. 입력 범위를 확인하세요.'] };
  return { state:s, errors:[], weight, loads, spar, span:AST.spanLoads(spar.wingLoad??loads.ultimate, s.wing.span),optimization:AST.optimizeSpar(s,loads) };
};
