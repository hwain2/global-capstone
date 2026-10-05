window.AST = window.AST || {};

AST.editorSections = [
  ['기체', [['aircraft.mass','계산질량 MTOW','kg'],['aircraft.nLimit','제한 하중계수','1'],['aircraft.fs','안전계수','1'],['aircraft.g','중력가속도','m/s²']]],
  ['날개', [['wing.area','날개 면적 S','m²'],['wing.span','날개폭 b (AR 대신)','m'],['wing.ar','AR (날개폭 대신)','1'],['wing.taper','테이퍼비','1'],['wing.rootChord','익근 시위 (익단과 함께)','m'],['wing.tipChord','익단 시위 (익근과 함께)','m'],['wing.sweep','앞전 후퇴각','deg'],['wing.tc','최대 두께비','1']]],
  ['추진·배터리', [['propulsion.prop_count','프로펠러 수','count'],['battery.series_count','배터리 직렬 수','S'],['battery.capacity_Ah','배터리 용량','Ah'],['battery.battery_mass_kg','배터리 질량','kg']]],
  ['비행 조건', [['flight.speed','순항속도','m/s'],['flight.rho','공기밀도','kg/m³'],['flight.cruiseCL','순항 CL','1'],['flight.ld','순항 L/D','1'],['flight.gustSpeed','돌풍속도','m/s'],['flight.liftSlope','양력곡선기울기','1/rad'],['flight.muG','돌풍 질량비','1']]],
  ['동체', [['fuselage.length','동체 길이','m'],['fuselage.width','동체 폭','m'],['fuselage.height','동체 높이','m'],['fuselage.wettedArea','젖은 면적','m²'],['fuselage.lt','Raymer Lt','m']]],
  ['구조 가정', [['structural_inputs.material.density','재료 밀도','kg/m³'],['structural_inputs.material.capStress','캡 허용응력','MPa'],['structural_inputs.material.webStress','웹 허용전단응력','MPa'],['structural_inputs.material.elasticModulusGPa','스파 탄성계수 E','GPa'],['structural_inputs.sparDesign.depthFactor','스파 깊이 활용률','1'],['structural_inputs.sparDesign.sparXc','스파 위치 x/c','1'],['structural_inputs.sparDesign.capWidthRatio','최소 캡 폭/시위','1'],['structural_inputs.sparDesign.manufacturingMinCapMm','최소 캡 두께','mm'],['structural_inputs.sparDesign.manufacturingMinWebMm','최소 웹 두께','mm'],['structural_inputs.landing.drop','착륙 낙하 높이','m'],['structural_inputs.landing.stop','착륙 정지 거리','m']]],
  ['판정·중량 예산', [['structural_inputs.feasibility.mtowLimit','MTOW 상한','kg'],['structural_inputs.feasibility.designTarget','설계중량 목표','kg'],['structural_inputs.feasibility.tipDeflectionLimitMm','허용 날개끝 처짐','mm'],['structural_inputs.feasibility.stallSpeedLimit','실속속도 상한','m/s'],
    ...Object.entries(AST.budgetLabels).filter(([key])=>key!=='battery').map(([key,label])=>['weight_budget.'+key,label,'kg'])]]
];

