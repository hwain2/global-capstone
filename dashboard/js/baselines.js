window.AST = window.AST || {};

AST.baselineGroups = Object.freeze({
  aircraft: 'aircraft', wing: 'wing', fuselage: 'fuselage', flight: 'flight',
  propulsion: 'propulsion', battery: 'battery', weight_budget: 'weightBudget'
});
AST.baselineStructuralGroups = Object.freeze({
  landing: 'landing', material: 'material', sparDesign: 'sparDesign',
  feasibility: 'feasibility', design: 'design'
});
AST.baselineSourceTypes = ['BASELINE','INHA','KAU','ERAU','REQ','STRUCT','ASSUMED','TBD','CALC'];
AST.baselines = [];
AST.activeBaseline = null;
AST.editorMode = false;

AST.baselineValue = field => field && typeof field === 'object' &&
  Object.prototype.hasOwnProperty.call(field,'value') ? field.value : undefined;

AST.baselineToState = function (baseline) {
  const state=AST.clone(AST.defaults),locked=[];
  const apply=(group,target)=>{
    for(const [key,field] of Object.entries(group||{})){
      if(!(key in state[target]))continue;
      const value=AST.baselineValue(field);
      if(value===undefined)continue;
      state[target][key]=value;
      const path=target+'.'+key;
      if(field.source_type)state.sources[path]=field.source_type;
      state.sourceNotes[path]=field.source_note||'';
      locked.push(path);
    }
  };
  for(const [name,target] of Object.entries(AST.baselineGroups))apply(baseline[name],target);
  for(const [name,target] of Object.entries(AST.baselineStructuralGroups))
    apply(baseline.structural_inputs?.[name],target);
  if(AST.baselineValue(baseline.wing?.span)!=null){state.wing.autoAR=true;locked.push('wing.autoAR');}
  else if(AST.baselineValue(baseline.wing?.ar)!=null){state.wing.autoAR=false;locked.push('wing.autoAR');}
  if(AST.baselineValue(baseline.wing?.rootChord)!==undefined &&
     AST.baselineValue(baseline.wing?.tipChord)!==undefined){state.wing.autoChords=false;locked.push('wing.autoChords');}
  const batteryMass=AST.baselineValue(baseline.battery?.battery_mass_kg);
  if(batteryMass!==undefined){
    state.weightBudget.battery=batteryMass;
    state.sources['weightBudget.battery']=baseline.battery.battery_mass_kg.source_type||'TBD';
    state.sourceNotes['weightBudget.battery']=baseline.battery.battery_mass_kg.source_note||'';
    locked.push('weightBudget.battery');
  }
  state.presetLocked=true;
  state.activeBaselineId=baseline.id;
  state.baselineReference={id:baseline.id,school:baseline.school,concept_name:baseline.concept_name,
    configuration:baseline.configuration,revision:baseline.revision,source:baseline.source||''};
  for(const key of ['area','span','ar','taper','rootChord','tipChord']){
    const value=AST.baselineValue(baseline.wing?.[key]);
    if(Number.isFinite(value))state.reportedGeometry[key]=value;
  }
  return {state:AST.synchronize(state),lockedPaths:locked};
};

AST.setActiveBaseline = function(baseline){
  const loaded=AST.baselineToState(baseline);
  AST.activeBaseline=AST.clone(baseline);
  AST.baselineLockedPaths=loaded.lockedPaths;
  AST.state=loaded.state;
  AST.selectedCandidateIndex=undefined;
  AST.customRangeMode=false;
  AST.buildInputs();
  AST.render();
  AST.renderBaselineBar();
};

AST.baselineLabel = b => `${b.school} ${b.concept_name}`;
// Battery mass lives only in weightBudget in the working calculation copy.
// Metadata, exports and all calculations read that same copy.
AST.batteryInfo = state => [
  ['series_count','배터리 직렬 수','S','battery.series_count'],
  ['capacity_Ah','배터리 용량','Ah','battery.capacity_Ah'],
  ['battery_mass_kg','배터리 질량','kg','weightBudget.battery']
].map(([key,label,unit,path])=>({key,label,unit,value:AST.get(state,path),
  source_type:AST.get(state,path)==null?'TBD':state.sources[path]||'ASSUMED',source_note:state.sourceNotes?.[path]||''}));
AST.duplicateBaselineData = function(base){
  const draft=AST.clone(base),original=`${base.id} r${base.revision}`;
  draft.id='';draft.concept_name='';draft.configuration='';draft.revision=0;
  draft.inherited_from=original;
  const walk=node=>{for(const field of Object.values(node||{})){
    if(!field||typeof field!=='object')continue;
    if(Object.prototype.hasOwnProperty.call(field,'value')){
      field.source_note=`Inherited from ${original}; verify for this concept. ${field.source_note||''}`;
      if(!['TBD','CALC'].includes(field.source_type))field.source_type='ASSUMED';
    }else walk(field);
  }};
  for(const key of ['aircraft','wing','fuselage','flight','propulsion','battery','weight_budget','structural_inputs'])walk(draft[key]);
  return draft;
};
AST.renderBaselineBar = function(){
  const select=document.getElementById('baselineSelect');
  if(!select)return;
  select.innerHTML='<option value="">새 계산</option>'+AST.baselines.map(b=>
    `<option value="${AST.escape(b.id)}">${AST.escape(AST.baselineLabel(b))} · r${b.revision}${b.active===false?' · 비활성':''}</option>`).join('');
  select.value=AST.activeBaseline?.id||'';
  const [series,capacity,mass]=AST.batteryInfo(AST.state);
  const reference=AST.state.baselineReference;
  document.getElementById('baselineMeta').textContent=reference||series.value!=null||capacity.value!=null?
    `${series.value??'—'}S ${capacity.value??'—'} Ah · 배터리 질량 ${mass.value==null?'TBD':mass.value+' kg'} · ${reference?.configuration||''}`:'';
  document.getElementById('baselineEditorActions').hidden=!AST.editorMode;
  document.getElementById('baselineEdit').disabled=!AST.activeBaseline;
  document.getElementById('baselineDuplicate').disabled=!AST.activeBaseline;
  document.getElementById('baselineHistory').disabled=!AST.activeBaseline;
  document.getElementById('baselineDeactivate').disabled=!AST.activeBaseline;
  document.getElementById('baselineDeactivate').textContent=AST.activeBaseline?.active===false?'재활성화':'비활성화';
};

AST.fetchBaselines = async function(){
  const configResponse=await fetch('api/config',{cache:'no-store'}).catch(()=>null);
  AST.editorMode=!!configResponse?.ok && (await configResponse.json()).mode==='EDITOR_MODE';
  if(AST.editorMode){
    const response=await fetch('api/baselines',{cache:'no-store'});
    if(!response.ok)throw Error('서버 Baseline 목록을 읽지 못했습니다.');
    AST.baselines=await response.json();
  }else{
    const response=await fetch('data/baselines/manifest.json',{cache:'no-store'});
    if(!response.ok)throw Error('Baseline 목록을 읽지 못했습니다.');
    const manifest=await response.json();
    AST.baselines=await Promise.all(manifest.baselines.map(async name=>{
      const item=await fetch('data/baselines/'+encodeURIComponent(name),{cache:'no-store'});
      if(!item.ok)throw Error(name+'을 읽지 못했습니다.');
      return item.json();
    }));
  }
  AST.baselines.sort((a,b)=>AST.baselineLabel(a).localeCompare(AST.baselineLabel(b)));
  AST.renderBaselineBar();
};
