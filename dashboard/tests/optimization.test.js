// Run with Node.js: node tests/optimization.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={window:{}};
context.window=context;
vm.createContext(context);
for(const name of ['defaults','units','validation','calculations-weight','calculations-loads','calculations-spar','calculations-optimization']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),context,{filename:name+'.js'});
}
const A=context.AST;
const inha=()=>{
  const s=A.clone(A.defaults);
  s.aircraft.mass=24.9;s.aircraft.g=9.81;s.wing.area=.74;s.wing.autoAR=false;s.wing.ar=12;
  return A.synchronize(s);
};
const built=()=>{
  const s=inha();
  s.sparDesign.localThicknessMm=s.wing.rootChord*s.wing.tc*1000*.75;
  s.sparDesign.capWidthMm=30;
  s.sparDesign.manufacturingMinCapMm=.4;
  s.sparDesign.manufacturingMinWebMm=.4;
  s.material.elasticModulusGPa=70;
  s.feasibility.tipDeflectionLimitMm=1000;
  return s;
};
const calc=s=>{const r=A.calculate(s);assert.deepEqual(Array.from(r.errors),[]);return r;};
{
  const r=calc(inha()),o=r.optimization;
  assert.ok(Math.abs(r.state.wing.span-2.98)<.01);
  assert.equal(o.candidates.length,19);
  assert.ok(o.candidates.every(c=>c.depthMm<=o.availableRootMm));
  assert.ok(o.candidates[0].rootCapAreaMm2>o.candidates.at(-1).rootCapAreaMm2);
  assert.equal(o.overall,'INSUFFICIENT DATA');
  const s=inha();s.sparDesign.requestedDepthMm=100;
  assert.equal(calc(s).optimization.overall,'INSUFFICIENT DATA','old manual depth must not fail baseline');
}
{
  const base=calc(built()),higher= built();higher.aircraft.nLimit*=1.2;
  const h=calc(higher);
  assert.ok(h.optimization.candidates[8].rootCapAreaMm2>base.optimization.candidates[8].rootCapAreaMm2);
  assert.ok(h.optimization.candidates[8].rootWebThicknessMm>base.optimization.candidates[8].rootWebThicknessMm);
  const stronger=built();stronger.material.capStress*=1.5;stronger.material.webStress*=1.5;
  const t=calc(stronger);
  assert.ok(t.optimization.candidates[8].rootCapAreaMm2<base.optimization.candidates[8].rootCapAreaMm2);
  assert.ok(t.optimization.candidates[8].rootWebThicknessMm<base.optimization.candidates[8].rootWebThicknessMm);
  assert.ok(base.optimization.recommended);
  const best=Math.min(...base.optimization.candidates.filter(c=>c.eligible).map(c=>c.massKg));
  assert.ok(Math.abs(base.optimization.recommended.massKg-best)<1e-12);
  assert.ok(base.optimization.recommended.strengthMargin>=-1e-9);
  assert.ok(base.optimization.recommended.predictedDeflectionMm<=base.state.feasibility.tipDeflectionLimitMm);
  assert.ok(base.optimization.recommended.massKg>=base.optimization.recommended.theoreticalMassKg);
  const c=base.optimization.recommended;
  assert.ok(Math.abs(c.upperCapMassKg+c.lowerCapMassKg+c.webMassKg-c.massKg)<1e-12);
  assert.ok(Math.abs(c.rootCapAreaMm2-base.optimization.span[0].moment*1000/(base.state.material.capStress*c.depthMm))<1e-10);
}
{
  const s=built();s.sparDesign.manufacturingMinCapMm=100;
  const r=calc(s);
  assert.equal(r.optimization.recommended,null);
  assert.equal(r.optimization.overall,'STRUCTURAL REDESIGN REQUIRED');
  assert.ok(r.optimization.candidates.every(c=>!c.eligible));
}
{
  const s=built();s.feasibility.tipDeflectionLimitMm=null;
  const r=calc(s);
  assert.ok(r.optimization.recommended);
  assert.equal(r.optimization.recommended.stiffnessPass,null);
  assert.equal(r.optimization.overall,'CONDITIONALLY FEASIBLE');
}
console.log('Automatic spar sizing tests passed');
