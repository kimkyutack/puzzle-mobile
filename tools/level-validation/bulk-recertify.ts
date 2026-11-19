// Re-solves bulk templates whose stored winning proof no longer wins after an engine rule change.
// Board layouts stay the same; only the proof (and, if it got longer, the move budget) changes.
import {readFile,writeFile} from 'node:fs/promises';
import {replay,stateHash} from '@garden/core';
import {BULK_START,levelFromBulkEntry,bulkProfile,type BulkCatalogue} from '../../packages/content/src/bulk';
import {campaignMoveMargin} from '../../packages/content/src/campaign';
import {solve,type Solution} from './validate';
const dir='packages/content/src/',read=async(p:string)=>JSON.parse(await readFile(dir+p,'utf8'));
const catalogue=await read('bulk-catalogue.json') as BulkCatalogue,proofs=await read('bulk-proofs.json') as {templates:Solution[];stages:Array<[string,number]>};
const limits={easy:32,normal:42,hard:46,super:52,celebration:24};const changed=new Set<number>();
for(const [i,t] of catalogue.templates.entries()){
 const old=proofs.templates[i]!,r=replay(t.level,old.actions);
 if(r.accepted&&r.state.status==='won'&&stateHash(r.state)===old.hash)continue;
 let best:Solution|undefined;
 for(let keep=old.actions.length;keep>=0&&!best;keep--)for(const policy of ['goal','special'] as const){
  const s=solve({...t.level,moves:100},policy,old.actions.slice(0,keep));
  if(s.status==='won'&&!s.shuffles&&s.actions.length<=limits[t.beat]){best=s;break;}
 }
 if(!best)throw new Error(`UNSOLVED:${t.key}`);
 t.level.moves=Math.min(100,Math.max(t.level.moves,best.actions.length+campaignMoveMargin(t.beat)));t.steps=best.actions.length;
 const res=replay(t.level,best.actions);if(!res.accepted||res.state.status!=='won')throw new Error(`REPLAY:${t.key}`);
 proofs.templates[i]={...best,hash:stateHash(res.state),movesLeft:res.state.moves};changed.add(i);
 console.log(t.key,`${old.actions.length} -> ${best.actions.length} steps`);
}
// Published stages using a changed template: keep the move budget at least steps+margin, then refresh their checks.
for(const [at,entry] of catalogue.entries.entries()){
 if(!changed.has(entry[0]))continue;const id=at+BULK_START,t=catalogue.templates[entry[0]]!,beat=bulkProfile(id).beat;
 entry[1]=Math.max(entry[1],t.steps+campaignMoveMargin(beat)+(Math.floor(id/10)+id)%3);
 const level=levelFromBulkEntry(id,entry,t),r=replay(level,proofs.templates[entry[0]]!.actions);
 if(!r.accepted||r.state.status!=='won'||r.events.some(e=>e.type==='shuffle')||r.state.moves<campaignMoveMargin(level.campaign!.beat))throw new Error(`STAGE:${id}`);
 proofs.stages[at]=[stateHash(r.state),r.state.moves];
}
await writeFile(dir+'bulk-proofs.json',JSON.stringify(proofs));await writeFile(dir+'bulk-catalogue.json',JSON.stringify(catalogue));
console.log('recertified',changed.size);