AST.editorGet = (obj,path) => path.split('.').reduce((value,key)=>value?.[key],obj);
AST.editorSet = function(obj,path,value){
  const keys=path.split('.');let node=obj;
  for(const key of keys.slice(0,-1))node=node[key]??=( {} );
  if(value===undefined)delete node[keys.at(-1)];
  else node[keys.at(-1)]=value;
};
AST.editorEmpty = function(){
  return {id:'',school:'',concept_name:'',configuration:'',revision:0,active:true,
    aircraft:{},wing:{},fuselage:{},flight:{},propulsion:{},battery:{},weight_budget:{},
    structural_inputs:{landing:{},material:{},sparDesign:{},feasibility:{},design:{}},
    source:'',notes:'',created_by:'',updated_by:'',created_at:'',updated_at:''};
};
AST.editorFieldHTML = function([path,label,unit],draft){
  const field=AST.editorGet(draft,path),v=field?.value;
  const value=v===null||v===undefined?'':v;
  const source=field?.source_type || (v===null?'TBD':'ASSUMED');
  const required=path==='battery.battery_mass_kg'?' title="미확정이면 빈칸과 TBD 유지"':'';
  return `<div class="baseline-edit-field"><label>${AST.escape(label)} <small>${AST.escape(unit)}</small><input type="number" step="any" data-editor-value="${path}" value="${AST.escape(value)}"${required}></label><select data-editor-source="${path}" aria-label="${AST.escape(label)} 출처">${AST.baselineSourceTypes.map(kind=>`<option value="${kind}" ${source===kind?'selected':''}>${kind}</option>`).join('')}</select><input type="text" data-editor-note="${path}" aria-label="${AST.escape(label)} 출처 메모" placeholder="출처 메모" value="${AST.escape(field?.source_note||'')}"></div>`;
};
AST.openBaselineEditor = function(kind){
  let draft;
  if(kind==='edit' && AST.activeBaseline)draft=AST.clone(AST.activeBaseline);
  else if(kind==='duplicate' && AST.activeBaseline)draft=AST.duplicateBaselineData(AST.activeBaseline);
  else draft=AST.editorEmpty();
  AST.editorDraft=draft;
  AST.editorKind=kind;
  const esc=AST.escape;
  document.getElementById('baselineDialogTitle').textContent=kind==='edit'?'Baseline 수정':kind==='duplicate'?'Baseline 복제':'새 Baseline';
  document.getElementById('baselineFormFields').innerHTML=`<div class="baseline-meta-grid">
    <label>ID<input name="id" value="${esc(draft.id)}" ${kind==='edit'?'readonly':''} required pattern="[a-z0-9][a-z0-9_-]{1,63}"></label>
    <label>School<input name="school" value="${esc(draft.school)}" required></label>
    <label>Concept<input name="concept_name" value="${esc(draft.concept_name)}" required></label>
    <label>Configuration<input name="configuration" value="${esc(draft.configuration)}" required></label>
    <label>Source<input name="source" value="${esc(draft.source||'')}"></label>
    <label>Editor Name<input name="editor" value="${esc(sessionStorage.getItem('astEditorName')||'')}" required></label>
    <label>변경 사유<input name="change_note" value="" placeholder="자료 수정 근거"></label>
    <label class="baseline-active"><input type="checkbox" name="active" ${draft.active!==false?'checked':''}> 공개 Baseline 활성</label>
  </div>${AST.editorSections.map(([title,fields],index)=>`<details class="baseline-editor-group" ${index<3?'open':''}><summary>${esc(title)}</summary><div>${fields.map(item=>AST.editorFieldHTML(item,draft)).join('')}</div></details>`).join('')}
    <label class="baseline-long-note">Concept 메모<textarea name="notes">${esc(draft.notes||'')}</textarea></label>`;
  document.getElementById('baselineConflict').hidden=true;
  document.getElementById('baselineWarnings').textContent='';
  document.getElementById('baselineDialog').showModal();
};

AST.collectBaselineEditor = function(){
  const form=document.getElementById('baselineForm'),draft=AST.clone(AST.editorDraft);
  for(const key of ['id','school','concept_name','configuration','source','notes'])draft[key]=form.elements[key].value.trim();
  draft.active=form.elements.active.checked;
  for(const section of AST.editorSections)for(const [path,,unit] of section[1]){
    const input=form.querySelector(`[data-editor-value="${path}"]`);
    const source=form.querySelector(`[data-editor-source="${path}"]`).value;
    const note=form.querySelector(`[data-editor-note="${path}"]`).value.trim();
    if(input.value.trim()===''){
      AST.editorSet(draft,path,path==='battery.battery_mass_kg'?
        {value:null,unit,source_type:'TBD',source_note:note||'Battery mass not confirmed'}:undefined);
    }else{
      const n=Number(input.value);
      AST.editorSet(draft,path,{value:n,unit,source_type:source==='TBD'?'ASSUMED':source,source_note:note});
    }
  }
  if(AST.editorGet(draft,'wing.ar') && AST.editorGet(draft,'wing.span')){
    const ar=AST.editorGet(draft,'wing.ar').value,span=AST.editorGet(draft,'wing.span').value;
    const area=AST.editorGet(draft,'wing.area')?.value;
    if(area&&Math.abs(span*span/area-ar)/ar<.02)AST.editorSet(draft,'wing.span',undefined);
  }
  return draft;
};

AST.editorApi = async function(url,options={}){
  const response=await fetch(url,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(typeof body.detail==='string'?body.detail:body.detail?.message||`HTTP ${response.status}`);error.body=body;error.status=response.status;throw error;}
  return body;
};

