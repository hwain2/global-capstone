window.AST = window.AST || {};
AST.loads = function (s) {
  const weight = s.aircraft.mass * s.aircraft.g;
  const nUlt = s.aircraft.nLimit * s.aircraft.fs;
  const kg = 0.88 * s.flight.muG / (5.3 + s.flight.muG);
  const wingLoading = weight / s.wing.area;
  const deltaN = kg * s.flight.rho * s.flight.gustSpeed * s.flight.speed * s.flight.liftSlope / (2 * wingLoading);
  const gustPlus = 1 + deltaN, gustMinus = 1 - deltaN;
  return {
    weight, nUlt, ultimate: nUlt * weight, kg, wingLoading, deltaN,
    gustPlus, gustMinus, gustPlusLoad: gustPlus * weight, gustUltimate: gustPlus * weight * s.aircraft.fs, gustMinusLoad: gustMinus * weight,
    impact: weight * (1 + s.landing.drop / s.landing.stop)
  };
};
