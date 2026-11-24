import type {Item} from './index';

export type PassPrize=
 |{kind:'coins';quantity:number}
 |{kind:'item';item:Item;quantity:number}
 |{kind:'decoration';itemId:string;quantity:1}
 |{kind:'profile';id:'season-gardener';quantity:1}
 |{kind:'guild-gift';item:'hammer';quantity:1};
export type PassTrack='free'|'premium';
const item=(item:Item,quantity=1):PassPrize=>({kind:'item',item,quantity});
const decoration=(itemId:string):PassPrize=>({kind:'decoration',itemId,quantity:1});
const free:Record<number,PassPrize>={5:item('wind-row'),10:decoration('garden-daisy-bed'),15:item('bomb'),20:item('hammer'),25:decoration('garden-potted-flowers'),30:item('rainbow')};
const premium:Record<number,PassPrize>={3:item('hammer',2),5:item('wind-row'),6:decoration('garden-bench'),9:item('bomb'),11:item('hammer',2),12:decoration('garden-lamp'),15:{kind:'profile',id:'season-gardener',quantity:1},17:item('rainbow'),18:decoration('garden-blue-hydrangea'),20:item('sweep-row'),23:item('hammer',2),24:decoration('garden-cherry-tree'),27:item('shuffle'),29:decoration('garden-swing'),30:{kind:'guild-gift',item:'hammer',quantity:1}};
/** Exactly one prize per track/tier; season coin totals remain750/2250. */
export function passPrize(tier:number,track:PassTrack):PassPrize{
 if(!Number.isInteger(tier)||tier<1||tier>30)throw new RangeError('Invalid pass tier');
 return track==='free'?free[tier]??{kind:'coins',quantity:tier%5===1?50:25}:premium[tier]??{kind:'coins',quantity:150};
}
