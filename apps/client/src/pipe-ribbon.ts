type Point={x:number;y:number};
interface Path {ends:readonly [{tip:Point;out:Point},{tip:Point;out:Point}];corners:readonly {enter:Point;center:Point;leave:Point}[]}
/** One shared ribbon follows the existing centerline, so turns cannot separate from straight segments. */
export function pipeRibbon(path:Path,cell:number){
 const points:Point[]=[path.ends[0].tip];
 const line=(to:Point)=>{const from=points.at(-1)!,steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/(cell*.18)));for(let i=1;i<=steps;i++)points.push({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps});};
 for(const corner of path.corners){line(corner.enter);for(let i=1;i<=12;i++){const t=i/12,u=1-t;points.push({x:u*u*corner.enter.x+2*u*t*corner.center.x+t*t*corner.leave.x,y:u*u*corner.enter.y+2*u*t*corner.center.y+t*t*corner.leave.y});}}
 line(path.ends[1].tip);
 const distance=[0];for(let i=1;i<points.length;i++)distance.push(distance[i-1]!+Math.hypot(points[i]!.x-points[i-1]!.x,points[i]!.y-points[i-1]!.y));
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[],length=distance.at(-1)||1;
 for(let i=0;i<points.length;i++){const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,span=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/span,ny=(b.x-a.x)/span;
  positions.push(p.x+nx*cell*.478,p.y+ny*cell*.478,p.x-nx*cell*.478,p.y-ny*cell*.478);uvs.push(distance[i]!/length,1,distance[i]!/length,0);
  if(i<points.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 }
 return {positions:new Float32Array(positions),uvs:new Float32Array(uvs),indices:new Uint32Array(indices),points};
}
