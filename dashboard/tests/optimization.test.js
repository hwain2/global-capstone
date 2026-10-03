// Run with Node.js: node tests/optimization.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={window:{}};
context.window=context;
vm.createContext(context);
for(const name of ['defaults','units','validation','calculations-weight','calculations-loads','calculations-spar','calculations-optimization','feasibility']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),context,{filename:name+'.js'});
}
const A=context.AST;
A.fmt=(value,places=2)=>Number.isFinite(value)?value.toFixed(places):'—';
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
  assert.equal(o.overall,'STRUCTURAL REDESIGN REQUIRED');
  assert.equal(o.thicknessBasis,'NACA4_ASSUMED');
  assert.equal(o.recommended,null);
  assert.ok(o.provisional,'strength/packaging candidate remains visible when stiffness fails');
  assert.ok(Math.abs(o.rootCapWidthMm-r.state.wing.rootChord*1000*r.state.sparDesign.capWidthRatio)<1e-9);
  const s=inha();s.sparDesign.requestedDepthMm=100;
  assert.equal(calc(s).optimization.overall,o.overall,'old manual depth must not determine baseline');
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
{
  const a=A.assessFeasibility(calc(inha()));
  assert.equal(a.verdict,'경험식 기준 불가능');
  assert.deepEqual(Array.from(a.cards,c=>c.status),['PASS','PASS','PASS','FAIL']);
  assert.equal(a.scenarios.length,3);
  assert.ok(a.scenarios.every(item=>item.candidate));
  const s=built(),initial=calc(s);
  for(const key of Object.keys(s.weightBudget))s.weightBudget[key]=0;
  s.weightBudget.wingStructure=initial.weight.raymerWing+0.1;
  s.weightBudget.fuselageStructure=initial.weight.raymerFuse+0.1;
  const pass=A.assessFeasibility(calc(s));
  assert.equal(pass.verdict,'경험식 기준 가능');
  assert.deepEqual(Array.from(pass.cards,c=>c.status),['PASS','PASS','PASS','PASS']);
  s.sparDesign.manufacturingMinCapMm=100;
  const fail=A.assessFeasibility(calc(s));
  assert.equal(fail.verdict,'경험식 기준 불가능');
  assert.equal(fail.cards[2].status,'FAIL');
}
{
  const thin=inha();thin.wing.tc=0.03;
  const failed=A.assessFeasibility(calc(thin));
  assert.equal(failed.verdict,'경험식 기준 불가능');
  assert.equal(failed.cards[2].status,'FAIL');
  const uncertain=inha();uncertain.wing.tc=0.06;
  const mixed=A.assessFeasibility(calc(uncertain));
  assert.equal(mixed.verdict,'경험식 기준 불가능');
  assert.equal(mixed.cards[2].status,'TBD');
  const reducedTarget=inha();reducedTarget.feasibility.designTarget=10;
  assert.equal(A.assessFeasibility(calc(reducedTarget)).cards[0].status,'FAIL');
  const invalid=inha();invalid.sparDesign.sparXc=1.1;
  assert.ok(A.calculate(invalid).errors.some(message=>message.includes('x/c')));
}
{
  const beam=A.uniformBeamTipDeflectionMm(200,1.5,70,50000);
  const w=200/1.5;
  assert.ok(Math.abs(beam-w*1.5**4/(8*70e9*50000e-12)*1000)<1e-9);
  const limit=calc(built());
  const c=limit.optimization.candidates[10];
  const strongerLimit=built();strongerLimit.aircraft.nLimit*=1.2;
  const moreLoad=calc(strongerLimit);
  assert.ok(moreLoad.optimization.candidates[10].predictedDeflectionMm>c.predictedDeflectionMm);
  assert.ok(moreLoad.optimization.candidates[10].rootCapAreaMm2>c.rootCapAreaMm2);
  const relaxed=built();relaxed.feasibility.tipDeflectionLimitMm=null;
  const r=calc(relaxed);
  assert.equal(A.assessFeasibility(r).cards[3].status,'TBD');
  const greaterFS=built();greaterFS.aircraft.fs=2;
  const fsResult=calc(greaterFS);
  assert.equal(fsResult.optimization.deflectionLoad,limit.optimization.deflectionLoad,
    'maneuver deflection load must remain at limit load');
  assert.ok(fsResult.optimization.designLoad>limit.optimization.designLoad,
    'strength design load must use ultimate load');
  const roomier=A.clone(A.defaults);
  const sized=calc(roomier).optimization.recommended;
  assert.ok(sized&&sized.capScale>1,'stiffness should increase the cap where geometry permits');
  assert.ok(sized.predictedDeflectionMm<=roomier.feasibility.tipDeflectionLimitMm+1e-6);
  assert.ok(sized.depthMm+sized.rootCapThicknessMm<=calc(roomier).optimization.availableRootMm+1e-6);
}
console.log('Automatic spar sizing tests passed');
