window.AST = window.AST || {};
AST.uniformBeamTipDeflectionMm = (halfLoadN,lengthM,elasticModulusGPa,inertiaMm4) =>
  halfLoadN*lengthM**3/(8*elasticModulusGPa*1e9*inertiaMm4*1e-12)*1000;
// Root-section sizing uses the same M/(sigma*h) and V/(tau*h) equations as AST.spar.
// Minimum thickness across the full cap footprint is a conservative NACA4 proxy.
// Replace this helper with sampled airfoil coordinates when they become available.
AST.capFootprintDepthMm = function(s, chordMm, capWidthMm, centerThicknessMm) {
  const center=s.sparDesign.sparXc,halfWidth=capWidthMm/(2*chordMm);
  if(!Number.isFinite(halfWidth)||center-halfWidth<=0||center+halfWidth>=1)return 0;
  const centerFactor=AST.naca4ThicknessFactor(center);
  let minimum=Infinity;
  for(let i=0;i<=12;i++){
    const xc=center-halfWidth+2*halfWidth*i/12;
    minimum=Math.min(minimum,AST.naca4ThicknessFactor(xc));
  }
  return centerThicknessMm*s.sparDesign.depthFactor*minimum/centerFactor;
};
// Size one spanwise cap-width family before selecting the lightest width/depth pair.
AST.sizeSparAtWidth = function(s, loads, widthRatio) {
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
  const capWidthAt=chordMm=>d.capWidthMm??chordMm*widthRatio;
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
      const footprintAvailable=AST.capFootprintDepthMm(s,chordMm,capWidthMm,thicknessMm);
      const h=depthMm*thicknessMm/thicknessAt(0).thicknessMm;
      const capRequired=Math.abs(M)*1000/(mat.capStress*h);
      const webRequired=Math.abs(V)/(mat.webStress*h);
      const selectedCapThickness=buildInputsReady?Math.max(capRequired/capWidthMm,d.manufacturingMinCapMm):null;
      const selectedCapArea=buildInputsReady?selectedCapThickness*capWidthMm:capRequired;
      const selectedWeb=buildInputsReady?Math.max(webRequired,d.manufacturingMinWebMm):webRequired;
      segments.push({y,dy,M,V,chordMm,available,footprintAvailable,h,capWidthMm,capRequired,selectedCapThickness,selectedWeb});
      theoreticalUpper+=capRequired*1e-6*dy*mat.density;
      theoreticalWeb+=webRequired*h*1e-6*dy*mat.density;
      upper+=selectedCapArea*1e-6*dy*mat.density;
      lower+=selectedCapArea*1e-6*dy*mat.density;
      web+=selectedWeb*h*1e-6*dy*mat.density;
      // h is the cap-centroid spacing used by the existing bending equation.
      // Two cap laminates add one cap thickness to the outside-to-outside depth.
      if(h>available+1e-8||buildInputsReady&&(footprintAvailable<=0||
          h+selectedCapThickness>footprintAvailable+1e-8||selectedCapThickness>=h||selectedWeb>capWidthMm))packaging=false;
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
    // Find the stiffness-required cap within this preliminary family: every
    // spanwise cap grows by the same factor from its strength/manufacturing minimum.
    // Keep an oversized result as a diagnostic; packaging is checked afterward.
    const strengthOnlyDeflectionMm=modulusReady?deflection:null;
    if(buildInputsReady&&modulusReady&&deflectionLimit!==null&&deflection>deflectionLimit){
      const evaluateScale=scale=>{
        let up=0,lo=0,wb=0,bend=0,fit=true,minCap=Infinity,maxCap=0,thick=0;
        for(const p of segments){
          const capThickness=p.selectedCapThickness*scale,capArea=capThickness*p.capWidthMm;
          up+=capArea*1e-6*p.dy*mat.density;
          lo+=capArea*1e-6*p.dy*mat.density;
          wb+=p.selectedWeb*p.h*1e-6*p.dy*mat.density;
          if(p.h+capThickness>p.footprintAvailable+1e-8||capThickness>=p.h)fit=false;
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
      let lo=1,hi=2;
      while(evaluateScale(hi).bend>deflectionLimit&&hi<1048576)hi*=2;
      if(evaluateScale(hi).bend<=deflectionLimit){
        for(let k=0;k<40;k++){
          const mid=(lo+hi)/2;
          if(evaluateScale(mid).bend<=deflectionLimit)hi=mid;else lo=mid;
        }
        capScale=hi;
        const sized=evaluateScale(capScale);
        upper=sized.up;lower=sized.lo;web=sized.wb;deflection=sized.bend;
        packaging=packaging&&sized.fit;minCapMS=sized.minCap;maxCapStress=sized.maxCap;
        maxCapThickness=sized.thick;
      }
    }
    const rootM=Math.abs(span[0].moment),rootV=Math.abs(span[0].shear);
    rootCapArea=rootM*1000/(mat.capStress*depthMm);
    rootWebThickness=rootV/(mat.webStress*depthMm);
    rootCapThickness=buildInputsReady?Math.max(rootCapArea/capWidthAt(w.rootChord*1000),d.manufacturingMinCapMm)*capScale:null;
    const rootSelectedCapArea=rootCapThickness===null?null:rootCapThickness*capWidthAt(w.rootChord*1000);
    const rootWebForEI=buildInputsReady?Math.max(rootWebThickness,d.manufacturingMinWebMm):rootWebThickness;
    const requiredEINm2=deflectionLimit===null?null:
      (uniformLimitLoadNPerM*half)*half**3/(8*deflectionLimit/1000);
    const rootAnalyticStiffnessCapArea=requiredEINm2===null||!modulusReady?null:
      Math.max(0,2*(requiredEINm2/(mat.elasticModulusGPa*1e9)*1e12-
        rootWebForEI*depthMm**3/12)/depthMm**2);
    const rootStiffnessCapArea=buildInputsReady&&modulusReady&&deflectionLimit!==null?
      (capScale>1?rootSelectedCapArea:Math.min(rootSelectedCapArea,rootAnalyticStiffnessCapArea)):null;
    rootSelectedWeb=buildInputsReady?Math.max(rootWebThickness,d.manufacturingMinWebMm):rootWebThickness;
    const massKg=2*(upper+lower+web),theoreticalMassKg=2*(2*theoreticalUpper+theoreticalWeb);
    const predictedDeflectionMm=modulusReady?deflection:null;
    const strengthPass=minCapMS>=-1e-9&&minWebMS>=-1e-9;
    if(Math.abs(minCapMS)<1e-9)minCapMS=0;
    if(Math.abs(minWebMS)<1e-9)minWebMS=0;
    const stiffnessPass=predictedDeflectionMm===null||deflectionLimit===null?null:predictedDeflectionMm<=deflectionLimit+1e-6;
    const eligible=packaging&&strengthPass&&buildInputsReady&&stiffnessPass===true;
    const packagingRatio=rootCapThickness===null?null:segments.reduce((worst,p)=>Math.max(worst,
      p.footprintAvailable>0?(p.h+p.selectedCapThickness*capScale)/p.footprintAvailable:Infinity),0);
    packaging=packaging&&packagingRatio!==null&&packagingRatio<=1+1e-8;
    const rootCapWidthMm=capWidthAt(w.rootChord*1000);
    const rootFootprintAvailableMm=AST.capFootprintDepthMm(s,w.rootChord*1000,rootCapWidthMm,thicknessAt(0).thicknessMm);
    candidates.push({index:i,fraction,depthMm,availableRootMm,rootCapAreaMm2:rootCapArea,
      rootCapWidthMm,rootFootprintAvailableMm,capWidthRatio:rootCapWidthMm/(w.rootChord*1000),
      rootStiffnessCapAreaMm2:rootStiffnessCapArea,rootSelectedCapAreaMm2:rootSelectedCapArea,
      rootAnalyticStiffnessCapAreaMm2:rootAnalyticStiffnessCapArea,requiredEINm2,
      rootWebThicknessMm:rootWebThickness,rootCapThicknessMm:rootCapThickness,
      rootSelectedWebThicknessMm:rootSelectedWeb,upperCapMassKg:2*upper,lowerCapMassKg:2*lower,
      webMassKg:2*web,massKg,theoreticalMassKg,predictedDeflectionMm,strengthOnlyDeflectionMm,capScale,packagingRatio,
      capMargin:minCapMS,webMargin:minWebMS,strengthMargin:Math.min(minCapMS,minWebMS),
      capStressMpa:maxCapStress,webShearMpa:maxWebShear,
      packagingPass:packaging,packagingStatus:packaging?'PASS':'FAIL',
      strengthPass,stiffnessPass,manufacturingStatus:buildInputsReady?'PASS':'TBD',
      maxCapThicknessMm:buildInputsReady?maxCapThickness:null,maxWebThicknessMm:maxWebThickness,
      eligible});
  }
  const feasible=candidates.filter(c=>c.eligible);
  const recommended=feasible.reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const provisional=candidates.filter(c=>c.strengthPass&&c.stiffnessPass===true)
    .reduce((best,c)=>!best||c.massKg<best.massKg?c:best,null);
  const empiricalWingMassKg=AST.weight(s).raymerWing;
  const comparison=recommended||provisional;
  const sparToWingRatio=comparison?comparison.massKg/empiricalWingMassKg:null;
  const overall=!buildInputsReady||!modulusReady||deflectionLimit===null?'INSUFFICIENT INPUT':
    recommended&&recommended.massKg<empiricalWingMassKg?
      'FEASIBLE BY EMPIRICAL MODEL':'NOT FEASIBLE BY EMPIRICAL MODEL';
  return {designLoad,deflectionLoad:s.aircraft.nLimit*loads.weight,
    availableRootMm,rootMaxThicknessMm,verifiedThickness,buildInputsReady,
    empiricalWingMassKg,sparToWingRatio,
    rootCapWidthMm:capWidthAt(w.rootChord*1000),thicknessBasis:verifiedThickness?'INPUT_AT_STATION_NACA_PROFILE':'NACA4_ASSUMED',
    candidates,recommended,provisional,overall,span};
};
AST.optimizeSpar = function(s,loads) {
  const d=s.sparDesign,xc=d.sparXc;
  const maximumRatio=Math.min(1,2*Math.min(xc,1-xc)*.98);
  const minimumRatio=d.capWidthRatio;
  const widthRatios=d.capWidthMm!==null||minimumRatio>=maximumRatio?[minimumRatio]:
    Array.from({length:21},(_,i)=>minimumRatio+(maximumRatio-minimumRatio)*i/20);
  const studies=widthRatios.map(ratio=>AST.sizeSparAtWidth(s,loads,ratio));
  let selectedStudy=null,recommended=null,provisional=null;
  for(const study of studies){
    if(study.recommended&&(!recommended||study.recommended.massKg<recommended.massKg)){
      recommended=study.recommended;selectedStudy=study;
    }
  }
  if(!selectedStudy){
    for(const study of studies){
      for(const candidate of study.candidates){
        if(!candidate.strengthPass||candidate.stiffnessPass!==true)continue;
        if(!provisional||candidate.packagingRatio<provisional.packagingRatio-1e-9||
          Math.abs(candidate.packagingRatio-provisional.packagingRatio)<1e-9&&candidate.massKg<provisional.massKg){
          provisional=candidate;selectedStudy=study;
        }
      }
    }
  }
  selectedStudy=selectedStudy||studies[0];
  const empiricalWingMassKg=selectedStudy.empiricalWingMassKg;
  const comparison=recommended||provisional;
  return {...selectedStudy,recommended,provisional,
    rootCapWidthMm:comparison?.rootCapWidthMm??selectedStudy.rootCapWidthMm,
    rootFootprintAvailableMm:comparison?.rootFootprintAvailableMm??null,
    widthCandidateCount:studies.length,capWidthMode:d.capWidthMm===null?'AUTO':'FIXED',
    sparToWingRatio:comparison?comparison.massKg/empiricalWingMassKg:null,
    overall:!selectedStudy.buildInputsReady||s.material.elasticModulusGPa===null||s.feasibility.tipDeflectionLimitMm===null?
      'INSUFFICIENT INPUT':recommended&&recommended.massKg<empiricalWingMassKg?
      'FEASIBLE BY EMPIRICAL MODEL':'NOT FEASIBLE BY EMPIRICAL MODEL'};
};