AST.saveBaselineEditor = async function(event){
  event.preventDefault();
  const form=document.getElementById('baselineForm'),editor=form.elements.editor.value.trim();
  sessionStorage.setItem('astEditorName',editor);
  const draft=AST.collectBaselineEditor(),note=form.elements.change_note.value.trim();
  const warning=document.getElementById('baselineWarnings');
  warning.textContent='검사 중…';
  try{
    const check=await AST.editorApi('api/baselines/validate',{method:'POST',body:JSON.stringify(draft)});
    if(check.errors.length){warning.textContent=check.errors.join(' · ');return;}
    warning.textContent=check.warnings.join(' · ');
    const existing=AST.editorKind==='edit';
    const result=await AST.editorApi(existing?'api/baselines/'+encodeURIComponent(draft.id):'api/baselines',
      {method:existing?'PUT':'POST',body:JSON.stringify({baseline:draft,editor,note})});
    document.getElementById('baselineDialog').close();
    await AST.fetchBaselines();
    AST.setActiveBaseline(result.baseline);
    document.getElementById('presetStatus').textContent=`r${result.baseline.revision} 저장 · Local Git ${result.commit_status}`+
      (result.warnings.length?' · '+result.warnings.join(' · '):'');
  }catch(error){
    if(error.status===409 && error.body.detail?.latest){
      const latest=error.body.detail.latest;
      const fields=AST.editorSections.flatMap(section=>section[1]);
      const differing=fields.filter(([path])=>JSON.stringify(AST.editorGet(latest,path))!==JSON.stringify(AST.editorGet(draft,path)));
      const conflict=document.getElementById('baselineConflict');
      conflict.hidden=false;
      conflict.innerHTML='<strong>다른 팀원이 먼저 수정했습니다. 덮어쓰지 않았습니다.</strong><p>최신 revision '+latest.revision+
        '과 내 입력을 비교한 뒤 다시 수정하세요.</p><ul>'+differing.slice(0,20).map(([path,label])=>
        `<li>${AST.escape(label)}: 최신 ${AST.escape(AST.editorGet(latest,path)?.value??'TBD')} / 내 입력 ${AST.escape(AST.editorGet(draft,path)?.value??'TBD')}</li>`).join('')+
        '</ul><button id="baselineLoadLatest" type="button">최신값 불러오기</button>';
      document.getElementById('baselineLoadLatest').onclick=()=>{document.getElementById('baselineDialog').close();AST.activeBaseline=latest;AST.openBaselineEditor('edit');};
    }else warning.textContent='저장 실패: '+error.message;
  }
};

AST.showBaselineHistory = async function(){
  if(!AST.activeBaseline)return;
  const rows=await AST.editorApi('api/baselines/'+encodeURIComponent(AST.activeBaseline.id)+'/history');
  document.getElementById('baselineHistoryRows').innerHTML=rows.length?rows.slice(0,100).map(row=>
    `<div class="baseline-history-row"><strong>r${row.revision} · ${AST.escape(row.field)}</strong><span>${AST.escape(row.previous_value)} → ${AST.escape(row.new_value)}</span><small>${AST.escape(row.editor)} · ${AST.escape(row.timestamp)} · ${AST.escape(row.note)}</small></div>`).join(''):'변경 이력이 없습니다.';
  document.getElementById('baselineHistoryDialog').showModal();
};

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('baselineNew').onclick=()=>AST.openBaselineEditor('new');
  document.getElementById('baselineEdit').onclick=()=>AST.openBaselineEditor('edit');
  document.getElementById('baselineDuplicate').onclick=()=>AST.openBaselineEditor('duplicate');
  document.getElementById('baselineClose').onclick=()=>document.getElementById('baselineDialog').close();
  document.getElementById('baselineCancel').onclick=()=>document.getElementById('baselineDialog').close();
  document.getElementById('baselineForm').addEventListener('submit',AST.saveBaselineEditor);
  document.getElementById('baselineHistory').onclick=()=>AST.showBaselineHistory().catch(error=>{document.getElementById('presetStatus').textContent='이력 조회 실패: '+error.message;});
  document.getElementById('baselineHistoryClose').onclick=()=>document.getElementById('baselineHistoryDialog').close();
  document.getElementById('baselineDeactivate').onclick=async()=>{
    if(!AST.activeBaseline)return;
    const editor=sessionStorage.getItem('astEditorName')||prompt('Editor Name');
    if(!editor)return;
    sessionStorage.setItem('astEditorName',editor);
    const draft=AST.clone(AST.activeBaseline);draft.active=draft.active===false;
    try{const result=await AST.editorApi('api/baselines/'+encodeURIComponent(draft.id),
      {method:'PUT',body:JSON.stringify({baseline:draft,editor,note:draft.active?'Reactivate':'Deactivate'})});
      await AST.fetchBaselines();AST.setActiveBaseline(result.baseline);
      document.getElementById('presetStatus').textContent=draft.active?'Baseline 재활성화':'Baseline 비활성화';
    }catch(error){document.getElementById('presetStatus').textContent='변경 실패: '+error.message;}
  };
  document.getElementById('baselineSync').onclick=async()=>{
    const status=document.getElementById('presetStatus');status.textContent='GitHub 동기화 중…';
    try{const result=await AST.editorApi('api/sync',{method:'POST',body:'{}'});status.textContent=`GitHub ${result.branch} 동기화 완료`;
    }catch(error){status.textContent='동기화 실패 · 로컬 데이터 유지: '+error.message;}
  };
});
