import type {Action,Booster,Player} from '@garden/contracts';

/** Confirmed inventory minus every predicted use, including an ambiguous in-flight batch. */
export function availableBooster(player:Pick<Player,'inventory'>,queue:readonly Action[],item:Booster):number{
 const count=player.inventory[item];
 return Math.max(0,(count?.normal??0)+(count?.bound??0)-queue.filter(action=>action.type==='booster'&&action.item===item).length);
}

/** Coalesce inputs without ever placing the input/animation path behind a network promise. */
export function backgroundSave(flush:()=>Promise<void>,delay=2200){
 let timer:ReturnType<typeof setTimeout>|undefined;
 return {schedule(){if(timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;void flush().catch(()=>{});},delay);},cancel(){if(timer!==undefined)clearTimeout(timer);timer=undefined;}};
}
