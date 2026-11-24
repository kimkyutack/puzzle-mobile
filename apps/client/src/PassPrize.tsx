import type {PassPrize as Prize} from '../../../packages/contracts/src/pass-rewards';
import {DECORATIONS} from '../../../packages/garden-world/src/catalog';
import {WORLD_ART} from './garden-world/assets';
import {Icon} from './ui';
import {itemName,tr} from './i18n';

export function passPrizeName(prize:Prize){
 return prize.kind==='coins'?tr('코인'):prize.kind==='item'?itemName(prize.item):prize.kind==='decoration'?tr(DECORATIONS.find(item=>item.id===prize.itemId)?.name??prize.itemId):tr(prize.kind==='profile'?'시즌 정원사 문장':'길드 선물권');
}
export function PassPrizeImage({prize}:{prize:Prize}){
 return prize.kind==='decoration'?<img className="pass-prize-image is-decoration" src={WORLD_ART[prize.itemId]} alt="" draggable={false}/>:<Icon id={prize.kind==='coins'?'coin':prize.kind==='item'?prize.item:prize.kind==='profile'?'star':'guild'} size={48}/>;
}
