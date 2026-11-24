import {circuitCopy} from '../../../../packages/content/src/garden-circuit';
const copy={
 rail:[['Flowerpot conveyor','植木鉢の運搬レール'],['Match 3 or more or use tools to break the flowerpots. After every move, the pots circulate along their rail. Collect every pot on one rail to open that path.','3個以上のマッチやアイテムで植木鉢を壊しましょう。移動するたびに植木鉢がレールを巡り、そのレールの鉢をすべて集めると道が開きます。']],
 boomerang:[['Petal boomerang siege','花びらブーメラン攻城戦'],['Make matches of 3 or more next to petal pods, or hit them with tools. Break a pod to release a boomerang that strikes three living garden bells in sequence before returning.','花びらのさやの隣で3個以上そろえるか、アイテムでたたきましょう。さやを壊すとブーメランが現れ、残っている庭園ベル3か所を順にたたいて戻ります。']],
 crystal:[['Linked flower crystals','つながる花水晶の群落'],['Hit crystals with matches of 3 or more and tools. Fully break one crystal to shatter its connected group. Attack each group separately.','3個以上のマッチやアイテムで水晶をたたきましょう。1個を完全に壊すと、つながった群落が一緒に砕けます。群落ごとに攻略しましょう。']],
} as const;
export const circuitEntries=(Object.keys(circuitCopy) as (keyof typeof circuitCopy)[]).flatMap(kind=>[
 [circuitCopy[kind][0],copy[kind][0]],[circuitCopy[kind][1],copy[kind][1]],
] as const);
