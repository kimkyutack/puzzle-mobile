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
const premium:Record<number,PassPrize>={3:item('hammer',3),5:item('wind-row',3),6:decoration('garden-bench'),9:item('bomb',3),11:item('hammer',5),12:decoration('garden-lamp'),15:{kind:'profile',id:'season-gardener',quantity:1},17:item('rainbow',4),18:decoration('garden-blue-hydrangea'),20:item('sweep-row',3),23:item('hammer',6),24:decoration('garden-cherry-tree'),27:item('shuffle',3),29:decoration('garden-swing'),30:{kind:'guild-gift',item:'hammer',quantity:1}};
const premiumCoins:Record<number,number>={1:200,2:250,4:250,7:300,8:300,10:350,13:350,14:400,16:400,19:450,21:450,22:500,25:550,26:600,28:650};
/** One prize per track/tier: free750 coins; premium6000 coins and30 tools.
 * Revision2 is retained solely to display rewards already claimed before repricing. */
export function passPrize(tier:number,track:PassTrack,revision:2|3=3):PassPrize{
 if(!Number.isInteger(tier)||tier<1||tier>30)throw new RangeError('Invalid pass tier');
 if(track==='free')return free[tier]??{kind:'coins',quantity:tier%5===1?50:25};
 const reward=premium[tier]??{kind:'coins',quantity:premiumCoins[tier]!};
 if(revision===2&&reward.kind==='coins')return{kind:'coins',quantity:150};
 if(revision===2&&reward.kind==='item')return item(reward.item,reward.item==='hammer'?2:1);
 return reward;
}
