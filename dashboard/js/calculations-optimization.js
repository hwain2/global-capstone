window.AST = window.AST || {};
AST.uniformBeamTipDeflectionMm = (halfLoadN,lengthM,elasticModulusGPa,inertiaMm4) =>
  halfLoadN*lengthM**3/(8*elasticModulusGPa*1e9*inertiaMm4*1e-12)*1000;
// Root-section sizing uses the same M/(sigma*h) and V/(tau*h) equations as AST.spar.
// The airfoil proxy can be replaced by measured coordinates without changing candidate sizing.
AST.optimizeSpar = function(s, loads) {
  const w=s.wing,d=s.sparDesign,mat=s.material,half=w.span/2;
  const designLoad=Math.max(loads.ultimate,loads.gustUltimate,
    s.design.source==='custom' ? s.design.customLoad : 0);
  const span=AST.spanLoads(designLoad,w.span,121);
  const rootMaxThicknessMm=w.rootChord*w.tc*1000;
  const thicknessAt=y=>{
    const chord=w.rootChord+(w.tipChord-w.rootChord)*y/half;
    return {chordMm:chord*1000,thicknessMm:AST.sparThicknessAt(s,chord)};
  };
  const availableRootMm=thicknessAt(0).thicknessMm*d.depthFactor;
  const capWidthAt=chordMm=>d.capWidthMm??chordMm*d.capWidthRatio;
  const buildInputsReady=(d.capWidthMm!==null||d.capWidthRatio!==null)&&d.manufacturingMinCapMm!==null&&d.manufacturingMinWebMm!==null;
  const verifiedThickness=d.localThicknessMm!==null&&d.localThicknessMm<=rootMaxThicknessMm;
  const modulusReady=mat.elasticModulusGPa!==null;
  const deflectionLimit=s.feasibility.tipDeflectionLimitMm;
  const uniformLimitLoadNPerM=s.aircraft.nLimit*loads.weight/(2*half);
  const count=19,candidates=[];
  for(let i=0;i<count;i++){
    const fraction=0.5+0.45*i/(count-1),depthMm=fraction*availableRootMm;
    let upper=0,lower=0,web=0,theoreticalUpper=0,theoreticalWeb=0,deflection=0;
    let packaging=true,minCapMS=Infinity,minWebMS=Infinity,maxCapStress=0,maxWebShear=0,maxCapThickness=0,maxWebThickness=0;
    let rootCapArea=0,rootWebThickness=0,rootCapThickness=null,rootSelectedWeb=null,capScale=1;
    const segments=[];
    for(let j=0;j<span.length-1;j++){
      const a=span[j],b=span[j+1],y=(a.y+b.y)/2,dy=b.y-a.y;
      const M=(a.moment+b.moment)/2,V=(a.shear+b.shear)/2;
      const {chordMm,thicknessMm}=thicknessAt(y);
      const capWidthMm=capWidthAt(chordMm);
      const available=thicknessMm*d.depthFactor;
      const h=depthMm*thicknessMm/thicknessAt(0).thicknessMm;
      const capRequired=Math.abs(M)*1000/(mat.capStress*h);
      const webRequired=Math.abs(V)/(mat.webStress*h);
      const selectedCapThickness=buildInputsReady?Math.max(capRequired/capWidthMm,d.manufacturingMinCapMm):null;
      const selectedCapArea=buildInputsReady?selectedCapThickness*capWidthMm:capRequired;
      const selectedWeb=buildInputsReady?Math.max(webRequired,d.manufacturingMinWebMm):webRequired;
      segments.push({y,dy,M,V,chordMm,available,h,capWidthMm,capRequired,selectedCapThickness,selectedWeb});
      theoreticalUpper+=capRequired*1e-6*dy*mat.density;
      theoreticalWeb+=webRequired*h*1e-6*dy*mat.density;
      upper+=selectedCapArea*1e-6*dy*mat.density;
      lower+=selectedCapArea*1e-6*dy*mat.density;
      web+=selectedWeb*h*1e-6*dy*mat.density;
      // h is the cap-centroid spacing used by the existing bending equation.
      // Two cap laminates add one cap thickness to the outside-to-outside depth.
      if(h>available+1e-8||buildInputsReady&&(capWidthMm>chordMm||
          h+selectedCapThickness>available+1e-8||selectedCapThickness>=h||selectedWeb>capWidthMm))packaging=false;
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
        const limitMoment=uniformLimitLoadNPerM*(half-y)**2/2;
        deflection+=limitMoment*(half-y)/(mat.elasticModulusGPa*1e9*I*1e-12)*dy*1000;
      }
    }
    if(buildInputsReady&&modulusReady&&deflectionLimit!==null&&packaging&&deflection>deflectionLimit){
      const evaluateScale=scale=>{
        let up=0,lo=0,wb=0,bend=0,fit=true,minCap=Infinity,maxCap=0,thick=0;
        for(const p of segments){
          const capThickness=p.selectedCapThickness*scale,capArea=capThickness*p.capWidthMm;
          up+=capArea*1e-6*p.dy*mat.density;
          lo+=capArea*1e-6*p.dy*mat.density;
          wb+=p.selectedWeb*p.h*1e-6*p.dy*mat.density;
          if(p.h+capThickness>p.available+1e-8||capThickness>=p.h)fit=false;
          const stress=Math.abs(p.M)*1000/(capArea*p.h);
          minCap=Math.min(minCap,stress>0?mat.capStress/stress-1:Infinity);
          maxCap=Math.max(maxCap,stress);
          thick=Math.max(thick,capThickness);
          const I=2*capArea*(p.h/2)**2+p.selectedWeb*p.h**3/12;
          const limitMoment=uniformLimitLoadNPerM*(half-p.y)**2/2;
          bend+=limitMoment*(half-p.y)/(mat.elasticModulusGPa*1e9*I*1e-12)*p.dy*1000;
        }
        return {up,lo,wb,bend,fit,minCap,maxCap,thick};
      };
      const maxScale=Math.min(...segments.map(p=>Math.min(
        (p.available-p.h)/p.selectedCapThickness,p.h/p.selectedCapThickness)))*0.999999;
      if(maxScale>1){
        const maximum=evaluateScale(maxScale);
        if(maximum.fit&&maximum.bend<=deflectionLimit){
          let lo=1,hi=maxScale;
          for(let k=0;k<35;k++){
            const mid=(lo+hi)/2;
            if(evaluateScale(mid).bend<=deflectionLimit)hi=mid;else lo=mid;
          }
          capScale=hi;
          const sized=evaluateScale(capScale);
          upper=sized.up;lower=sized.lo;web=sized.wb;deflection=sized.bend;
          packaging=sized.fit;minCapMS=sized.minCap;maxCapStress=sized.maxCap;
          maxCapThickness=sized.thick;
        }
      }
    }
    const rootM=Math.abs(span[0].moment),rootV=Math.abs(span[0].shear);
    rootCapArea=rootM*1000/(mat.capStress*depthMm);
    rootWebThickness=rootV/(mat.webStress*depthMm);
    rootCapThickness=buildInputsReady?Math.max(rootCapArea/capWidthAt(w.rootChord*1000),d.manufacturingMinCapMm)*capScale:null;
    rootSelectedWeb=buildInputsReady?Math.max(rootWebThickness,d.manufacturingMinWebMm):rootWebThickness;
    const massKg=2*(upper+lower+web),theoreticalMassKg=2*(2*theoreticalUpper+theoreticalWeb);
    const predictedDeflectionMm=modulusReady?deflection:null;
    const strengthPass=minCapMS>=-1e-9&&minWebMS>=-1e-9;
    if(Math.abs(minCapMS)<1e-9)minCapMS=0;
    if(Math.abs(minWebMS)<1e-9)minWebMS=0;
    const stiffnessPass=predictedDeflectionMm===null||deflectionLimit===null?null:predictedDeflectionMm<=deflectionLimit+1e-6;
    const eligible=packaging&&strengthPass&&buildInputsReady&&stiffnessPass!==false;
    candidates.push({index:i,fraction,depthMm,availableRootMm,rootCapAreaMm2:rootCapArea,
      rootWebThicknessMm:rootWebThickness,rootCapThicknessMm:rootCapThickness,
      rootSelectedWebThicknessMm:rootSelectedWeb,upperCapMassKg:2*upper,lowerCapMassKg:2*lower,
      webMassKg:2*web,massKg,theoreticalMassKg,predictedDeflectionMm,capScale,
      capMargin:minCapMS,webMargin:minWebMS,strengthMargin:Math.min(minCapMS,minWebMS),
      capStressMpa:maxCapStress,webShearMpa:maxWebShear,
      packagingPass:packaging,packagingStatus:packaging?'PASS':'FAIL',
      strengthPass,stiffnessPass,manufacturingStatus:buildInputsReady?'PASS':'TBD',
      maxCapThicknessMm:buildInputsReady?maxCapThickness:null,maxWebThicknessMm:maxWebThickness,
      eligible});
  }
  const feasible=candidates.filter(c=>c.eligible);
  const recommended=feasible.reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const provisional=candidates.filter(c=>c.packagingPass&&c.strengthPass)
    .reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const overall=recommended?verifiedThickness&&modulusReady&&deflectionLimit!==null?'PASS':'CONDITIONALLY FEASIBLE':
    buildInputsReady?'STRUCTURAL REDESIGN REQUIRED':'INSUFFICIENT DATA';
  return {designLoad,deflectionLoad:s.aircraft.nLimit*loads.weight,
    availableRootMm,rootMaxThicknessMm,verifiedThickness,buildInputsReady,
    rootCapWidthMm:capWidthAt(w.rootChord*1000),thicknessBasis:verifiedThickness?'INPUT':'NACA4_ASSUMED',
    candidates,recommended,provisional,overall,span};
};
