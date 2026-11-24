/** Visual proportions measured from the approved home garden, independent of saved land footprints. */
export const GARDEN_HOME_ZOOM=.5;
// The reference lawn has ~62px diamonds; canonical 128px cells at .5 zoom give 64px.
// Keep object silhouettes independent from that wider spacing.
export const GARDEN_ART_FOOTPRINT_FILL=.75;
// Visitor frames contain more transparent padding; .8 gives ~45px visible figures at home scale.
export const GARDEN_RESIDENT_SCALE={animal:.465,visitor:.8} as const;

const objectScale:Readonly<Record<string,number>>={
 'garden-greenhouse':.80,
 'garden-cherry-tree':1.15,
 'garden-yellow-pergola':.9,
 'garden-potted-flowers':.8,
 'garden-bench':.82,
 'garden-planter':.70,
 'garden-tree':.70,
 'garden-hedge':.78,
 'garden-mushroom':.48,
};

/** Narrow props need a height limit: sizing a lamp by tile width made it building-sized. */
export function gardenObjectArtWidth(item:{id:string;category:string},art:{width:number;height:number},footprintWidth:number,tileWidth:number){
 const width=footprintWidth*GARDEN_ART_FOOTPRINT_FILL*(objectScale[item.id]??1);
 const heightLimit=item.id==='garden-lamp'?tileWidth*.66:item.category==='decoration'&&art.height>art.width*2?tileWidth*.975:Infinity;
 return Math.min(width,heightLimit*art.width/art.height);
}
