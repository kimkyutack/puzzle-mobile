import type {ChapterObstacleKind} from './chapter-obstacles';

type Copy=readonly [name:string,hint:string];
export const chapterCopy:Record<ChapterObstacleKind,readonly [ko:Copy,en:Copy,ja:Copy]>={
 'long-match':[
  ['잎맥 자물쇠','옆에서 타일을 네 개 이상 맞추거나 특수 블록으로 타격하세요.'],
  ['Long-match locks','Match four or more next to a lock, or hit it with a power-up.'],
  ['葉脈の錠','隣で4つ以上そろえるか、特殊ブロックを当てましょう。']],
 cascade:[
  ['낙화 수정','타일이 떨어진 뒤 새로 생기는 연쇄 매치나 특수 블록으로 깨세요.'],
  ['Cascade crystals','Hit a crystal with a match made by falling tiles, or use a power-up.'],
  ['連鎖の結晶','落下後にできた連鎖マッチか、特殊ブロックで壊しましょう。']],
 axis:[
  ['교차 수문','표시된 가로 또는 세로 방향으로 옆에서 맞추세요. 타격 후 방향이 바뀌며 특수 블록도 피해를 줘요.'],
  ['Cross-grain gates','Match next to the gate along the marked axis. The axis flips after a hit. Power-ups also work.'],
  ['交差する水門','印の縦横に合わせて隣でそろえましょう。攻撃のたびに向きが変わります。特殊ブロックも有効です。']],
 diagonal:[
  ['대각선 종','종의 대각선에 닿는 매치를 만들거나 특수 블록으로 직접 맞히세요.'],
  ['Diagonal bells','Match diagonally beside a bell, or strike it with a power-up.'],
  ['斜めのベル','斜め隣でそろえるか、特殊ブロックを直接当てましょう。']],
 'two-colors':[
  ['겹빛 인장','한 수 안에 옆에서 서로 다른 두 색을 맞추세요. 연쇄 매치도 세며 특수 블록은 바로 타격해요.'],
  ['Two-color seals','Match two different colors beside a seal in one move. Cascades count, and power-ups hit directly.'],
  ['二色の印','一手で隣に異なる2色をそろえましょう。連鎖も数え、特殊ブロックは直接効きます。']],
 guard:[
  ['덧댄 화단','옆에 붙은 나무 상자를 전부 깨면 안쪽 화단을 타격할 수 있어요.'],
  ['Guarded beds','Remove every wooden crate touching a bed to expose it.'],
  ['木箱に囲まれた花壇','隣接する木箱をすべて壊すと花壇を攻撃できます。']],
 cooldown:[
  ['숨 고르는 항아리','한 수에 한 겹만 깨져요. 금이 가면 다음 수에 다시 타격하세요.'],
  ['Cooling jars','Each move can break one layer. Hit a cracked jar again on a later move.'],
  ['休息する壺','一手で壊せるのは一層です。ひびが入ったら次の手以降に当てましょう。']],
 window:[
  ['이슬 봉인','첫 타격 뒤 두 수 안에 마저 깨세요. 기한을 넘기면 금이 메워져요.'],
  ['Dew seals','Finish the seal within two moves of its first hit. Otherwise it repairs itself.'],
  ['露の封印','最初の攻撃から二手以内に壊しましょう。間に合わないとひびが直ります。']],
 slide:[
  ['밀림 항아리','첫 타격에 옆 칸으로 밀려납니다. 옮긴 위치를 다시 맞히세요.'],
  ['Sliding jars','The first hit pushes the jar to a free neighboring space. Strike its new position.'],
  ['ずれる壺','最初の攻撃で横にずれます。移動先をもう一度攻撃しましょう。']],
 landing:[
  ['낙하 받침대','바로 위 칸에 타일을 떨어뜨리거나 특수 블록으로 맞히세요.'],
  ['Drop pads','Drop a tile into the space immediately above the pad, or use a power-up.'],
  ['落下台','真上にブロックを落とすか、特殊ブロックを当てましょう。']],
 relay:[
  ['연쇄 꽃등','꽃등을 깨면 세 칸 안에서 가장 가까운 꽃등으로 타격을 보내요.'],
  ['Relay lanterns','Breaking a lantern sends a hit to the closest lantern within three spaces.'],
  ['連鎖ランタン','壊すと3マス内で最も近いランタンに攻撃が伝わります。']],
 compost:[
  ['물드는 꽃단지','꽃단지를 깨면 바로 옆 타일이 마지막 매치의 색으로 물들어요. 특수 블록으로 깨면 초록색이에요.'],
  ['Dye pots','Break a pot to dye touching tiles the match color. Power-ups dye them green.'],
  ['染め壺','壊すと隣のブロックがマッチの色に染まります。特殊ブロックで壊すと緑になります。']],
 junction:[
  ['갈림길 석판','옆에서 ㄱ자나 T자로 맞춰 폭탄을 만들거나 특수 블록으로 타격하세요.'],
  ['Junction tablets','Make an L or T match beside the tablet to form a bomb, or hit it with a power-up.'],
  ['分岐の石板','隣でL字かT字にそろえて爆弾を作るか、特殊ブロックを当てましょう。']],
 fusion:[
  ['합체 수정','특수 블록 두 개를 서로 바꿔 합체 효과로 수정을 맞히세요.'],
  ['Fusion crystals','Swap two power-ups to combine them and strike the crystals.'],
  ['合体の結晶','特殊ブロックを2つ入れ替えて合体させ、結晶に当てましょう。']],
 thaw:[
  ['서리 울타리','옆에 붙은 얼음을 모두 깨고 울타리를 타격하세요.'],
  ['Frost fences','Clear all touching frost before attacking the fence.'],
  ['霜の柵','隣接する霜をすべて除いてから柵を攻撃しましょう。']],
 swap:[
  ['교환 발판','발판 바로 옆의 타일을 움직여 매치를 만들거나 특수 블록으로 맞히세요.'],
  ['Swap plates','Swap a touching tile to make a valid match, or hit the plate with a power-up.'],
  ['入れ替え板','隣のブロックを動かしてそろえるか、特殊ブロックを当てましょう。']],
 'color-wave':[
  ['색물결 단지','단지를 깬 매치와 같은 색의 타일이 보드 전체에서 사라져요. 특수 블록으로 깨면 초록 타일이 사라져요.'],
  ['Color-wave jars','Breaking a jar clears its match color across the board. Power-ups clear green tiles.'],
  ['色波の壺','壊したマッチと同じ色が盤面全体から消えます。特殊ブロックで壊すと緑が消えます。']],
};
