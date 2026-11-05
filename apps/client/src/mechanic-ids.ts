const ids={pipe:'mechanic_pipe_v20',bud:'mechanic_bud_v20',carousel:'mechanic_carousel_v20',curtain:'mechanic_curtain_v20'};
export function mechanicArtId(kind:string):string|undefined{return ids[kind as keyof typeof ids];}
