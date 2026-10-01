window.AST = window.AST || {};
AST.loadTraces = function (s,r,g) {
  const traces=[], d=s.display, R=s.wing.span/2, scale=Math.max(0.12,Math.min(0.5,R*0.25));
  const arrowMeta=(name,text)=>({kind:'load-arrow',label:name,detail:text.replace(/<br\s*\/?\s*>/g,'\n')});
  const line=(x,y,z,color,width,name,detail,dash,interactive=true)=>({type:'scatter3d',mode:'lines',x,y,z,line:{color,width,dash},name,showlegend:false,
    ...(interactive?{hovertemplate:detail+'<extra></extra>',meta:arrowMeta(name,detail)}:{hoverinfo:'skip'})});
  const cone=(x,y,z,u,v,w,color,name,detail)=>({type:'cone',x:[x],y:[y],z:[z],u:[u],v:[v],w:[w],colorscale:[[0,color],[1,color]],showscale:false,sizemode:'absolute',sizeref:Math.max(0.05,scale*0.38),anchor:'tip',name,hovertemplate:detail+'<extra></extra>',meta:arrowMeta(name,detail),showlegend:false});
  function arrow(x,y,z,vx,vy,vz,color,name,text) {
    traces.push(line([x,x+vx],[y,y+vy],[z,z+vz],color,5,name,text));
    traces.push(cone(x+vx,y+vy,z+vz,vx,vy,vz,color,name,text));
  }
  const visualFactor=(value,reference)=>Math.min(1.8,Math.max(0.35,Math.sqrt(Math.abs(value)/reference)));
  if(d.weight) arrow(g.cg.x,0,0,0,0,-scale*visualFactor(r.loads.weight,25*9.80665),'#ef6972','기체 중량','중량 = '+AST.fmt(r.loads.weight)+' N');
  const distributed=(load,color,name)=>{
    const lengthFactor=visualFactor(load,25*9.80665*3.8*1.6);
    for(const sign of [-1,1]) for(let i=1;i<=6;i++) {
      const y=sign*R*i/7, u=Math.abs(y)/R, q=2*load/(Math.PI*R)*Math.sqrt(1-u*u);
      const x=g.sparX + Math.abs(y)/R*(g.sparTipX-g.sparX);
      arrow(x,y,name==='돌풍 양력'?0.1:0.03,0,0,scale*lengthFactor*(0.25+0.75*Math.sqrt(1-u*u)),color,name,'날개폭 위치 = '+AST.fmt(y,2)+' m<br>분포 하중 = '+AST.fmt(q,1)+' N/m');
    }
  };
  if(d.lift)distributed(r.spar.load,'#65c9ff','양력');
  if(d.gust)distributed(r.loads.gustPlusLoad,'#98ecb3','돌풍 양력');
  if(d.shear) for(const sign of [-1,1]) arrow(g.sparX,sign*g.rootY,0,0,0,scale*0.85*visualFactor(r.spar.rootShear,25*9.80665*3.8*1.6/2),'#f8b45e','루트 전단력','루트 전단력 = '+AST.fmt(r.spar.rootShear)+' N');
  if(d.moment) for(const sign of [-1,1]) {
    const x=[],y=[],z=[], radius=scale*0.48*visualFactor(r.spar.rootMoment,25*9.80665*3.8*1.6*3.6/(3*Math.PI));
    for(let i=0;i<=20;i++){const a=-Math.PI*0.5+i*Math.PI*1.5/20;x.push(g.sparX+radius*Math.cos(a));y.push(sign*g.rootY);z.push(radius*Math.sin(a));}
    traces.push(line(x,y,z,'#d99eff',5,'루트 굽힘모멘트','루트 굽힘모멘트 = '+AST.fmt(r.spar.rootMoment)+' N·m'));
    traces.push(cone(x[20],y[20],z[20],x[20]-x[19],0,z[20]-z[19],'#d99eff','모멘트','루트 굽힘모멘트 = '+AST.fmt(r.spar.rootMoment)+' N·m'));
  }
  if(d.impact) arrow(g.tailX,0,-0.04,scale*0.95*visualFactor(r.loads.impact,25*9.80665*(1+0.3/0.08)),0,0,'#ffdb70','착륙 충격력','평균 착륙 충격력 = '+AST.fmt(r.loads.impact)+' N');
  if(d.dimensions) {
    traces.push(line([0,0],[-R,R],[-scale*0.7,-scale*0.7],'#879bb6',3,'날개폭','날개폭 = '+AST.fmt(s.wing.span,2)+' m','dot',false));
    traces.push(line([g.noseX,g.tailX],[0,0],[-s.fuselage.height/2-scale*0.2,-s.fuselage.height/2-scale*0.2],'#879bb6',3,'동체 길이','동체 길이 = '+AST.fmt(s.fuselage.length,2)+' m','dot',false));
  }
  return traces;
};
