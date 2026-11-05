import type {RestorationTask} from '../../content/src';
const legacySites=[[[14,11],[13,18],[19,14],[18,18],[15,15],[11,14]],[[4,14],[4,18],[8,14],[8,18],[6,10],[2,20]],[[14,3],[18,5],[13,7],[20,4],[10,4],[16,7]]];
export function restorationItemId(task:RestorationTask){return task.itemId??(task.asset==='door'?(task.area==='workshop'?'garden-greenhouse':'garden-gate'):task.asset==='telescope'?'garden-telescope':'garden-'+task.asset);}
export function restorationSite(task:RestorationTask,index:number){
 const point=task.position??legacySites[Math.floor(index/6)]?.[index%6];if(!point)throw Error('Missing restoration site: '+task.id);
 return {instanceId:'restored-'+task.id,x:point[0]!,y:point[1]!,rotation:0 as const};
}
