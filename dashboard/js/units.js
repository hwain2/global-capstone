window.AST = window.AST || {};
AST.units = {
  m2ToFt2: v => v * 10.7639104167,
  mToFt: v => v * 3.280839895,
  kgToLb: v => v * 2.20462262185,
  lbToKg: v => v / 2.20462262185,
  paToPsf: v => v * 0.020885434273,
  m2ToMm2: v => v * 1e6,
  mToMm: v => v * 1e3,
  mpaToPa: v => v * 1e6,
  mmToM: v => v / 1e3
};
