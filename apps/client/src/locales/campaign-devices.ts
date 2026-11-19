import {deviceCopy} from '../../../../packages/content/src/long-campaign-boards';
import type {CampaignDeviceKind} from '../../../../packages/contracts/src/campaign-devices';

const translations:Record<CampaignDeviceKind,readonly [string,string,string,string]>={
 switch:['Linked switch','Make matches in the marked area to open the gate.','連動スイッチ','マークされたエリアでマッチを作り、門を開けましょう。'],
 branch:['Branch valve','Match in either zone, then match in the other one.','分岐バルブ','どちらかでマッチを作り、次は反対のエリアでそろえましょう。'],
 conveyor:['Conveyor','Pieces move one space along the arrows each turn. Plan matches around where they will land.','コンベア','一手ごとに矢印の方向にブロックが進みます。移動先でのマッチを狙いましょう。'],
 charge:['Color charger','Match at least two different colors in the marked area on one turn to charge it.','色の充電器','一手でエリア内に2色以上のマッチを作ると充電されます。'],
 switchback:['Alternating switch','Match in alternating zones. The brighter one is next.','交互スイッチ','2つのエリアで交互にそろえましょう。次に狙うエリアは明るく表示されます。'],
 fuse:['Fusion circuit','Swap two power-ups in the marked area.','合成回路','マークされたエリアで特殊ブロック同士を入れ替えましょう。'],
 dual:['Double switch','Make a separate match in each zone on the same turn.','同時スイッチ','一手で両方のエリアに別々のマッチを作りましょう。'],
 cascade:['Cascade sensor','Set up a follow-up match after pieces fall into the marked area.','連鎖センサー','ブロックが落ちたあと、マークされたエリアで連鎖を起こしましょう。'],
 relay:['Color relay','Match in the first zone, then match the same color in the other zone.','色のリレー','最初のエリアでそろえた色と同じ色を、反対のエリアでそろえましょう。'],
 fall:['Drop sensor','Clear below the marked area so pieces fall into it.','落下センサー','下のブロックを消して、マークされたエリアにブロックを落としましょう。'],
 rocket:['Launch pad','Activate a horizontal or vertical rocket in the marked area.','ロケット発射台','マークされたエリアで横または縦ロケットを使いましょう。'],
 forge:['Flower bomb workshop','Make an L- or T-shaped match to create a Flower Bomb in the marked area.','花爆弾工房','L字かT字のマッチを作り、マークされたエリアに花爆弾を作りましょう。'],
 pollinate:['Sky garden','Activate a glider or a beehive in the marked area.','空中庭園','マークされたエリアでグライダーかハチの巣を使いましょう。'],
 streak:['Streak switch','Match in the marked area on consecutive turns. A missed turn resets your progress.','連続スイッチ','マークされたエリアで連続してそろえましょう。途切れると最初からやり直しです。'],
 'twin-plates':['Twin plates','Put matching colors on plates with the same number. A swap can align them without a match of three.','ペアの台座','同じ番号の台座に同じ色を置きましょう。3つのマッチができなくても、色がそろえば入れ替えられます。'],
 portal:['Twin portals','Move a block onto a portal to send it to the other portal. Make a match where it arrives.','双子のポータル','ポータルにブロックを入れると反対側に移動します。到着先でマッチを作りましょう。'],
 dye:['Garden stencil','Match in the gold area to dye the blocks in the blue stencil. Make a new match in the stencil.','庭の染め型','金色のエリアでそろえた色で青い染め型のブロックを染めます。染め型で新しいマッチを作りましょう。'],
 scale:['Petal scales','Fill both pans with the same number of blocks from direct matches. An overflowing pan empties.','花びらのはかり','両方のエリアで直接マッチを作り、同じ数のブロックを集めましょう。上限を超えた皿は空になります。'],
 mirror:['Mirror beds','Match blocks in a marked area to clear their mirror positions on the other side.','鏡の花壇','マークされたエリアでマッチを作ると、反対側の対称位置も消えます。'],
 turntable:['Turntable','Tap a normal block on the turntable to rotate all four blocks clockwise. Make a match with the rotation.','回転台','回転台の通常ブロックをタップすると4つのブロックが時計回りに動きます。回転でマッチを作りましょう。'],
 keys:['Linked keys','Clear the block on a numbered key to open the chest with the same number.','番号付きの鍵','鍵のマスにあるブロックを消すと、同じ番号の箱が開きます。'],
 pollen:['Pollen marks','Clear blocks carrying pollen. The pollen follows each block when it moves or falls.','花粉の印','花粉のついたブロックを消しましょう。花粉は移動や落下でもブロックについていきます。'],
 carrier:['Launch platform','Swap a power-up with a normal block to move it without firing. Move it onto a platform and tap it.','運搬発射台','特殊ブロックを通常ブロックと入れ替えると発射せずに移動できます。発射台に乗せてタップしましょう。'],
 echo:['Echo beds','Activate a power-up in the marked area. On your next move the surrounding blocks are hit again.','残響の花壇','マークされたマスで特殊ブロックを使うと、次の一手で周囲がもう一度破壊されます。'],
 reflector:['Rocket reflector','When a rocket hits a mirror, one side of its path turns at a right angle. Fire a rocket aligned with the mirror.','反射ロケット','ロケットが鏡に当たると片側の進路が直角に曲がります。鏡と同じ列か行からロケットを発射しましょう。'],
 updraft:['Updraft well','Blocks rise from below. Send blocks upward into the marked cells.','上昇気流の井戸','ブロックは下から上へ移動します。マークされた上のマスへブロックを送りましょう。'],
};

export const campaignDeviceEntries=Object.entries(translations).flatMap(([kind,[enName,enHint,jaName,jaHint]])=>{
 const [name,hint]=deviceCopy[kind as CampaignDeviceKind];
 return [[name,[enName,jaName]],[hint,[enHint,jaHint]]] as const;
}).concat([
 ['장치 작동',['Activate devices','装置を動かす']],
 ['장치 문',['Device gate','装置の門']],
 ['표시된 장치를 작동시켜 문을 열어 주세요.',['Activate the marked device to open this gate.','マークされた装置を動かして門を開けましょう。']],
]);
