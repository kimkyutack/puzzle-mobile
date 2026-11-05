// Special PNGs have a transparent inset around the authored silhouette. Their
// visible long edge now fills about 96% of a cell, while normal blocks stay put.
const powerKinds=new Set(['wind-row','wind-column','bomb','glider','rainbow']);
export const tileVisualSize=(kind:string)=>powerKinds.has(kind)?1.18:.99;
export const powerArtScale=tileVisualSize('rainbow')/.99;
