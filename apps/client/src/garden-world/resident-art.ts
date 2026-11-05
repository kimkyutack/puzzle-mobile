import type {GardenResident} from './residents';

/** Each animated front/rear view has its own leg cycle and a mirrored companion. */
export function residentDirectionArt<T>(images:Record<string,T>,actor:Pick<GardenResident,'art'|'pose'|'frame'|'rear'|'facing'>){
 const walking=actor.pose==='walk',restingAnimal=actor.pose==='idle'&&actor.rear&&actor.art.startsWith('animal-');
 const assetId=walking?`resident-walk:${actor.art}:${actor.rear?'rear':'front'}:${actor.frame}`:restingAnimal?actor.art+':rear':`resident:${actor.art}:${actor.frame}`;
 const art=images[assetId];if(!art)throw new Error('Missing garden resident art: '+assetId);
 return {art,assetId,flipped:actor.facing===-1,direction:actor.rear?(actor.facing===-1?'nw':'ne'):(actor.facing===-1?'sw':'se')};
}
