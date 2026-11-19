import {chainCampaignCopy} from '../../../../packages/content/src/chain-campaign';

const translations=[
 ['Flower bomb beds','Set off the Flower Bombs and rockets in a chain to open the crates below.','花爆弾の花壇','並んでいる花爆弾とロケットを連鎖させて、下の木箱を開けましょう。'],
 ['Crossfire courtyard','Fire horizontal rockets to hit both sides and chain vertical rockets to break crates and urns.','交差ロケット広場','横ロケットで両側を狙い、縦ロケットを連鎖させて木箱とつぼを壊しましょう。'],
 ['Rainbow storehouse','Combine a Rainbow Lantern with a power-up to open supply crates, then break the urns inside.','虹の倉庫','虹のランタンと特殊ブロックを組み合わせて荷箱を開け、中のつぼまで壊しましょう。'],
 ['Glider squadron','Combine a Rainbow Lantern with a Seed Glider. The gliders will fan out and hit scattered obstacles.','グライダー編隊','虹のランタンとタネグライダーを組み合わせましょう。グライダーが散らばった障害物に飛んでいきます。'],
 ['Starlight fireworks','Chain Flower Bombs and rockets to reveal the stars, then hit the lanterns again.','星明かりの花火道','花爆弾とロケットを連鎖させて星を見せ、ランタンにもう一度当てましょう。'],
 ['Sparks among statues','Chain rockets and Flower Bombs from different directions to break the statues and crates.','石像の間の火花','さまざまな方向からロケットと花爆弾を連鎖させて、像と木箱を壊しましょう。'],
] as const;

export const chainCampaignEntries=chainCampaignCopy.flatMap(([name,hint],i)=>{
 const [enName,enHint,jaName,jaHint]=translations[i]!;
 return [[name,[enName,jaName]],[hint,[enHint,jaHint]]] as const;
});
