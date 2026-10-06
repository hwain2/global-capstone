window.AST = window.AST || {};

AST.editorSections = [
  ['기체', [['aircraft.mass','계산질량 MTOW','kg'],['aircraft.nLimit','제한 하중계수','1'],['aircraft.fs','안전계수','1'],['aircraft.g','중력가속도','m/s²']]],
  ['날개', [['wing.area','날개 면적 S','m²'],['wing.span','날개폭 b (AR 대신)','m'],['wing.ar','AR (날개폭 대신)','1'],['wing.taper','테이퍼비','1'],['wing.rootChord','익근 시위 (익단과 함께)','m'],['wing.tipChord','익단 시위 (익근과 함께)','m'],['wing.sweep','앞전 후퇴각','deg'],['wing.tc','최대 두께비','1']]],
  ['추진·배터리', [['propulsion.prop_count','프로펠러 수','count'],['battery.series_count','배터리 직렬 수','S'],['battery.capacity_Ah','배터리 용량','Ah'],['battery.battery_mass_kg','배터리 질량','kg']]],
  ['비행 조건', [['flight.speed','순항속도','m/s'],['flight.rho','공기밀도','kg/m³'],['flight.cruiseCL','순항 CL','1'],['flight.ld','순항 L/D','1'],['flight.gustSpeed','돌풍속도','m/s'],['flight.liftSlope','양력곡선기울기','1/rad'],['flight.muG','돌풍 질량비','1']]],
  ['동체', [['fuselage.length','동체 길이','m'],['fuselage.width','동체 폭','m'],['fuselage.height','동체 높이','m'],['fuselage.wettedArea','젖은 면적','m²'],['fuselage.lt','Raymer Lt','m']]],
  ['구조 가정', AST.fields.filter(group=>['재료·구조','스파 자동 탐색 · STRUCT','기존 스파 단면 비교 · STRUCT','고급 계수','착륙 조건'].includes(group.group))
    .flatMap(group=>group.items.map(([path,label,unit])=>['structural_inputs.'+path,label,unit]))],
  ['판정·중량 예산', [['structural_inputs.feasibility.mtowLimit','MTOW 상한','kg'],['structural_inputs.feasibility.designTarget','설계중량 목표','kg'],['structural_inputs.feasibility.tipDeflectionLimitMm','허용 날개끝 처짐','mm'],['structural_inputs.feasibility.stallSpeedLimit','실속속도 상한','m/s'],
    ['structural_inputs.feasibility.airfoilClMax','항공기 CLmax','1'],['structural_inputs.design.customLoad','사용자 지정 총양력','N'],
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
AST.openBaselineEditor = function(kind,draftOverride=null,baseOverride=null){
  if(!AST.editorMode)return;
  let draft;
  if(kind==='edit' && AST.activeBaseline)draft=AST.clone(AST.activeBaseline);
  else if(kind==='duplicate' && AST.activeBaseline)draft=AST.duplicateBaselineData(AST.activeBaseline);
  else draft=AST.editorEmpty();
  if(draftOverride)draft=AST.clone(draftOverride);
  AST.editorDraft=draft;
  AST.editorBase=AST.clone(baseOverride||draft);
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
    <label>스파 비교용 하중<select name="design_source">${['ultimate','gust','landing','custom'].map(value=>`<option value="${value}" ${AST.editorGet(draft,'structural_inputs.design.source')?.value===value?'selected':''}>${{ultimate:'극한 기동',gust:'극한 돌풍',landing:'착륙 · 별도 경로',custom:'사용자 지정'}[value]}</option>`).join('')}</select></label>
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
  const loadSource=form.elements.design_source.value;
  const previousLoad=AST.editorGet(draft,'structural_inputs.design.source');
  if(previousLoad?.value!==loadSource && (previousLoad||loadSource!=='ultimate'))
    AST.editorSet(draft,'structural_inputs.design.source',{value:loadSource,unit:'1',source_type:'STRUCT',source_note:'Comparison load selection; automatic sizing still includes governing maneuver/gust loads'});
  for(const section of AST.editorSections)for(const [path,,unit] of section[1]){
    const previous=AST.editorGet(draft,path);
    const input=form.querySelector(`[data-editor-value="${path}"]`);
    const source=form.querySelector(`[data-editor-source="${path}"]`).value;
    const note=form.querySelector(`[data-editor-note="${path}"]`).value.trim();
    if(input.value.trim()===''){
      if(previous?.value===null && previous.source_type==='TBD' && previous.source_note===note)continue;
      AST.editorSet(draft,path,path==='battery.battery_mass_kg'?
        {value:null,unit,source_type:'TBD',source_note:note||'Battery mass not confirmed'}:undefined);
    }else{
      const n=Number(input.value);
      if(previous?.value===n && previous.source_type===source && previous.source_note===note)continue;
      AST.editorSet(draft,path,{value:n,unit,source_type:source==='TBD'?'ASSUMED':source,source_note:note});
    }
  }
  return draft;
};

// Three-way comparison keeps edits on different fields and requires a choice
// when both editors changed the same descriptor (including its provenance).
AST.mergeBaselineChanges = function(base,submitted,latest){
  const merged=AST.clone(latest),conflicts=[];
  const paths=['school','concept_name','configuration','source','notes','active','structural_inputs.design.source',
    ...AST.editorSections.flatMap(section=>section[1].map(([path])=>path))];
  for(const path of paths){
    const before=AST.editorGet(base,path),mine=AST.editorGet(submitted,path),theirs=AST.editorGet(latest,path);
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(same(before,mine))continue;
    if(same(before,theirs)||same(mine,theirs))AST.editorSet(merged,path,mine===undefined?undefined:AST.clone(mine));
    else conflicts.push({path,mine,theirs});
  }
  return {merged,conflicts};
};
AST.showBaselineConflict = function(draft,latest){
  const result=AST.mergeBaselineChanges(AST.editorBase,draft,latest),esc=AST.escape;
  const conflict=document.getElementById('baselineConflict');
  // Resolve the displayed snapshot before allowing further form edits.
  document.getElementById('baselineFormFields').querySelectorAll('input,select,textarea').forEach(input=>{input.disabled=true;});
  const labels=Object.fromEntries(AST.editorSections.flatMap(section=>section[1].map(([path,label])=>[path,label])));
  const display=value=>value&&typeof value==='object'?`${value.value??'TBD'} ${value.unit} [${value.source_type}] ${value.source_note||''}`:value===undefined?'없음':String(value);
  conflict.hidden=false;
  conflict.innerHTML=`<strong>다른 팀원이 먼저 수정했습니다. 덮어쓰지 않았습니다.</strong><p>최신 r${latest.revision}을 기준으로 겹치지 않는 내 수정은 유지합니다. 같은 항목의 수정은 값을 선택한 후 저장하세요.</p>`+
    (result.conflicts.length?`<div class="table-scroll"><table class="baseline-conflict-table"><thead><tr><th>항목</th><th>최신값</th><th>내 수정</th><th>반영할 값</th></tr></thead><tbody>${result.conflicts.map((item,index)=>`<tr><td>${esc(labels[item.path]||item.path)}</td><td>${esc(display(item.theirs))}</td><td>${esc(display(item.mine))}</td><td><select data-conflict-choice="${index}" aria-label="${esc(labels[item.path]||item.path)} 충돌 해결"><option value="">선택하세요</option><option value="latest">최신값</option><option value="mine">내 수정</option></select></td></tr>`).join('')}</tbody></table></div>`:'<p>같은 항목에서 겹친 수정이 없습니다.</p>')+
    '<button id="baselineMergeLatest" type="button">선택한 값으로 편집 계속</button>';
  document.getElementById('baselineMergeLatest').onclick=()=>{
    const choices=Array.from(conflict.querySelectorAll('[data-conflict-choice]'));
    if(choices.some(select=>!select.value)){document.getElementById('baselineWarnings').textContent='겹친 항목마다 최신값 또는 내 수정을 선택하세요.';return;}
    choices.forEach((select,index)=>{const item=result.conflicts[index],value=select.value==='mine'?item.mine:item.theirs;AST.editorSet(result.merged,item.path,value===undefined?undefined:AST.clone(value));});
    const note=document.getElementById('baselineForm').elements.change_note.value;
    document.getElementById('baselineDialog').close();
    AST.openBaselineEditor('edit',result.merged,latest);
    document.getElementById('baselineForm').elements.change_note.value=note;
    document.getElementById('baselineWarnings').textContent=`r${latest.revision} 기준으로 병합했습니다. 입력을 확인한 후 저장하세요.`;
  };
};

AST.editorApi = async function(url,options={}){
  const response=await fetch(url,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(typeof body.detail==='string'?body.detail:body.detail?.message||`HTTP ${response.status}`);error.body=body;error.status=response.status;throw error;}
  return body;
};

AST.applySavedBaseline = async function(baseline,message){
  AST.baselines=AST.baselines.filter(item=>item.id!==baseline.id).concat([baseline]);
  AST.baselines.sort((a,b)=>AST.baselineLabel(a).localeCompare(AST.baselineLabel(b)));
  // Recalculate from the successful save response before refreshing the list.
  AST.setActiveBaseline(baseline);
  const status=document.getElementById('presetStatus');
  status.textContent=message;
  try{await AST.fetchBaselines();}
  catch(error){status.textContent=message+' · 목록 갱신 실패: '+error.message;}
};

AST.saveBaselineEditor = async function(event){
  event.preventDefault();
  if(!AST.editorMode)return;
  const saveButton=document.getElementById('baselineSave');
  if(saveButton.disabled)return;
  saveButton.disabled=true;
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
    await AST.applySavedBaseline(result.baseline,`r${result.baseline.revision} 저장 · Local Git ${result.commit_status}`+
      (result.warnings.length?' · '+result.warnings.join(' · '):''));
  }catch(error){
    if(error.status===409 && error.body.detail?.latest && AST.editorKind==='edit'){
      const latest=error.body.detail.latest;
      AST.showBaselineConflict(draft,latest);
      warning.textContent='revision 충돌 · 내 입력은 유지되었습니다.';
    }else if(error.status===409 && error.body.detail?.latest){
      warning.textContent='이미 사용 중인 ID입니다. 다른 ID로 저장하세요. 내 입력은 유지되었습니다.';
    }else warning.textContent='저장 실패: '+error.message;
  }finally{saveButton.disabled=false;}
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
      await AST.applySavedBaseline(result.baseline,(draft.active?'Baseline 재활성화':'Baseline 비활성화')+' · Local Git '+result.commit_status);
    }catch(error){document.getElementById('presetStatus').textContent='변경 실패: '+error.message;}
  };
  document.getElementById('baselineSync').onclick=async()=>{
    const status=document.getElementById('presetStatus');status.textContent='GitHub 동기화 중…';
    try{const result=await AST.editorApi('api/sync',{method:'POST',body:'{}'});status.textContent=`GitHub ${result.branch} 동기화 완료`;
    }catch(error){status.textContent='동기화 실패 · 로컬 데이터 유지: '+error.message;}
  };
});
