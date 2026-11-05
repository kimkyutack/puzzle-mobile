import {DECORATIONS,storedDecorations,validateGardenPlacement,type GardenPlacement,type GardenPoint,type GardenWorldState,type GardenRotation} from '../../../../packages/garden-world/src';

/** Interpolate sparse pointer events so a fast stroke cannot leave holes between cells. */
export function gardenBrushLine(from:GardenPoint,to:GardenPoint):GardenPoint[]{
 const cells:GardenPoint[]=[];let x=from.x,y=from.y;const dx=Math.abs(to.x-x),dy=Math.abs(to.y-y),sx=x<to.x?1:-1,sy=y<to.y?1:-1;let error=dx-dy;
 while(true){cells.push({x,y});if(x===to.x&&y===to.y)break;const twice=error*2;if(twice>-dy){error-=dy;x+=sx;}if(twice<dx){error+=dx;y+=sy;}}
 return cells;
}
export function extendGardenPaint(world:GardenWorldState,itemId:string,staged:GardenPlacement[],cells:GardenPoint[],rotation:GardenRotation=0):GardenPlacement[]{
 const item=DECORATIONS.find(d=>d.id===itemId);if(!item||item.category==='animal')return staged;
 const used=new Set(staged.map(p=>p.instanceId)),stock=storedDecorations(world).filter(i=>i.itemId===itemId&&!used.has(i.id));
 const placements={...world.placements,...Object.fromEntries(staged.map(p=>[p.instanceId,p]))},next=[...staged];
 for(const cell of cells){if(!stock.length||next.length>=100)break;const placement:GardenPlacement={instanceId:stock[0]!.id,x:cell.x,y:cell.y,rotation};
  try{validateGardenPlacement({...world,placements},placement);placements[placement.instanceId]=placement;next.push(placement);stock.shift();}catch{}
 }
 return next;
}
