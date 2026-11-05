export type EffectPoint={x:number;y:number};
export const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
export const smoothStep=(value:number)=>{const t=clamp01(value);return t*t*(3-2*t);};
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function curvedPoint(from:EffectPoint,to:EffectPoint,t:number,bend:number):EffectPoint{const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,arc=Math.sin(Math.PI*t)*bend;return{x:mix(from.x,to.x,t)-dy/length*arc,y:mix(from.y,to.y,t)+dx/length*arc};}
/** Enlarge in the foreground, hold through the beam impacts, then dissolve. */
export function rainbowHeroPose(ms:number,origin:EffectPoint,cell:number,face:{x:number;y:number;width:number;height:number},charge:number,travel:number){
 const rise=smoothStep(ms/(charge*.78)),margin=cell*1.2;
 const x=Math.max(face.x+margin,Math.min(face.x+face.width-margin,origin.x));
 const y=Math.max(face.y+margin,Math.min(face.y+face.height-margin,origin.y-cell*.65));
 const release=smoothStep((ms-charge-travel)/260);
 return {x:mix(origin.x,x,rise),y:mix(origin.y,y,rise),scale:1+1.15*rise+.045*Math.sin(ms/80)*rise,rotation:.07*Math.sin(ms/110)*rise,alpha:1-release};
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
