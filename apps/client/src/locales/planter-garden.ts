import {planterGardenCopy} from '../../../../packages/content/src/planter-garden';

const translations=[
 ['Greenhouse sluices','Fire the placed horizontal rockets to open the sluices. Break the pots once their matching mud covers wash away.','温室の水門','配置された横ロケットで水門を開き、同じ印の鉢を覆う泥が流れたら鉢を壊しましょう。'],
 ['Vine-wrapped pots','Hit a vine knot with a rocket or Flower Bomb to free the pots with its marker. Then break each pot.','つるに覆われた鉢','ロケットや花爆弾で結び目を切って同じ印の鉢を解放し、一つずつ壊しましょう。'],
 ['Rotating pot shelves','Hit a shelf with a rocket to reveal its pots. A vertical rocket appears in the shelf’s former cell.','花の回転棚','ロケットを棚に当てると鉢が現れ、棚があったマスに縦ロケットが出ます。'],
 ['Sluices and vines','Open the sluice to wash off mud and hit the knot to release vines. Clear the exposed pots with Flower Bombs.','水路とつる','水門を開いて泥を流し、結び目を切ってつるを外しましょう。現れた鉢は花爆弾でまとめて壊せます。'],
 ['Greenhouse cleanup','Open the sluice, cut the knot, and use the shelf’s vertical rocket to clear the pots in the center.','温室の大掃除','水門を開き、結び目を切りましょう。棚から出た縦ロケットで中央の鉢を壊せます。'],
] as const;

export const planterGardenEntries=planterGardenCopy.flatMap<readonly [string,readonly [string,string]]>(([name,hint],i)=>{
 const [enName,enHint,jaName,jaHint]=translations[i]!;
 return [[name,[enName,jaName]],[hint,[enHint,jaHint]]] as const;
});
planterGardenEntries.push(['연결된 장치를 먼저 맞혀 화분을 드러내 주세요.',['Hit the linked device to uncover the pot first.','先につながっている仕掛けを攻撃して鉢を出しましょう。']]);
