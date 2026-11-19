import {COLORS,FLOW_GRAVITY_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
export const EXPEDITION_BALANCE=[
 {colors:5,gates:6,crates:0,moves:16,minSolution:5,maxSolution:8},
 {colors:5,gates:8,crates:0,moves:20,minSolution:8,maxSolution:12},
 {colors:6,gates:11,crates:6,moves:25,minSolution:9,maxSolution:18},
 {colors:6,gates:14,crates:9,moves:29,minSolution:12,maxSolution:23},
 {colors:6,gates:18,crates:12,moves:33,minSolution:15,maxSolution:27},
 {colors:6,gates:20,crates:10,moves:35,minSolution:15,maxSolution:27},
 {colors:6,gates:22,crates:12,moves:38,minSolution:16,maxSolution:29},
 {colors:6,gates:24,crates:14,moves:40,minSolution:17,maxSolution:30},
 {colors:6,gates:25,crates:13,moves:42,minSolution:18,maxSolution:32},
 {colors:6,gates:28,crates:14,moves:45,minSolution:19,maxSolution:34},
] as const;
/** Dedicated woodland routes, independent of the normal campaign's floor recipes. */
export function animalExpeditionCandidate(stage:number,seed:number):LevelDefinition {
 const balance=EXPEDITION_BALANCE[stage-1];if(!balance)throw Error('INVALID_EXPEDITION_STAGE');
 const at=(x:number,y:number)=>y*9+x,channels:number[]=[];
 const line=(x:number,y:number,toX:number,toY:number)=>{const dx=Math.sign(toX-x),dy=Math.sign(toY-y);for(;;){const cell=at(x,y);if(channels.at(-1)!==cell)channels.push(cell);if(x===toX&&y===toY)break;x+=dx;y+=dy;}};
 if(stage===1){line(0,2,6,2);line(6,2,6,7);}
 else if(stage===2){line(8,1,1,1);line(1,1,1,6);line(1,6,7,6);}
 else if(stage===3){line(0,7,3,7);line(3,7,3,2);line(3,2,8,2);}
 else if(stage===4){line(8,7,2,7);line(2,7,2,4);line(2,4,6,4);line(6,4,6,1);}
 else if(stage===5){line(0,1,6,1);line(6,1,6,3);line(6,3,2,3);line(2,3,2,6);line(2,6,8,6);line(8,6,8,8);}
 else if(stage===6){line(8,0,8,2);line(8,2,1,2);line(1,2,1,5);line(1,5,7,5);line(7,5,7,8);line(7,8,3,8);}
 else if(stage===7){line(0,8,0,1);line(0,1,5,1);line(5,1,5,3);line(5,3,2,3);line(2,3,2,7);line(2,7,8,7);}
 else if(stage===8){line(0,0,7,0);line(7,0,7,3);line(7,3,1,3);line(1,3,1,6);line(1,6,6,6);line(6,6,6,8);}
 else if(stage===9){line(8,8,1,8);line(1,8,1,5);line(1,5,7,5);line(7,5,7,2);line(7,2,2,2);line(2,2,2,0);}
 else if(stage===10){line(0,8,0,0);line(0,0,8,0);line(8,0,8,6);line(8,6,3,6);line(3,6,3,2);line(3,2,6,2);}
 else throw Error('INVALID_EXPEDITION_STAGE');
 const eligible=channels.slice(1,-1),gates=Array.from({length:balance.gates},(_,i)=>eligible[Math.floor(i*(eligible.length-1)/(balance.gates-1))]!);
 const places=[[2,2],[6,2],[4,4],[2,6],[6,6],[4,1],[1,4],[7,4],[4,7],[1,1],[7,7],[7,1],[1,7],[3,3],[5,5],[5,3],[3,5],[4,8],[0,4],[8,4]].map(([x,y])=>at(x!,y!)).filter(cell=>!channels.includes(cell));
 const hp=stage>=4?2:1,obstacles=places.slice(0,balance.crates).map((cell,index)=>({id:'woodland-log-'+index,kind:'crate' as const,hp,maxHp:hp,anchor:cell,footprint:[cell]}));
 return {id:900000+stage,version:stage<=5?'woodland-friends-v2':'woodland-friends-v3',engineVersion:FLOW_GRAVITY_ENGINE_VERSION,width:9,height:9,colors:COLORS.slice(0,balance.colors),moves:balance.moves,seed,shape:Array(81).fill(true),goals:[{kind:'garden-route',count:1,remaining:1}],obstacles,gardenStage:{kind:'animal',source:channels[0]!,channels,gates,destinations:[channels.at(-1)!]},difficulty:stage>=4?'hard':'normal',approved:true};
}
