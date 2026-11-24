/** Home-only raster artwork matched to the approved concept. */
import mailbox from '../../../packages/assets/home-mailbox-v112/runtime/mailbox.webp';
import journal from '../../../packages/assets/home-refinement-v78/runtime/journal.webp';
import pass from '../../../packages/assets/home-refinement-v78/runtime/pass.webp';
import ranking from '../../../packages/assets/home-refinement-v78/runtime/ranking.webp';
import missions from '../../../packages/assets/home-refinement-v78/runtime/missions.webp';
import unlimited from '../../../packages/assets/home-contours-v81/runtime/unlimited.webp';
import rescue from '../../../packages/assets/home-contours-v81/runtime/rescue.webp';
import shop from '../../../packages/assets/home-contours-v81/runtime/shop.webp';
import friends from '../../../packages/assets/home-contours-v81/runtime/friends.webp';
import home from '../../../packages/assets/home-refinement-v78/runtime/home.webp';
import guild from '../../../packages/assets/home-contours-v81/runtime/guild.webp';
import events from '../../../packages/assets/home-contours-v81/runtime/events.webp';
import settings from '../../../packages/assets/home-icons-v76/runtime/settings.webp';
import festival from '../../../packages/assets/home-fidelity-v80/runtime/festival.webp';
import promo from '../../../packages/assets/home-icons-v76/runtime/promo.webp';
import rainbow from '../../../packages/assets/home-icons-v76/runtime/rainbow.webp';
import play from '../../../packages/assets/home-refinement-v78/runtime/play.webp';
import chainPromo from '../../../packages/assets/home-packages-v83/runtime/chain-promo.webp';
import avatar from '../../../packages/assets/home-refinement-v78/runtime/avatar.webp';
import homeNav from '../../../packages/assets/home-contours-v81/runtime/home-nav.webp';
import headerCoin from '../../../packages/assets/home-header-clean-v1/runtime/header-coin.webp';
import headerHeart from '../../../packages/assets/home-header-clean-v1/runtime/header-heart.webp';
import headerStar from '../../../packages/assets/home-header-clean-v1/runtime/header-star.webp';
import settingsAlert from '../../../packages/assets/home-refinement-v78/runtime/settings.webp';
import sourceGift from '../../../packages/assets/home-fidelity-v80/runtime/gift.webp';
export const homeIconUrls:Record<string,string>={
 'home-v76-journal':journal,
 'home-v76-mailbox':mailbox,
 'home-v76-pass':pass,
 'home-v76-ranking':ranking,
 'home-v76-missions':missions,
 'home-v76-unlimited':unlimited,
 'home-v76-rescue':rescue,
 'home-v76-shop':shop,
 'home-v76-friends':friends,
 'home-v76-home':home,
 'home-v76-home-nav':homeNav,
 'home-v76-guild':guild,
 'home-v76-events':events,
 'home-v76-gift':sourceGift,
 'home-v76-settings':settings,
 'home-v76-settings-alert':settingsAlert,
 'home-v76-festival':festival,
 'home-v76-promo':promo,
 'home-v76-chain-promo':chainPromo,
 'home-v76-avatar':avatar,
 'home-v76-header-coin':headerCoin,
 'home-v76-header-heart':headerHeart,
 'home-v76-header-star':headerStar,
 'home-v76-rainbow':rainbow,
 'home-v76-play':play,
};
export function homeIcon(name:string,fallback:string){const id='home-v76-'+name;return Object.hasOwn(homeIconUrls,id)?id:fallback;}
