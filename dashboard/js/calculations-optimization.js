window.AST = window.AST || {};
// Root-section sizing uses the same M/(sigma*h) and V/(tau*h) equations as AST.spar.
// A future airfoil adapter may replace localThicknessAt(y) with thickness at spar x/c.
AST.optimizeSpar = function(s, loads) {
  const w=s.wing,d=s.sparDesign,mat=s.material,half=w.span/2;
  const designLoad=Math.max(loads.ultimate,loads.gustUltimate,
    s.design.source==='custom' ? s.design.customLoad : 0);
  const span=AST.spanLoads(designLoad,w.span,121);
  const rootMaxThicknessMm=w.rootChord*w.tc*1000;
  const thicknessAt=y=>{
    const chord=w.rootChord+(w.tipChord-w.rootChord)*y/half;
    const localThicknessAt=(d.localThicknessMm===null?chord*w.tc*1000:
      d.localThicknessMm*chord/w.rootChord);
    return {chordMm:chord*1000,thicknessMm:Math.min(localThicknessAt,chord*w.tc*1000)};
  };
  const availableRootMm=thicknessAt(0).thicknessMm*d.depthFactor;
  const buildInputsReady=d.capWidthMm!==null&&d.manufacturingMinCapMm!==null&&d.manufacturingMinWebMm!==null;
  const verifiedThickness=d.localThicknessMm!==null&&d.localThicknessMm<=rootMaxThicknessMm;
  const modulusReady=mat.elasticModulusGPa!==null;
  const deflectionLimit=s.feasibility.tipDeflectionLimitMm;
  const count=19,candidates=[];
  for(let i=0;i<count;i++){
    const fraction=0.5+0.45*i/(count-1),depthMm=fraction*availableRootMm;
    let upper=0,lower=0,web=0,theoreticalUpper=0,theoreticalWeb=0,deflection=0;
    let packaging=true,minCapMS=Infinity,minWebMS=Infinity,maxCapStress=0,maxWebShear=0,maxCapThickness=0,maxWebThickness=0;
    let rootCapArea=0,rootWebThickness=0,rootCapThickness=null,rootSelectedWeb=null;
    for(let j=0;j<span.length-1;j++){
      const a=span[j],b=span[j+1],y=(a.y+b.y)/2,dy=b.y-a.y;
      const M=(a.moment+b.moment)/2,V=(a.shear+b.shear)/2;
      const {chordMm,thicknessMm}=thicknessAt(y);
      const available=thicknessMm*d.depthFactor;
      const h=depthMm*thicknessMm/thicknessAt(0).thicknessMm;
      const capRequired=Math.abs(M)*1000/(mat.capStress*h);
      const webRequired=Math.abs(V)/(mat.webStress*h);
      const selectedCapThickness=buildInputsReady?Math.max(capRequired/d.capWidthMm,d.manufacturingMinCapMm):null;
      const selectedCapArea=buildInputsReady?selectedCapThickness*d.capWidthMm:capRequired;
      const selectedWeb=buildInputsReady?Math.max(webRequired,d.manufacturingMinWebMm):webRequired;
      theoreticalUpper+=capRequired*1e-6*dy*mat.density;
      theoreticalWeb+=webRequired*h*1e-6*dy*mat.density;
      upper+=selectedCapArea*1e-6*dy*mat.density;
      lower+=selectedCapArea*1e-6*dy*mat.density;
      web+=selectedWeb*h*1e-6*dy*mat.density;
      // h is the cap-centroid spacing used by the existing bending equation.
      // Two cap laminates add one cap thickness to the outside-to-outside depth.
      if(h>available+1e-8||buildInputsReady&&(d.capWidthMm>chordMm||
          h+selectedCapThickness>available+1e-8||selectedCapThickness>=h||selectedWeb>d.capWidthMm))packaging=false;
      const capActual=Math.abs(M)*1000/(selectedCapArea*h);
      const webActual=Math.abs(V)/(selectedWeb*h);
      maxCapStress=Math.max(maxCapStress,capActual);
      maxWebShear=Math.max(maxWebShear,webActual);
      minCapMS=Math.min(minCapMS,capActual>0?mat.capStress/capActual-1:Infinity);
      minWebMS=Math.min(minWebMS,webActual>0?mat.webStress/webActual-1:Infinity);
      maxCapThickness=Math.max(maxCapThickness,selectedCapThickness??0);
      maxWebThickness=Math.max(maxWebThickness,selectedWeb);
      if(modulusReady){
        const I=2*selectedCapArea*(h/2)**2+selectedWeb*h**3/12;
        deflection+=M*(half-y)/(mat.elasticModulusGPa*1e9*I*1e-12)*dy*1000;
      }
    }
    const rootM=Math.abs(span[0].moment),rootV=Math.abs(span[0].shear);
    rootCapArea=rootM*1000/(mat.capStress*depthMm);
    rootWebThickness=rootV/(mat.webStress*depthMm);
    rootCapThickness=buildInputsReady?Math.max(rootCapArea/d.capWidthMm,d.manufacturingMinCapMm):null;
    rootSelectedWeb=buildInputsReady?Math.max(rootWebThickness,d.manufacturingMinWebMm):rootWebThickness;
    const massKg=2*(upper+lower+web),theoreticalMassKg=2*(2*theoreticalUpper+theoreticalWeb);
    const predictedDeflectionMm=modulusReady?deflection:null;
    const strengthPass=minCapMS>=-1e-9&&minWebMS>=-1e-9;
    if(Math.abs(minCapMS)<1e-9)minCapMS=0;
    if(Math.abs(minWebMS)<1e-9)minWebMS=0;
    const stiffnessPass=predictedDeflectionMm===null||deflectionLimit===null?null:predictedDeflectionMm<=deflectionLimit;
    const eligible=verifiedThickness&&packaging&&strengthPass&&buildInputsReady&&stiffnessPass!==false;
    candidates.push({index:i,fraction,depthMm,availableRootMm,rootCapAreaMm2:rootCapArea,
      rootWebThicknessMm:rootWebThickness,rootCapThicknessMm:rootCapThickness,
      rootSelectedWebThicknessMm:rootSelectedWeb,upperCapMassKg:2*upper,lowerCapMassKg:2*lower,
      webMassKg:2*web,massKg,theoreticalMassKg,predictedDeflectionMm,
      capMargin:minCapMS,webMargin:minWebMS,strengthMargin:Math.min(minCapMS,minWebMS),
      capStressMpa:maxCapStress,webShearMpa:maxWebShear,
      packagingPass:packaging,packagingStatus:verifiedThickness?(packaging?'PASS':'FAIL'):'TBD',
      strengthPass,stiffnessPass,manufacturingStatus:buildInputsReady?'PASS':'TBD',
      maxCapThicknessMm:buildInputsReady?maxCapThickness:null,maxWebThicknessMm:maxWebThickness,
      eligible});
  }
  const feasible=candidates.filter(c=>c.eligible);
  const recommended=feasible.reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const provisional=candidates.filter(c=>c.packagingPass&&c.strengthPass&&c.stiffnessPass!==false)
    .reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const overall=recommended?verifiedThickness&&modulusReady&&deflectionLimit!==null?'PASS':'CONDITIONALLY FEASIBLE':
    buildInputsReady&&verifiedThickness?'STRUCTURAL REDESIGN REQUIRED':'INSUFFICIENT DATA';
  return {designLoad,availableRootMm,rootMaxThicknessMm,verifiedThickness,buildInputsReady,
    candidates,recommended,provisional,overall,span};
};
