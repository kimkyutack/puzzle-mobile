/** How a struck tile cracks: eight wedges radiating from an off-centre point.
 * Coordinates are in the tile body's own box, from -1 to 1 on each axis. */
export interface ShardPiece {points:Array<[number,number]>;centroid:[number,number]}

const CRACK_CENTRE:[number,number]=[.12,-.08];
// Eight uneven wedges: small, chunky pieces like Royal Match's tile debris.
const CUTS=[.2,.72,1.3,1.82,2.3,2.88,3.38,3.82];

/** A point on the square's perimeter: 0..1 top, 1..2 right, 2..3 bottom, 3..4 left. */
function perimeter(value:number):[number,number]{
 const v=((value%4)+4)%4,side=Math.floor(v),f=v-side;
 return ([[-1+2*f,-1],[1,-1+2*f],[1-2*f,1],[-1,1-2*f]] as Array<[number,number]>)[side]!;
}

export const SHARD_PIECES:readonly ShardPiece[]=CUTS.map((from,i)=>{
 const to=i+1<CUTS.length?CUTS[i+1]!:CUTS[0]!+4;
 const points:Array<[number,number]>=[CRACK_CENTRE,perimeter(from)];
 for(let corner=Math.floor(from)+1;corner<to;corner++)points.push(perimeter(corner));
 points.push(perimeter(to));
 const centroid:[number,number]=[points.reduce((sum,p)=>sum+p[0],0)/points.length,points.reduce((sum,p)=>sum+p[1],0)/points.length];
 return {points,centroid};
});
