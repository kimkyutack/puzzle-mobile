import {frontierCopy} from '../../../../packages/content/src/garden-frontier';
const translated={
 shelf:[['Flower vase shelves','花瓶の棚'],['Make matches of 3 or more next to the vases, or hit them with tools. Collect all eight vases to collapse their shelf and open a wide path.','花瓶の隣で3個以上そろえるか、アイテムを使いましょう。8個の花瓶をすべて集めると棚が崩れ、広い道が開きます。']],
 shade:[['Greenhouse awnings','温室の日よけ'],['Break a winch to roll up its awning row. The orchids remain visible from the start; collect them with matches of 3 or more and tools after their awning opens.','巻き上げ機を壊すと、その列の日よけが開きます。最初から透けて見えるランを、日よけが開いた後に3個以上のマッチやアイテムで集めましょう。']],
 expedition:[['Two-area garden expedition','2エリアの庭園探検'],['Clear the flowering vines at the entrance to enter the greenhouse. Use your remaining moves to collect every amber lotus in the second area.','入口の花づるをすべて片づけると温室に入れます。残りの移動回数で、次のエリアの琥珀のハスをすべて集めましょう。']],
} as const;
export const frontierEntries=(Object.keys(frontierCopy) as (keyof typeof frontierCopy)[]).flatMap(kind=>[
 [frontierCopy[kind][0],translated[kind][0]],[frontierCopy[kind][1],translated[kind][1]],
] as const);
