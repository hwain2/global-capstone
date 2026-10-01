window.AST = window.AST || {};
AST.weight = function (s) {
  const u = AST.units, w = s.wing, f = s.fuselage, a = s.aircraft, m = s.material;
  const nult = a.nLimit * a.fs, sweep = Math.cos(w.sweep * Math.PI / 180);
  const quarter = Math.cos(w.quarterSweep * Math.PI / 180), qPsf = u.paToPsf(s.flight.q);
  const wdgLb = u.kgToLb(a.mass), swFt2 = u.m2ToFt2(w.area), sfFt2 = u.m2ToFt2(f.wettedArea);
  const raymerWingLb = 0.036 * Math.pow(swFt2, 0.758) * Math.pow(1, 0.0035) *
    Math.pow(w.ar / (sweep * sweep), 0.6) * Math.pow(qPsf, 0.006) *
    Math.pow(w.taper, 0.04) * Math.pow(100 * w.tc / sweep, -0.3) * Math.pow(nult * wdgLb, 0.49);
  const raymerFuseLb = 0.052 * Math.pow(sfFt2, 1.086) * Math.pow(nult * wdgLb, 0.177) *
    Math.pow(u.mToFt(f.lt), -0.051) * Math.pow(f.ld, -0.072) * Math.pow(qPsf, 0.241);
  const sadWingExpression = w.area * w.mac * w.tc * m.density * m.krw *
    Math.pow(w.ar * nult / quarter, 0.6) * Math.pow(w.taper, 0.04) * a.g;
  const sadFuseExpression = m.density * m.krf * m.pmax *
    Math.pow(((f.width + f.height) / 2) * f.length, 1.2) * Math.pow(nult, 0.3) * m.kinlet * a.g;
  return {
    finger: 0.699 * Math.pow(a.mass, 0.949),
    raymerWing: u.lbToKg(raymerWingLb),
    sadraeyWing: sadWingExpression,
    raymerFuse: u.lbToKg(raymerFuseLb),
    sadraeyFuse: sadFuseExpression
  };
};
