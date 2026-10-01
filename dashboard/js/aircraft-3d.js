window.AST = window.AST || {};
AST.cameraPresets = {
  iso:{eye:{x:-1.55,y:1.7,z:1.15},up:{x:0,y:0,z:1}},
  top:{eye:{x:0.02,y:0.02,z:2.4},up:{x:1,y:0,z:0}},
  front:{eye:{x:-2.4,y:0.01,z:0.05},up:{x:0,y:0,z:1}},
  side:{eye:{x:0.01,y:2.4,z:0.05},up:{x:0,y:0,z:1}}
};
AST.render3D = function (s,r) {
  const target=document.getElementById('aircraftPlot');
  const selection=document.getElementById('loadSelection');
  selection.hidden=true;
  if (!window.Plotly) {target.innerHTML='<div class="plot-fallback">3D 보기를 불러오지 못했습니다. 인터넷 연결을 확인하세요.</div>';return;}
  const g=AST.geometry(s), d=s.display, traces=[];
  const mesh=(v,color,opacity,name)=>({type:'mesh3d',...v,color,opacity,flatshading:true,name,hoverinfo:'skip',showscale:false,showlegend:false});
  const edge=(x,y,z,color,width,name)=>({type:'scatter3d',mode:'lines',x,y,z,line:{color,width},name,hoverinfo:'skip',showlegend:false});
  if(d.aircraft) {
    traces.push(mesh(g.body,'#7394b5',0.96,'유선형 개념 동체'));
    traces.push(mesh(g.canopy,'#16354f',0.98,'조종석 캐노피'));
    traces.push(mesh(g.wingLeft,'#92b3d1',d.spar?0.52:0.96,'왼쪽 주익'));
    traces.push(mesh(g.wingRight,'#92b3d1',d.spar?0.52:0.96,'오른쪽 주익'));
    traces.push(mesh(g.tailLeft,'#6f9dbb',0.96,'왼쪽 수평꼬리날개'));
    traces.push(mesh(g.tailRight,'#6f9dbb',0.96,'오른쪽 수평꼬리날개'));
    traces.push(mesh(g.verticalTail,'#82abc8',0.98,'수직꼬리날개'));
    traces.push(mesh(g.nacelleLeft,'#bdcbd7',0.98,'왼쪽 모터 나셀'));
    traces.push(mesh(g.nacelleRight,'#bdcbd7',0.98,'오른쪽 모터 나셀'));
    for(const wing of [g.wingLeft,g.wingRight]){
      traces.push(edge([wing.x[0],wing.x[3]],[wing.y[0],wing.y[3]],[wing.z[0],wing.z[3]],'#d0e9f6',3,'주익 앞전'));
      traces.push(edge([wing.x[1],wing.x[2]],[wing.y[1],wing.y[2]],[wing.z[1],wing.z[2]],'#557c9c',2,'주익 뒷전'));
    }
    for(const sign of [-1,1]) {
      const centerY=sign*g.motorY,propX=g.motorX-0.035*s.fuselage.length;
      traces.push({type:'scatter3d',mode:'markers',x:[g.motorX],y:[centerY],z:[g.motorZ],marker:{size:9,color:'#e9ae75',symbol:'circle'},name:'모터',hoverinfo:'skip',showlegend:false});
      const yy=[],zz=[];
      for(let a=0;a<=32;a++){const theta=2*Math.PI*a/32;yy.push(centerY+g.propRadius*Math.cos(theta));zz.push(g.motorZ+g.propRadius*Math.sin(theta));}
      traces.push(edge(Array(yy.length).fill(propX),yy,zz,'#e9ae75',2,'프로펠러 회전면'));
      for(let blade=0;blade<3;blade++){
        const theta=2*Math.PI*blade/3;
        traces.push(edge([propX,propX],[centerY,centerY+g.propRadius*0.88*Math.cos(theta)],[g.motorZ,g.motorZ+g.propRadius*0.88*Math.sin(theta)],'#f3c895',5,'프로펠러 블레이드'));
      }
    }
  }
  if(d.spar) {
    traces.push({type:'scatter3d',mode:'lines',x:[g.sparTipX,g.sparX,g.sparTipX],y:[-s.wing.span/2,0,s.wing.span/2],z:[0.025*s.wing.span/2,0,0.025*s.wing.span/2],line:{color:'#f2bb75',width:11},name:'주 스파',hoverinfo:'skip',showlegend:false});
  }
  if(d.cg) traces.push({type:'scatter3d',mode:'markers+text',x:[g.cg.x],y:[0],z:[0],text:['무게중심'],textposition:'top center',textfont:{color:'#f9e8ab',size:12},marker:{size:8,color:'#f9e8ab'},name:'무게중심',hoverinfo:'skip',showlegend:false});
  traces.push(...AST.loadTraces(s,r,g));
  const prior=target.layout && target.layout.scene && target.layout.scene.camera;
  const camera=AST.activeCamera || prior || AST.cameraPresets.iso;
  Plotly.react(target,traces,{
    paper_bgcolor:'transparent',plot_bgcolor:'transparent',margin:{l:0,r:0,t:0,b:0},
    showlegend:false,scene:{bgcolor:'transparent',aspectmode:'data',camera,
      xaxis:{title:'기체 길이 X [m]',color:'#9db3c9',gridcolor:'#334a60',zerolinecolor:'#49627a'},
      yaxis:{title:'날개폭 Y [m]',color:'#9db3c9',gridcolor:'#334a60',zerolinecolor:'#49627a'},
      zaxis:{title:'높이 Z [m]',color:'#9db3c9',gridcolor:'#334a60',zerolinecolor:'#49627a'}},
    uirevision:'aircraft'
  },{responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToAdd:['pan3d']}).then(()=>{
    if(target.__loadClickBound)return;
    target.on('plotly_click',event=>{
      const point=event.points&&event.points[0];
      const meta=point&&(point.data||point.fullData)?.meta;
      if(!meta||meta.kind!=='load-arrow'){selection.hidden=true;return;}
      selection.textContent=meta.label+'\n'+meta.detail;
      selection.hidden=false;
    });
    target.__loadClickBound=true;
  });
};
AST.setCamera = function (name) {
  AST.activeCamera=AST.cameraPresets[name]||AST.cameraPresets.iso;
  if(window.Plotly) Plotly.relayout('aircraftPlot',{'scene.camera':AST.activeCamera});
};
