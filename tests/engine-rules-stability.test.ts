import {describe,it,expect,vi} from 'vitest';
// A future server may add another default without changing the retained v1.3 rules.
vi.mock('@garden/contracts',async original=>({...await original<typeof import('@garden/contracts')>(),ENGINE_VERSION:'9.0.0'}));
import {getLevel,bridgeLevel} from '@garden/content';
import {replay,stateHash} from '@garden/core';
import type {Action} from '@garden/contracts';
import proofs from '../packages/content/src/campaign-solutions.json';
import rescueProof from './fixtures/daily-rescue-proof.json';
describe('retained rules independently of the current server engine',()=>{
 it('preserves authored campaign and compound-mechanic maps when the server default changes',()=>{
  for(const id of [1,201,251,294]){
   const level=getLevel(id,'1.3.0'),proof=(proofs as Record<string,{actions:Action[];hash:string}>)[id]!,result=replay(level,proof.actions);
   expect(level.engineVersion).toBe('1.3.0');expect(result.state.status).toBe('won');expect(stateHash(result.state)).toBe(proof.hash);
  }
 });
 it('keeps the daily rescue replay on its retained rules when the server default changes',()=>{
  const level=bridgeLevel(),result=replay(level,rescueProof as Action[]);
  expect(level.engineVersion).toBe('1.3.0');expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');
 });
});
