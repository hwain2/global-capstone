window.AST = window.AST || {};
AST.sensitivityDefs={
  finger:{label:'Finger 공허중량',unit:'kg',paths:['aircraft.mass'],read:r=>r.weight.finger},
  raymerWing:{label:'Raymer 주익',unit:'kg',paths:['wing.area','wing.span','wing.ar','wing.tc','wing.taper','wing.rootChord','wing.tipChord','wing.sweep','flight.speed','flight.rho','aircraft.mass','aircraft.nLimit','aircraft.fs'],read:r=>r.weight.raymerWing},
  sadraeyWing:{label:'Sadraey 주익 식 값',unit:'참고값',paths:['wing.area','wing.span','wing.ar','wing.rootChord','wing.tipChord','wing.tc','wing.taper','wing.quarterSweep','material.density','material.krw','aircraft.nLimit','aircraft.fs','aircraft.g'],read:r=>r.weight.sadraeyWing},
  raymerFuse:{label:'Raymer 동체',unit:'kg',paths:['fuselage.wettedArea','fuselage.lt','fuselage.length','fuselage.width','fuselage.height','flight.speed','flight.rho','aircraft.mass','aircraft.nLimit','aircraft.fs'],read:r=>r.weight.raymerFuse},
  sadraeyFuse:{label:'Sadraey 동체 식 값',unit:'참고값',paths:['fuselage.width','fuselage.height','fuselage.length','material.density','material.krf','material.pmax','material.kinlet','aircraft.nLimit','aircraft.fs','aircraft.g'],read:r=>r.weight.sadraeyFuse},
  gustPlus:{label:'양의 돌풍 하중계수',unit:'g',paths:['aircraft.mass','aircraft.g','wing.area','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG'],read:r=>r.loads.gustPlus},
  impact:{label:'평균 착륙 충격력',unit:'N',paths:['aircraft.mass','aircraft.g','landing.drop','landing.stop'],read:r=>r.loads.impact},
  sparCap:{label:'필요 스파 캡 면적',unit:'mm²',paths:['aircraft.mass','aircraft.nLimit','aircraft.fs','aircraft.g','wing.span','wing.ar','wing.area','wing.tc','wing.taper','wing.rootChord','wing.tipChord','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG','design.customLoad','material.capStress','sparDesign.depthFactor','sparDesign.localThicknessMm','sparDesign.requestedDepthMm'],read:r=>r.spar.capAreaMm2},
  sparWeb:{label:'웹 이론 최소두께',unit:'mm',paths:['aircraft.mass','aircraft.nLimit','aircraft.fs','aircraft.g','wing.area','wing.span','wing.ar','wing.tc','wing.taper','wing.rootChord','wing.tipChord','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG','design.customLoad','material.webStress','sparDesign.depthFactor','sparDesign.localThicknessMm','sparDesign.requestedDepthMm'],read:r=>r.spar.webThicknessMm}
};
AST.sensitivity=function(state,equation,variable,range){
  const def=AST.sensitivityDefs[equation];if(!def)return null;
  const sparEquation=equation==='sparCap'||equation==='sparWeb';
  const derived=path=>path==='wing.span'?!state.wing.autoAR:path==='wing.ar'?state.wing.autoAR:path==='wing.taper'?!state.wing.autoChords:['wing.rootChord','wing.tipChord'].includes(path)&&state.wing.autoChords;
  const paths=def.paths.filter(path=>{
    if(derived(path)||AST.get(state,path)===null)return false;
    if(path==='design.customLoad'&&state.design.source!=='custom')return false;
    if(!sparEquation)return true;
    if(state.design.source==='landing')return false;
    if(state.design.source==='ultimate'&&['flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG','design.customLoad'].includes(path))return false;
    if(state.design.source==='gust'&&['aircraft.nLimit','design.customLoad'].includes(path))return false;
    if(state.design.source==='custom'&&['aircraft.mass','aircraft.nLimit','aircraft.fs','aircraft.g','flight.rho','flight.gustSpeed','flight.speed','flight.liftSlope','flight.muG'].includes(path))return false;
    return true;
  });
  const base=AST.calculate(state);if(base.errors.length)return null;
  const baseY=def.read(base);if(!Number.isFinite(baseY))return null;
  const evaluate=(path,pct)=>{
    const next=AST.clone(state),original=AST.get(state,path);
    AST.set(next,path,original*(1+pct/100));
    const result=AST.calculate(next),v=result.errors.length?null:def.read(result);
    return Number.isFinite(v)?v:null;
  };
  const table=paths.map(path=>{
    const original=AST.get(state,path);if(!Number.isFinite(original)||original<=0)return null;
    const lo=evaluate(path,-1),hi=evaluate(path,1),minus20=evaluate(path,-20),plus20=evaluate(path,20);
    if([lo,hi,minus20,plus20].some(v=>v===null))return null;
    const index=baseY===0?0:(hi-lo)/(0.02*baseY);
    return {path,baseline:original,index,direction:index>0.001?'↑':index < -0.001?'↓':'—',minus20,base:baseY,plus20};
  }).filter(Boolean).sort((a,b)=>Math.abs(b.index)-Math.abs(a.index));
  const chosen=table.some(row=>row.path===variable)?variable:table[0]?.path;
  const bounded=Math.min(80,Math.max(1,Number(range)||20));
  const curve=chosen?Array.from({length:13},(_,i)=>{const pct=-bounded+2*bounded*i/12;return {pct,value:evaluate(chosen,pct)};}).filter(p=>p.value!==null):[];
  return {def,table,chosen,curve,baseline:baseY,paths:table.map(row=>row.path)};
};
