window.AST = window.AST || {};
AST.defaults = {
  presetLocked: false,
  aircraft: { mass: 25, nLimit: 3.8, fs: 1.5, g: 9.80665 },
  wing: { area: 1.8, span: 3.6, autoAR: true, ar: 7.2, autoChords: true, rootChord: 0.68, tipChord: 0.32, mac: 0.52, equivChord: 0.5, taper: 0.47, sweep: 8, quarterSweep: 5, tc: 0.12 },
  fuselage: { length: 1.35, width: 0.34, height: 0.38, wettedArea: 2.1, ld: 3.75, lt: 0.85 },
  flight: { speed: 22, rho: 1.225, q: 296.45, cruiseCL: null, ld: null, gustSpeed: 7.5, liftSlope: 5.4, muG: 10 },
  landing: { drop: 0.3, stop: 0.08 },
  material: { density: 1600, krw: 1, krf: 1, kinlet: 1, pmax: 1, capStress: 300, webStress: 80, elasticModulusGPa: 70 },
  sparDesign: { depthFactor: 0.75, sparXc: 0.30, localThicknessMm: null, requestedDepthMm: null, selectedCapAreaMm2: null, selectedWebThicknessMm: null, capWidthRatio: 0.08, capWidthMm: null, manufacturingMinCapMm: 0.4, manufacturingMinWebMm: 0.4 },
  design: { source: 'ultimate', customLoad: null },
  feasibility: { mtowLimit: 24.9, designTarget: 22.4, tipDeflectionMm: null, tipDeflectionLimitMm: 25, stallSpeedLimit: 17, airfoilClMax: null },
  weightBudget: { wingStructure: null, fuselageStructure: null, tailStructure: null, landingGear: null, propulsion: null, battery: null, avionics: null, wiring: null, payload: null, other: null },
  sources: { 'sparDesign.depthFactor':'ASSUMED', 'sparDesign.sparXc':'ASSUMED', 'sparDesign.capWidthRatio':'ASSUMED', 'sparDesign.manufacturingMinCapMm':'ASSUMED', 'sparDesign.manufacturingMinWebMm':'ASSUMED', 'material.elasticModulusGPa':'ASSUMED', 'feasibility.tipDeflectionLimitMm':'ASSUMED' },
  display: { aircraft: true, lift: true, weight: true, shear: true, moment: true, gust: false, impact: false, spar: true, cg: true, dimensions: false },
  sensitivity: { equation: 'raymerWing', variable: 'wing.span', range: 20 }
};
AST.baselineLockedPaths = [];
AST.clone = value => JSON.parse(JSON.stringify(value));
AST.trapezoidMAC = (root,tip) => root > 0 && tip > 0 ? (2/3)*root*(1+tip/root+(tip/root)**2)/(1+tip/root) : NaN;
AST.resolve = function (state) {
  const s=AST.clone(state),w=s.wing,f=s.fuselage;
  if(w.autoAR)w.ar=w.span*w.span/w.area;
  else w.span=Math.sqrt(w.area*w.ar);
  if(w.autoChords){w.rootChord=2*w.area/(w.span*(1+w.taper));w.tipChord=w.rootChord*w.taper;}
  else w.taper=w.tipChord/w.rootChord;
  w.mac=AST.trapezoidMAC(w.rootChord,w.tipChord);
  w.equivChord=w.area/w.span;
  w.quarterSweep=Math.atan(Math.tan(w.sweep*Math.PI/180)-(w.rootChord-w.tipChord)/(2*w.span))*180/Math.PI;
  s.flight.q=0.5*s.flight.rho*s.flight.speed*s.flight.speed;
  f.ld=f.length/((f.width+f.height)/2);
  return s;
};
AST.synchronize = function (state) {
  const resolved=AST.resolve(state);
  for(const key of ['span','ar','rootChord','tipChord','taper','mac','equivChord','quarterSweep'])state.wing[key]=resolved.wing[key];
  state.flight.q=resolved.flight.q;
  state.fuselage.ld=resolved.fuselage.ld;
  return state;
};
AST.get = (obj, path) => path.split('.').reduce((a, k) => a==null?undefined:a[k], obj);
AST.set = (obj, path, value) => { const p = path.split('.'); obj[p[0]][p[1]] = value; };
