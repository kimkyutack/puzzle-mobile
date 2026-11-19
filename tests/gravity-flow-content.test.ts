import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,ENDPOINT_PIPE_ENGINE_VERSION,type LevelDefinition,type Action} from '@garden/contracts';
import {createGame,replay,stateHash,legalActions,validateLevel} from '@garden/core';
import {getLevel} from '@garden/content';
import {progressiveLevel,progressionSelection} from '../packages/content/src/progressive';
import catalogue from '../packages/content/src/progressive-catalogue.json';
import proofsJson from '../packages/content/src/gravity-flow-proofs.json';
const proofs=proofsJson as Record<string,{actions:Action[];hash:string;shuffles:number}>;
describe('side-fed map certification and retained contracts',()=>{
 it('wins all 110 unchanged early and compartment maps on the certified gravity rules',()=>{const entries=[...Object.entries(catalogue.early).map(([key,level])=>['early/'+key,level] as const),...Object.entries(catalogue.bank)];expect(entries).toHaveLength(110);for(const [key,source]of entries){const level={...source,engineVersion:FLOW_GRAVITY_ENGINE_VERSION} as LevelDefinition,proof=proofs[key]!;expect(validateLevel(level)).toEqual([]);expect(legalActions(createGame(level)).length).toBeGreaterThan(0);const result=replay(level,proof.actions);expect(result.accepted,key).toBe(true);expect(result.state.status,key).toBe('won');expect(stateHash(result.state),key).toBe(proof.hash);}});
 it('uses the same authored geometry, objectives, barriers and move budgets for new and old clients',()=>{for(const id of [13,31,51,104,204,404,708,9998]){const old=progressiveLevel(getLevel(id,ENDPOINT_PIPE_ENGINE_VERSION)),current=progressiveLevel(getLevel(id,ENGINE_VERSION));expect({...current,engineVersion:old.engineVersion}).toEqual(old);}});
 it('has a winning replay for selected profiles on their recorded rules while leaving old boards untouched',()=>{for(const id of [231,232,233,234,235,281,291,1235,9995]){const base=getLevel(id,FLOW_GRAVITY_ENGINE_VERSION),saved=structuredClone(base),selected=progressionSelection(base);if(!selected)continue;const level=progressiveLevel(base),proof=proofs[selected.key]!;expect(replay(level,proof.actions).state.status,String(id)).toBe('won');expect(base).toEqual(saved);}});
});
