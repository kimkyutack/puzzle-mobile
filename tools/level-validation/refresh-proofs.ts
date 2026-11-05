import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createGame,legalActions,replay,stateHash} from '@garden/core';
import type {LevelDefinition} from '@garden/contracts';
import {solve,type Solution} from './validate';

// A rule fix can change cascades. Re-certify fixed, published boards without regenerating layouts.
const source=await readFile('packages/content/src/approved.json','utf8');
const levels=JSON.parse(source) as LevelDefinition[],old=JSON.parse(await readFile('packages/content/src/solutions.json','utf8')) as Record<string,Solution>,updated:Record<string,Solution>={};
const report:Array<{id:number;method:string;hashChanged:boolean}>=[];
for(const level of levels){
 const previous=old[level.id]!,replayed=replay(level,previous.actions);
 let chosen:Solution|undefined,method='existing-actions';
 if(replayed.accepted&&replayed.state.status==='won'&&!replayed.events.some(e=>e.type==='shuffle'))chosen={...previous,status:'won',hash:stateHash(replayed.state),movesLeft:replayed.state.moves,shuffles:0,initialChoices:legalActions(createGame(level)).length};
 else for(const policy of ['goal','special'] as const){const candidate=solve(level,policy);if(candidate.status==='won'&&!candidate.shuffles){chosen=candidate;method='fixed-board-'+policy;break;}}
 if(!chosen)throw new Error('NO_FIXED_LAYOUT_PROOF:'+level.id);
 const checked=replay(level,chosen.actions);if(!checked.accepted||checked.state.status!=='won'||stateHash(checked.state)!==chosen.hash)throw new Error('PROOF_MISMATCH:'+level.id);
 updated[level.id]=chosen;report.push({id:level.id,method,hashChanged:previous.hash!==chosen.hash});
 if(level.id%20===0)console.log(`Verified fixed layouts ${level.id}/200`);
}
if(await readFile('packages/content/src/approved.json','utf8')!==source)throw new Error('LAYOUT_CHANGED_DURING_VERIFICATION');
await writeFile('packages/content/src/solutions.json',JSON.stringify(updated));
await writeFile('output/verification/special-swap-proofs.json',JSON.stringify({approvedLayoutSha256:createHash('sha256').update(source).digest('hex'),levelDefinitionsChanged:false,checks:report,passed:report.length},null,2));
console.log(JSON.stringify({passed:report.length,updatedHashes:report.filter(r=>r.hashChanged).length,newActionLogs:report.filter(r=>r.method!=='existing-actions').length,levelDefinitionsChanged:false}));
