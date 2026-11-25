import profileEmblem from '../../../packages/assets/pass-special-rewards-v130/runtime/profile-emblem.webp';
import guildGiftVoucher from '../../../packages/assets/pass-special-rewards-v130/runtime/guild-gift-voucher.webp';

export function PassSpecialRewardImage({kind}:{kind:'profile'|'guild-gift'}){
 return <img className="pass-prize-image pass-special-reward-image" data-pass-reward={kind} src={kind==='profile'?profileEmblem:guildGiftVoucher} alt="" draggable={false}/>;
}
