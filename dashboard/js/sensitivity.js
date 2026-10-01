window.AST = window.AST || {};
AST.sensitivityDefs = {
  finger: { label:'Finger 공허중량', unit:'kg', paths:['aircraft.mass'], read:r=>r.weight.finger },
  raymerWing: { label:'Raymer 주익', unit:'kg', paths:['wing.area','wing.span','wing.ar','wing.tc','wing.taper','wing.sweep','flight.q','flight.speed','flight.rho','aircraft.mass','aircraft.nLimit','aircraft.fs'], read:r=>r.weight.raymerWing },
  sadraeyWing: { label:'Sadraey 주익 식 값', unit:'참고값', paths:['wing.area','wing.span','wing.ar','wing.mac','wing.tc','wing.taper','wing.quarterSweep','material.density','material.krw','aircraft.nLimit','aircraft.fs','aircraft.g'], read:r=>r.weight.sadraeyWing },
  raymerFuse: { label:'Raymer 동체', unit:'kg', paths:['fuselage.wettedArea','fuselage.lt','fuselage.ld','flight.q','flight.speed','flight.rho','aircraft.mass','aircraft.nLimit','aircraft.fs'], read:r=>r.weight.raymerFuse },
  sadraeyFuse: { label:'Sadraey 동체 식 값', unit:'참고값', paths:['fuselage.width','fuselage.height','fuselage.length','material.density','material.krf','material.pmax','material.kinlet','aircraft.nLimit','aircraft.fs','aircraft.g'], read:r=>r.weight.sadraeyFuse },
  gustPlus: { label:'양의 돌풍 하중계수', unit:'g', paths:['aircraft.mass','aircraft.g','wing.area','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG'], read:r=>r.loads.gustPlus },
  impact: { label:'평균 착륙 충격력', unit:'N', paths:['aircraft.mass','aircraft.g','landing.drop','landing.stop'], read:r=>r.loads.impact },
  sparCap: { label:'필요 스파 캡 면적', unit:'mm²', paths:['aircraft.mass','aircraft.nLimit','aircraft.fs','aircraft.g','wing.span','wing.ar','wing.area','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG','design.customLoad','material.capStress','material.capHeight'], read:r=>r.spar.capAreaMm2 },
  sparWeb: { label:'필요 스파 웹 두께', unit:'mm', paths:['aircraft.mass','aircraft.nLimit','aircraft.fs','aircraft.g','wing.area','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG','design.customLoad','material.webStress','material.webHeight'], read:r=>r.spar.webThicknessMm }
};
AST.sensitivity = function (state, equation, variable, range) {
  const def = AST.sensitivityDefs[equation];
  if (!def) return null;
  const sparEquation = equation === 'sparCap' || equation === 'sparWeb';
  const paths = def.paths.filter(path => !(path === 'wing.ar' && state.wing.autoAR) &&
    !(path === 'wing.span' && !state.wing.autoAR) &&
    !(path === 'wing.mac' && state.wing.autoChords) &&
    !(path === 'flight.q' && state.flight.autoQ) &&
    !((path === 'flight.speed' || path === 'flight.rho') && !state.flight.autoQ && (equation === 'raymerWing' || equation === 'raymerFuse')) &&
    !(path === 'design.customLoad' && state.design.source !== 'custom') &&
    !(sparEquation && state.design.source === 'custom' && !(
      ['design.customLoad','material.capStress','material.capHeight','material.webStress','material.webHeight'].includes(path) ||
      (equation === 'sparCap' && (path === (state.wing.autoAR ? 'wing.span' : 'wing.ar') || (!state.wing.autoAR && path === 'wing.area')))
    )));
  // Include only independent geometry inputs and active design-load dependencies.
  const active = paths.filter(path => {
    if ((equation === 'sparCap' || equation === 'sparWeb') && state.design.source === 'gust') return path !== 'aircraft.nLimit' && path !== 'aircraft.fs';
    if ((equation === 'sparCap' || equation === 'sparWeb') && state.design.source === 'ultimate') {
      if (['flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG'].includes(path)) return false;
      if (path === 'wing.area') return equation === 'sparCap' && !state.wing.autoAR;
    }
    return true;
  });
  const base = AST.calculate(state);
  if (base.errors.length) return null;
  const baseY = def.read(base);
  const evaluate = (path, pct) => {
    const next = AST.clone(state), original = AST.get(state,path);
    AST.set(next,path,original * (1 + pct / 100));
    const r = AST.calculate(next);
    return r.errors.length ? null : def.read(r);
  };
  const table = active.map(path => {
    const original = AST.get(state,path);
    if (!Number.isFinite(original) || original <= 0) return null;
    const lo = evaluate(path,-1), hi = evaluate(path,1);
    const minus20 = evaluate(path,-20), plus20 = evaluate(path,20);
    if ([lo,hi,minus20,plus20].some(v=>v===null)) return null;
    const index = baseY === 0 ? 0 : (hi-lo)/(0.02*baseY);
    return { path, baseline:original, index, direction:index > 0.001 ? '↑' : index < -0.001 ? '↓' : '—', minus20, base:baseY, plus20 };
  }).filter(Boolean).sort((a,b)=>Math.abs(b.index)-Math.abs(a.index));
  const chosen = active.includes(variable) ? variable : (table[0] && table[0].path);
  const bounded = Math.min(80,Math.max(1,Number(range)||20));
  const curve = chosen ? Array.from({length:13},(_,i)=>{
    const pct = -bounded + 2*bounded*i/12;
    return { pct, value:evaluate(chosen,pct) };
  }).filter(p=>p.value!==null) : [];
  return { def, table, chosen, curve, baseline:baseY, paths:active };
};
