import {STORY_SCENES} from '@garden/content';
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
const pendingKey=(id:string)=>'garden-story-pending-'+id;
export function pendingScenes(id:string,storage:Storage=localStorage):string[]{
 try{const values:unknown=JSON.parse(storage.getItem(pendingKey(id))||'[]');return Array.isArray(values)?[...new Set(values.filter((value):value is string=>typeof value==='string'&&STORY_SCENES.some(scene=>scene.id===value)))]:[];}catch{return[];}
}
/** Persist before dismissing the viewer. Storage errors must remain visible to its caller. */
export function enqueueStoryScene(id:string,sceneId:string,storage:Storage=localStorage){
 if(!STORY_SCENES.some(scene=>scene.id===sceneId))throw Error('Unknown story scene');
 storage.setItem(pendingKey(id),JSON.stringify([...new Set([...pendingScenes(id,storage),sceneId])]));
}
/** Keep scenes queued while the acknowledged packet was in flight. */
export function confirmStoryScenes(id:string,sent:string[],storage:Storage=localStorage){
 storage.setItem(pendingKey(id),JSON.stringify(pendingScenes(id,storage).filter(sceneId=>!sent.includes(sceneId))));
}
