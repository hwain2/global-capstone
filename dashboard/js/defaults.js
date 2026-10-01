window.AST = window.AST || {};
AST.defaults = {
  aircraft: { mass: 25, nLimit: 3.8, fs: 1.6, g: 9.80665 },
  wing: { area: 1.8, span: 3.6, autoAR: true, ar: 7.2, rootChord: 0.68, tipChord: 0.32, mac: 0.52, taper: 0.47, sweep: 8, quarterSweep: 5, tc: 0.12 },
  fuselage: { length: 1.35, width: 0.34, height: 0.38, wettedArea: 2.1, ld: 4, lt: 0.85 },
  flight: { speed: 22, rho: 1.225, autoQ: true, q: 296.45, gustSpeed: 7.5, liftSlope: 5.4, muG: 10 },
  landing: { drop: 0.3, stop: 0.08 },
  material: { density: 1600, krw: 1, krf: 1, kinlet: 1, pmax: 1, capStress: 300, webStress: 80, capHeight: 90, webHeight: 100 },
  design: { source: 'ultimate', customLoad: 1000 },
  display: { aircraft: true, lift: true, weight: true, shear: true, moment: true, gust: false, impact: false, spar: true, cg: true, dimensions: false },
  sensitivity: { equation: 'sparCap', variable: 'wing.span', range: 20 }
};
AST.clone = value => JSON.parse(JSON.stringify(value));
AST.resolve = function (state) {
  const s = AST.clone(state);
  if (s.wing.autoAR) s.wing.ar = s.wing.span * s.wing.span / s.wing.area;
  if (s.flight.autoQ) s.flight.q = 0.5 * s.flight.rho * s.flight.speed * s.flight.speed;
  return s;
};
AST.get = (obj, path) => path.split('.').reduce((a, k) => a && a[k], obj);
AST.set = (obj, path, value) => { const p = path.split('.'); obj[p[0]][p[1]] = value; };
