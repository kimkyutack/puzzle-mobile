import {COLORS,type Color,type TreasurePair} from '@garden/contracts';
export const TREASURE_MAX_TURNS=12;
export function treasureDeck(seed:number):Color[]{
 let rng=seed>>>0;const deck:Color[]=[...COLORS,...COLORS];
 for(let index=deck.length-1;index>0;index--){rng=(Math.imul(rng,1664525)+1013904223)>>>0;const to=rng%(index+1);[deck[index],deck[to]]=[deck[to]!,deck[index]!];}
 return deck;
}
export function replayTreasure(deck:Color[],pairs:readonly TreasurePair[],maximum=TREASURE_MAX_TURNS){
 const matched=new Set<number>();
 if(deck.length!==12||pairs.length>maximum)return {valid:false,status:'lost' as const,matched:[] as number[],turns:0};
 for(const {first,second} of pairs){
  if(!Number.isInteger(first)||!Number.isInteger(second)||first<0||second<0||first>=deck.length||second>=deck.length||first===second||matched.has(first)||matched.has(second)||matched.size===deck.length)return {valid:false,status:'lost' as const,matched:[...matched],turns:pairs.length};
  if(deck[first]===deck[second]){matched.add(first);matched.add(second);}
 }
 return {valid:true,status:matched.size===deck.length?'won' as const:pairs.length===maximum?'lost' as const:'playing' as const,matched:[...matched],turns:pairs.length};
}
