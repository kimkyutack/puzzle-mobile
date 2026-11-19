export const BEE_BEATS={charge:620,flight:720,stagger:260} as const;
/** A shallow arc keeps each bee visible as it leaves the hive and dives at a target. */
export function beePoint(from:{x:number;y:number},to:{x:number;y:number},progress:number,cell:number){
 const t=Math.max(0,Math.min(1,progress)),u=t*t*(3-2*t),bend=Math.min(cell*1.5,Math.hypot(to.x-from.x,to.y-from.y)*.25+cell*.3);
 return {x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u-Math.sin(Math.PI*u)*bend};
}
