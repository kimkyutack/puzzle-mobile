import {gardenPuzzleCopy} from '../../../../packages/content/src/garden-puzzles';
import {densePuzzleHints} from '../../../../packages/content/src/dense-garden-puzzles';
import {GARDEN_PUZZLE_KINDS,type GardenPuzzleKind} from '../../../../packages/contracts/src/garden-puzzles';

const translations:Record<GardenPuzzleKind,readonly [string,string,string,string]>={
 domino:['Domino fence','Hit a slat with a power-up and watch it topple the next one in its arrow’s direction. The chain stops at a gap.','ドミノの柵','特殊ブロックを板に当てると矢印の方向に倒れます。すき間があると連鎖が止まります。'],
 cart:['Garden carts','Slide a cart one cell at a time to a dock. Clear the crates blocking its path first.','庭の手押し車','手押し車を1マスずつ動かし、荷台まで運びましょう。道をふさぐ木箱を先に壊します。'],
 soil:['Splitting soil','Horizontal rockets split clods left and right. Vertical rockets split them up and down. Break the small pieces too.','割れる土のかたまり','横ロケットで左右、縦ロケットで上下に土が割れます。小さなかけらまで壊しましょう。'],
 shadow:['Shadow beds','Hit a lamp to turn it on. Crates block its beam. You can only hit buds that are in the light.','影の花壇','明かりに特殊ブロックを当てましょう。木箱は光をさえぎります。照らされたつぼみに攻撃が当たります。'],
 wire:['Wire-covered pots','Rockets cut the wires in their own direction. A cross-rocket cuts both layers and a Flower Bomb cuts one.','金網の花壇','ロケットと同じ向きの金網が切れます。十字ロケットは両方、花爆弾は一方を切ります。'],
 fence:['Fenced beds','Match or hit the marked cells to build fence posts. Close a loop to clear thickets inside.','柵の花壇','印のマスでマッチするか特殊ブロックを当てて柵を立てましょう。輪が閉じると中の茂みが消えます。'],
};

export const gardenPuzzleEntries=GARDEN_PUZZLE_KINDS.flatMap<readonly [string,readonly [string,string]]>(kind=>{
 const [name,hint]=gardenPuzzleCopy[kind], [enName,enHint,jaName,jaHint]=translations[kind];
 return [[name,[enName,jaName]],[hint,[enHint,jaHint]]] as const;
});
gardenPuzzleEntries.push(
 [densePuzzleHints.cart!,['Push from the back to move touching carts together. Deliver the carts to the gold docks.','後ろから押すと、つながった手押し車が列ごと動きます。金色の荷台まで運びましょう。']],
 [densePuzzleHints.soil!,['A clod splits along the rocket’s path. When space is blocked, pieces stack in place. Break all the small pieces.','ロケットの向きに土が割れます。周りが埋まっていると、そのマスにかけらが重なります。すべて壊しましょう。']],
 [densePuzzleHints.shadow!,['Start with the top row. The first rocket turns on the lamp, and the next rocket hits the buds in its light.','上の段からロケットを発射しましょう。最初のロケットで明かりをつけ、次のロケットでつぼみを狙います。']],
);
