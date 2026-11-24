import {createGame} from '@garden/core';
import {COLORS,ENGINE_VERSION,type Special,type LevelDefinition} from '@garden/contracts';
export const powers:Special[]=['wind-column','glider','bomb','rainbow','beehive'];
const rows=[
 ['5355242','4410133','2020535','1001040','2311052','4502450','4251343'],
 ['1540523','5524223','2400512','0401022','5124013','4104310','5413252'],
 ['1213504','3110251','2001055','1330505','0240550','0223141','2553300'],
 ['4035204','3025251','3510100','4001004','3100110','1032053','1144215'],
 ['5023304','5224422','2134135','2001021','1121125','5335430','5234341'],
];
export function guideFixture(kind:Special,levelId=137){
 const k=powers.indexOf(kind),initial=rows[k]!.join('').split('').map((c,i)=>({id:i+1,kind:'normal' as const,color:COLORS[Number(c)]!}));
 const level:LevelDefinition={id:levelId,version:'context-guide-fixture',engineVersion:ENGINE_VERSION,width:7,height:7,colors:[...COLORS],moves:30,seed:101+k*97,shape:Array(49).fill(true),goals:[{kind:'berry',count:200,remaining:200}],obstacles:[],initial,difficulty:'normal',approved:true};
 return {level,state:createGame(level)};
}
