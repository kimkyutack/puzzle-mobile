/** Presentation in cell units: shared travel distance keeps a column's spacing. */
export function fallMotion(distance:number,column:number){
 const travel=Math.min(340,Math.max(105,95+Math.sqrt(Math.max(0,distance))*65)),landing=65;
 return {travel,landing,duration:travel+landing,delay:column*3};
}
export function fallPose(elapsed:number,travel:number,landing=65){
 const flight=Math.max(0,Math.min(1,elapsed/travel)),contact=Math.max(0,Math.min(1,(elapsed-travel)/landing));
 const compression=elapsed<=travel||elapsed>=travel+landing?0:Math.sin(Math.PI*contact)*(1-contact*.35);
 return {progress:flight**1.75,offset:compression*.04,scaleX:1+compression*.09,scaleY:1-compression*.12};
}
