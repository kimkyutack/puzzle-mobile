import type {GameState,Special} from '@garden/contracts';
const specials:readonly string[]=['wind-row','wind-column','bomb','glider','rainbow'];
export function combinationParts(kind:string):[Special,Special]|null{
 const parts=kind.split('+');return parts.length===2&&parts.every(part=>specials.includes(part))?parts as [Special,Special]:null;
}
/** Only real adjacent power pieces combine. The engine remains authoritative about consuming them. */
export function combinationAt(state:GameState,from:number,to:number):[Special,Special]|null{
 const a=state.cells[from],b=state.cells[to];
 if(!a?.exists||!b?.exists||a.obstacleId||b.obstacleId||!a.tile||!b.tile||Math.abs(from%state.width-to%state.width)+Math.abs(Math.floor(from/state.width)-Math.floor(to/state.width))!==1)return null;
 return combinationParts(`${a.tile.kind}+${b.tile.kind}`);
}
