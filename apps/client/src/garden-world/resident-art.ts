import type {GardenPoint,GardenRotation} from '../../../../packages/garden-world/src';
import type {GardenResident} from './residents';
import {GARDEN_RESIDENT_SCALE} from './art-scale';

/** Each animated front/rear view has its own leg cycle and a mirrored companion. */
export function residentDirectionArt<T>(images:Record<string,T>,actor:Pick<GardenResident,'art'|'pose'|'frame'|'rear'|'facing'>){
 const walking=actor.pose==='walk',restingAnimal=actor.pose==='idle'&&actor.rear&&actor.art.startsWith('animal-');
 const assetId=walking?`resident-walk:${actor.art}:${actor.rear?'rear':'front'}:${actor.frame}`:restingAnimal?actor.art+':rear':`resident:${actor.art}:${actor.frame}`;
 const art=images[assetId];if(!art)throw new Error('Missing garden resident art: '+assetId);
 return {art,assetId,flipped:actor.facing===-1,direction:actor.rear?(actor.facing===-1?'nw':'ne'):(actor.facing===-1?'sw':'se')};
}

export function placedAnimalArt<T>(images:Record<string,T>,itemId:string,rotation:GardenRotation){
 return residentDirectionArt(images,{
  art:itemId,pose:'idle',frame:0,rear:rotation===180||rotation===270,facing:rotation===90||rotation===270?-1:1
 });
}

export function residentArtBounds(art:{width:number;height:number},bottom:GardenPoint,tileWidth:number,animal:boolean){
 const width=tileWidth*(animal?GARDEN_RESIDENT_SCALE.animal:GARDEN_RESIDENT_SCALE.visitor)*art.width/Math.max(art.width,art.height);
 const height=width*art.height/art.width;
 return {width,height,x:bottom.x-width/2,y:bottom.y-height*.98};
}
