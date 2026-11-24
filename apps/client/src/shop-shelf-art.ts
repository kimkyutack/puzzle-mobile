import coin1000 from '../../../packages/assets/shop-shelves-v95/runtime/coin-1000.webp';
import coin2500 from '../../../packages/assets/shop-shelves-v95/runtime/coin-2500.webp';
import coin6000 from '../../../packages/assets/shop-shelves-v95/runtime/coin-6000.webp';
import coin15000 from '../../../packages/assets/shop-shelves-v95/runtime/coin-15000.webp';
import coin40000 from '../../../packages/assets/shop-shelves-v95/runtime/coin-40000.webp';
import coin100000 from '../../../packages/assets/shop-shelves-v95/runtime/coin-100000.webp';

/** Artwork follows the real catalog amount; unknown packs retain the legacy icon. */
const coinPacks:Record<number,string>={1000:coin1000,2500:coin2500,6000:coin6000,15000:coin15000,40000:coin40000,100000:coin100000};
export const shopCoinArt=(coins:number)=>coinPacks[coins];
