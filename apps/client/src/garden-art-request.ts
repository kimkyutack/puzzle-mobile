import {GARDEN_MARKET_ART} from '../../../packages/garden-world/src/catalog';

/** An optional URL capability keeps old installed clients compatible without a new CORS header. */
export function gardenArtRequest(path:string):string {
 return (path.startsWith('/garden/')||path==='/flowerlight/restore')?path+(path.includes('?')?'&':'?')+'gardenArt='+GARDEN_MARKET_ART:path;
}
