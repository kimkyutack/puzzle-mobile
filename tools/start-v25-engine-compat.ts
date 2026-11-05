import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action} from '@garden/contracts';
// The exact deployed v24 engine source is the compatibility oracle, not a regenerated board.
const deployed=await import(pathToFileURL(resolve('output/garden-directions-worker-v24/packages/game-core/src/index.ts')).href) as typeof import('@garden/core');
const proofs=JSON.parse(await readFile('packages/content/src/legacy-solutions-v12.json','utf8')) as Record<string,{actions:Action[]}>;
let levels=0,actions=0;
for(const [id,proof]of Object.entries(proofs)){
 const level=getLevel(Number(id),'1.2.0');let current=createGame(level),baseline=deployed.createGame(level);assert.equal(stateHash(current),deployed.stateHash(baseline));
 for(const action of proof.actions){const a=applyAction(current,action),b=deployed.applyAction(baseline,action);assert.equal(a.accepted,true);assert.equal(a.accepted,b.accepted);assert.deepEqual(a.events,b.events);assert.equal(stateHash(a.state),deployed.stateHash(b.state));current=a.state;baseline=b.state;actions++;}levels++;
}
await mkdir('output/verification/special-v25',{recursive:true});const report={at:new Date().toISOString(),passed:true,levels,actions,baseline:'output/garden-directions-worker-v24/packages/game-core/src/index.ts',engine:'1.2.0',checked:'initial state and every accepted action, event list and state hash'};await writeFile('output/verification/special-v25/engine-compat.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
