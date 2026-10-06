window.AST = window.AST || {};

// Closed meshes for a recognizable tail-sitter silhouette. They are visual only.
AST.geometry = function (s) {
  const R=s.wing.span/2,L=s.fuselage.length,halfWidth=s.fuselage.width/2,halfHeight=s.fuselage.height/2;
  const rootLE=-0.22*L,tipLE=rootLE+R*Math.tan(s.wing.sweep*Math.PI/180);
  const rootY=Math.min(R*0.3,Math.max(0.04,halfWidth*0.68));
  const sparRootX=rootLE+s.sparDesign.sparXc*s.wing.rootChord,sparTipX=tipLE+s.sparDesign.sparXc*s.wing.tipChord;

  function plate(corners,thickness,axis='z') {
    const x=[],y=[],z=[],i=[],j=[],k=[];
    for(const level of [1,-1])for(const p of corners){x.push(p[0]);y.push(p[1]+(axis==='y'?level*thickness/2:0));z.push(p[2]+(axis==='z'?level*thickness/2:0));}
    const faces=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
    faces.forEach(face=>{i.push(face[0]);j.push(face[1]);k.push(face[2]);});
    return {x,y,z,i,j,k};
  }

  function wing(sign) {
    const cr=s.wing.rootChord,ct=s.wing.tipChord,tipZ=0.025*R;
    return plate([
      [rootLE,sign*rootY,0],[rootLE+cr,sign*rootY,0],
      [tipLE+ct,sign*R,tipZ],[tipLE,sign*R,tipZ]
    ],Math.max(0.012,Math.min(cr,ct)*s.wing.tc));
  }

  function loft(stations,segments,point) {
    const x=[],y=[],z=[],i=[],j=[],k=[];
    stations.forEach((station,row)=>{
      for(let a=0;a<segments;a++){
        const p=point(station,2*Math.PI*a/segments,row);
        x.push(p[0]);y.push(p[1]);z.push(p[2]);
      }
    });
    for(let row=0;row<stations.length-1;row++)for(let a=0;a<segments;a++){
      const next=(a+1)%segments,base=row*segments,above=(row+1)*segments;
      i.push(base+a,base+next);j.push(base+next,above+next);k.push(above+a,above+a);
    }
    return {x,y,z,i,j,k};
  }

  const stations=[[-0.55,0.035],[-0.44,0.58],[-0.25,0.92],[-0.04,1],[0.18,0.82],[0.38,0.48],[0.45,0.08]];
  const body=loft(stations,12,([along,radius],theta)=>[along*L,Math.cos(theta)*halfWidth*radius,Math.sin(theta)*halfHeight*radius]);
  body.x.push(-0.55*L,0.45*L);body.y.push(0,0);body.z.push(0,0);
  const nose=body.x.length-2,tail=body.x.length-1,last=(stations.length-1)*12;
  for(let a=0;a<12;a++){const next=(a+1)%12;body.i.push(nose,tail);body.j.push(next,last+a);body.k.push(a,last+next);}

  const canopy=loft([[-0.35,0.08],[-0.28,0.65],[-0.17,1],[-0.08,0.64],[-0.02,0.08]],10,([along,radius],theta)=>[
    along*L,Math.cos(theta)*halfWidth*0.58*radius,halfHeight*(0.73+0.42*Math.sin(theta)*radius)
  ]);

  const motorX=rootLE-0.07*L,motorY=Math.min(R*0.42,Math.max(rootY+0.12,R*0.37));
  const nacelle=centerY=>loft([[-0.05,0.35],[0,0.95],[0.12,1],[0.27,0.22]],10,([along,radius],theta)=>[
    motorX+along*L,centerY+Math.cos(theta)*0.075*L*radius,Math.sin(theta)*0.065*L*radius
  ]);
  // Symmetric conceptual placement; actual motor stations need concept data.
  const count=s.propulsion.prop_count;
  const motors=Array.from({length:count},(_,index)=>({x:motorX,y:count===1?0:(2*index/(count-1)-1)*motorY,z:0}));

  const tailHalfSpan=Math.min(0.27*R,0.48*L),tailRootY=Math.min(tailHalfSpan*0.5,halfWidth*0.8);
  const tailLE=0.29*L,tailRootChord=0.22*L,tailTipChord=0.11*L;
  const horizontalTail=sign=>plate([
    [tailLE,sign*tailRootY,0.035],[tailLE+tailRootChord,sign*tailRootY,0.035],
    [tailLE+0.07*L+tailTipChord,sign*tailHalfSpan,0.05],[tailLE+0.07*L,sign*tailHalfSpan,0.05]
  ],Math.max(0.008,0.025*L));
  const finHeight=Math.min(0.35*L,0.28*R),finBase=halfHeight*0.78;
  const verticalTail=plate([
    [0.15*L,0,finBase],[0.44*L,0,finBase],
    [0.41*L,0,finBase+finHeight],[0.30*L,0,finBase+finHeight]
  ],Math.max(0.012,0.08*halfWidth),'y');

  return {
    wingLeft:wing(-1),wingRight:wing(1),body,canopy,motors,nacelles:motors.map(motor=>nacelle(motor.y)),
    tailLeft:horizontalTail(-1),tailRight:horizontalTail(1),verticalTail,
    cg:{x:rootLE+0.28*s.wing.rootChord,y:0,z:0},sparX:sparRootX,sparTipX,rootY,
    motorX,motorY,motorZ:0,
    propRadius:Math.min(0.14*R,Math.max(0.10,0.15*L)),noseX:-0.55*L,tailX:0.45*L
  };
};
