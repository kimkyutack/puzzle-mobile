// Read-only content verification: no app/Worker/native build and no publication.
import {mkdir,writeFile} from 'node:fs/promises';
import {PERPENDICULAR_ROCKET_ENGINE_VERSION as ENGINE_VERSION,type Action,type LevelDefinition} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {replay,stateHash} from '@garden/core';
import {solve} from './level-validation/validate';
import oldAuthored from '../packages/content/src/campaign-solutions.json';
import bulk from '../packages/content/src/bulk-catalogue.json';
import oldBulk from '../packages/content/src/bulk-proofs.json';
const authored=oldAuthored as Record<string,{actions:Action[]}>;
const minimumMoves=new Map<number,number>();
for(const entry of bulk.entries)minimumMoves.set(entry[0]!,Math.min(minimumMoves.get(entry[0]!)??100,entry[1]!));
const cases:Array<{key:string;level:LevelDefinition;actions:Action[]}>=Array.from({length:300},(_,i)=>({key:String(i+1),level:getLevel(i+1,ENGINE_VERSION),actions:authored[i+1]!.actions}));
if(!process.argv.includes('--authored-only'))for(const [i,template]of bulk.templates.entries())cases.push({key:'template/'+i,level:{...structuredClone(template.level) as LevelDefinition,engineVersion:ENGINE_VERSION,moves:minimumMoves.get(i)??template.level.moves},actions:oldBulk.templates[i]!.actions as Action[]});
const checks=[],failures=[];
for(const item of cases){
 let actions=item.actions,result=replay(item.level,actions),method='retained-actions';
 if(!result.accepted||result.state.status!=='won')for(const policy of ['goal','special'] as const){const candidate=solve(item.level,policy);if(candidate.status==='won'){actions=candidate.actions;result=replay(item.level,actions);method=policy;break;}}
 if(!result.accepted||result.state.status!=='won')failures.push(item.key);
 else checks.push({key:item.key,method,moves:item.level.moves,movesLeft:result.state.moves,hash:stateHash(result.state),actions});
 if((checks.length+failures.length)%50===0)console.log(JSON.stringify({checked:checks.length+failures.length,total:cases.length,failed:failures.length}));
}
await mkdir('output/verification/tutorial-input',{recursive:true});
await writeFile('output/verification/tutorial-input/rocket-content-check.json',JSON.stringify({engineVersion:ENGINE_VERSION,build:false,deploy:false,checked:cases.length,failures,checks},null,2));
console.log(JSON.stringify({engineVersion:ENGINE_VERSION,checked:cases.length,failures}));
if(failures.length)process.exitCode=1;
