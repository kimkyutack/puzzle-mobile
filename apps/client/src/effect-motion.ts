export type EffectPoint={x:number;y:number};
export const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
export const smoothStep=(value:number)=>{const t=clamp01(value);return t*t*(3-2*t);};
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function curvedPoint(from:EffectPoint,to:EffectPoint,t:number,bend:number):EffectPoint{const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,arc=Math.sin(Math.PI*t)*bend;return{x:mix(from.x,to.x,t)-dy/length*arc,y:mix(from.y,to.y,t)+dx/length*arc};}

export type WindupItem='wind-row'|'wind-column'|'glider'|'beehive';

export function itemWindupPose(kind:WindupItem,progress:number,direction=0){
 const grow=smoothStep(progress/.72),aim=smoothStep((progress-.38)/.62);
 if(kind==='wind-row'||kind==='wind-column'){
  const along=1+.55*grow+.12*aim,across=1+.51*grow-.11*aim;
  return {scaleX:kind==='wind-row'?along:across,scaleY:kind==='wind-column'?along:across,lift:0,rotation:0};
 }
 if(kind==='glider'){
  const scale=1+.56*grow;
  return {scaleX:scale,scaleY:scale,lift:.28*smoothStep(progress/.86),rotation:.22*direction*aim};
 }
 const scale=1+.64*grow;
 return {scaleX:scale,scaleY:1+.61*grow,lift:.28*smoothStep(progress/.8),rotation:0};
}

/** Enlarge in the foreground, hold through the beam impacts, then dissolve. */
export function rainbowHeroPose(ms:number,origin:EffectPoint,cell:number,face:{x:number;y:number;width:number;height:number},charge:number,travel:number){
 const rise=smoothStep(ms/(charge*.66)),margin=cell*1.2;
 const x=Math.max(face.x+margin,Math.min(face.x+face.width-margin,origin.x));
 const y=Math.max(face.y+margin,Math.min(face.y+face.height-margin,origin.y-cell*.65));
 const release=smoothStep((ms-charge-travel)/260);
 const turn=.16*Math.sin(Math.PI*smoothStep(ms/charge));
 return {x:mix(origin.x,x,rise),y:mix(origin.y,y,rise),scale:1+.8*rise,rotation:-turn,alpha:1-release};
}
/** Both original pieces arrive at the same anchor, then compress into the combined power. */
export function fusionPose(t:number,from:EffectPoint,target:EffectPoint,side:number,cell:number){
 const approach=smoothStep(t/.64),collapse=smoothStep((t-.64)/.36),point=curvedPoint(from,target,approach,cell*.35*side),lift=Math.sin(Math.PI*approach)*cell*.27;
 return {x:point.x,y:point.y-lift,rotation:side*Math.sin(Math.PI*t)*.42,scale:(1+.28*Math.sin(Math.PI*t))*(1-.85*collapse),alpha:1-collapse};
}
/** Its head reaches the authoritative target at 760 ms; all anticipation stays inside the canvas. */
export function hammerPose(ms:number,target:EffectPoint,cell:number,width:number,height:number){
 const directionX=target.x<width/2?1:-1,directionY=target.y<cell*1.5?1:-1,margin=cell*1.1,inside=(value:number,limit:number)=>Math.max(margin,Math.min(limit-margin,value));
 const from={x:inside(target.x+directionX*cell*1.8,width),y:inside(target.y+directionY*cell*2.1,height)},hover={x:inside(target.x+directionX*cell*.65,width),y:inside(target.y+directionY*cell*.95,height)};
 const approach=smoothStep(ms/300),windup=smoothStep((ms-300)/280),strike=clamp01((ms-580)/180)**3,recoil=smoothStep((ms-760)/180),base=curvedPoint(from,hover,approach,cell*.3*directionX);
 const point=ms<580?base:{x:mix(hover.x,target.x,strike),y:mix(hover.y,target.y,strike)};
 if(ms>=760){point.x=target.x+directionX*cell*.08*recoil;point.y=target.y+directionY*cell*.16*recoil;}
 const rotation=directionX*directionY*(ms<300?mix(-.38,-.15,approach):ms<580?mix(-.15,-1.06,windup):ms<760?mix(-1.06,.16,strike):mix(.16,-.22,recoil));
 const scale=1+.12*approach+.09*Math.sin(Math.PI*windup)*(ms<580?1:0)-.12*recoil;
 return {...point,rotation,scaleX:scale*directionX,scaleY:scale*directionY,alpha:ms>820?clamp01((1120-ms)/300):1};
}
/** The rake banks along its line, then squares up at the edge before the common snap. */
export function rakePose(t:number,from:EffectPoint,to:EffectPoint,horizontal:boolean,direction:number,cell:number){const u=smoothStep(t),sway=Math.sin(Math.PI*u)*cell*.16;return {x:mix(from.x,to.x,u)+(horizontal?0:sway*direction),y:mix(from.y,to.y,u)+(horizontal?sway*direction:0),rotation:(horizontal?-Math.PI/2:0)+direction*Math.sin(Math.PI*u)*.18,scale:1+.12*Math.sin(Math.PI*t)};}
/** Two combined items swing apart onto a ring around the anchor, then circle each other ever faster and tighter
 * until they meet at `total` ms. `axis` points from the first cell to the second; piece 0 starts opposite it. */
export function comboOrbitPose(ms:number,total:number,from:EffectPoint,target:EffectPoint,index:number,axis:number,cell:number,approach=150){
 const start=axis+(index===0?Math.PI:0),radius=cell*.42;
 const ring={x:target.x+Math.cos(start)*radius,y:target.y+Math.sin(start)*radius};
 if(ms<approach){
  const u=smoothStep(ms/approach),pop=Math.sin(Math.PI*u)*.12;
  return {x:mix(from.x,ring.x,u),y:mix(from.y,ring.y,u)-Math.sin(Math.PI*u)*cell*.12,rotation:0,scale:1+pop};
 }
 const u=clamp01((ms-approach)/Math.max(1,total-approach)),turn=start+Math.PI*2*1.6*u**1.6,r=radius*(1-u**1.3);
 return {x:target.x+Math.cos(turn)*r,y:target.y+Math.sin(turn)*r-cell*.12*smoothStep(u),rotation:(turn-start)*.25,scale:1+.32*smoothStep(u)};
}
