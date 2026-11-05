/** Offline evaluation only. Never publishes failed or unexamined candidates. */
import { createHash } from 'node:crypto';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { candidate } from '../../packages/content/src/candidates.ts';
import { solve } from './validate.ts';
import { CONTENT_VERSION, ENGINE_VERSION } from '@garden/contracts';
const engineSourceHash=createHash('sha256').update(await readFile('packages/game-core/src/index.ts')).digest('hex');
const results:Array<{sample:number;level:number;seed?:number;static?:string;goal?:string;special?:string}>=[];
for(let sample=0;sample<500;sample++){
 const id=31+sample%170,attempt=3+Math.floor(sample/170);
 try{const level=candidate(id,attempt);results.push({sample,level:id,seed:level.seed,goal:solve(level,'goal').status,special:solve(level,'special').status});}
 catch(error){results.push({sample,level:id,static:error instanceof Error?error.message:'STATIC_FAILURE'});}
 if((sample+1)%50===0)console.log(`Evaluated ${sample+1}/500 candidates`);
}
const admitted=results.filter(r=>!r.static),report={engineSourceHash,engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,samples:500,staticallyValid:admitted.length,policies:['goal','special'],trajectories:admitted.length*2,goalWins:admitted.filter(r=>r.goal==='won').length,specialWins:admitted.filter(r=>r.special==='won').length,publication:'Evaluation only. These candidates are not added to approved.json.',interpretation:'Bot outcomes are not human difficulty metrics. Unsolved candidates remain unverified, not proven impossible.',results};
await mkdir('output/verification',{recursive:true});await writeFile('output/verification/bot-evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined},null,2));
