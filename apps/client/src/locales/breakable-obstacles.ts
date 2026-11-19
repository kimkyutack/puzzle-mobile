import {breakableCopy} from '../../../../packages/content/src/breakable-campaign-boards';
import type {BreakablePattern} from '../../../../packages/content/src/breakable-campaign-plan';

import {obstacleGardenCopy,type ObstacleGardenPattern} from '../../../../packages/content/src/obstacle-garden';
import {obstacleBankCopy} from '../../../../packages/content/src/obstacle-first';

const translations:Record<BreakablePattern,readonly [string,string,string,string]>={
 urns:['Pottery workshop','Match any color beside an urn or hit it with a power-up.','つぼの工房','隣で好きな色をそろえるか、特殊ブロックを当ててつぼを壊しましょう。'],
 statues:['Rabbit statue garden','Each small statue takes six hits. Use rockets and bombs to hit several statues at once.','ウサギ像の庭','小さな像はそれぞれ6回の打撃で壊れます。ロケットや爆弾でまとめて狙いましょう。'],
 'supply-urns':['Urn supply crates','Break a crate to reveal an urn in the same cell. Then break the urn to count it.','つぼの荷箱','荷箱を壊すと同じマスにつぼが現れます。つぼまで壊しましょう。'],
 crystals:['Crystal cavern','Hit the crystals directly with power-ups such as rockets or bombs.','水晶の洞窟','ロケットや爆弾などの特殊ブロックを水晶に直接当てましょう。'],
 'crystal-crates':['Crystal supply crates','Open the crates, then use power-ups to break the crystals inside.','水晶の荷箱','荷箱を開け、中の水晶を特殊ブロックで壊しましょう。'],
 'statue-court':['Statue and urn courtyard','Use bombs and rockets to hit large statues and scattered urns together.','像とつぼの中庭','爆弾やロケットで、大きな像と離れたつぼをまとめて狙いましょう。'],
 warehouse:['Garden storehouse','Open the crates and break the urns and crystals inside.','庭の倉庫','荷箱を開け、中のつぼや水晶を壊しましょう。'],
 'frozen-urns':['Frozen urn path','Break the urns to open a path, then clear the frost beneath them.','凍ったつぼの小道','つぼを壊して道を開き、床の霜を取り除きましょう。'],
 'magnet-yard':['Statues and magnet rails','Hit statues from any side and shorten magnet rails from their ends.','像と磁石のレール','像はどの方向からでも狙えます。磁石レールは端から縮めましょう。'],
 'seed-hall':['Seed delivery beyond the urns','Break the urns to open a path and guide the seeds down to the exits.','つぼの向こうへタネ運び','つぼを壊して通路を開き、タネを下の出口まで落としましょう。'],
};
export const breakableEntries=Object.entries(translations).flatMap(([pattern,[enName,enHint,jaName,jaHint]])=>{
 const [name,hint]=breakableCopy[pattern as BreakablePattern];
 return [[name,[enName,jaName]],[hint,[enHint,jaHint]]] as const;
});

const gardenTranslations:Record<ObstacleGardenPattern,readonly [string,string,string,string]>={
 'lantern-grove':['Starlight garden','Match beside lanterns or hit them with power-ups. Hit them once more after the star is revealed.','星明かりの庭','ランタンの隣でそろえるか、特殊ブロックを当てましょう。星が見えたらもう一度当てます。'],
 windmills:['Wind garden','Break green pouches to send seeds to matching windmills. Clear the pouches to break the windmills.','風の庭','緑の袋を壊すと、タネが対応する風車に飛びます。袋をすべて壊して風車を壊しましょう。'],
 'lantern-and-urn':['Lantern and urn courtyard','Hit lanterns once more after the stars appear. Use power-ups to hit lanterns and urns together.','ランタンとつぼの中庭','星が見えたランタンには、もう一度当てましょう。特殊ブロックでつぼとランタンをまとめて狙えます。'],
 'relay-grove':['Starlight wind path','Clear lanterns to open space and burst pouches to send seeds into the windmill.','星明かりの風の道','ランタンを壊して道を開け、袋から飛ぶタネで風車を壊しましょう。'],
 'lantern-vault':['Starlight storehouse','Break lanterns and the urns and crystals inside the crates. Crystals need a direct power-up hit.','星明かりの倉庫','ランタンと、荷箱の中にあるつぼや水晶を壊しましょう。水晶には特殊ブロックを直接当てます。'],
 'stone-grove':['Statue and lantern garden','Every hit weakens statues and lanterns. Use power-ups to damage several obstacles at once.','像とランタンの庭','打撃で像とランタンの耐久が減ります。特殊ブロックで複数の障害物をまとめて狙いましょう。'],
};
for(const [pattern,[enName,enHint,jaName,jaHint]]of Object.entries(gardenTranslations)){
 const [name,hint]=obstacleGardenCopy[pattern as ObstacleGardenPattern];
 breakableEntries.push([name,[enName,jaName]],[hint,[enHint,jaHint]]);
}
breakableEntries.push(['바람 씨앗으로 풍차를 타격해 주세요.',['Hit the windmill with wind seeds.','風のタネを風車に当てましょう。']]);
const bankTranslations={
 crate:['Crate bank','Match any color beside the crates or hit several at once with rockets and flower bombs.','木箱の丘','隣で好きな色をそろえるか、ロケットや花爆弾で木箱をまとめて壊しましょう。'],
 urn:['Urn patch','Match beside an urn or hit it with a power-up. A cracked urn breaks with one more hit.','つぼの畑','隣でそろえるか、特殊ブロックを当てましょう。ひびの入ったつぼはもう一度当てると壊れます。'],
 lantern:['Starlight lantern bank','Match beside a lantern or use a power-up. Once its star is visible, hit it once more.','星明かりのランタンの丘','隣でそろえるか、特殊ブロックを当てましょう。星が見えたランタンにはもう一度当てます。'],
} as const;
for(const key of ['crate','urn','lantern'] as const){
 const [name,hint]=obstacleBankCopy[key],[enName,enHint,jaName,jaHint]=bankTranslations[key];
 breakableEntries.push([name,[enName,jaName]],[hint,[enHint,jaHint]]);
}
