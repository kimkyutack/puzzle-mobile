import {describe,it,expect} from 'vitest';
import {goalArt} from '../apps/client/src/assets';
import {featureHelp} from '../apps/client/src/feature-help';
import {VISIBLE_TARGETS_ENGINE_VERSION} from '@garden/contracts';
describe('new campaign goal images and lessons',()=>{
 it('uses the matching mechanic image instead of an unrelated power-up',()=>{
  for(const [kind,id]of Object.entries({pipe:'mechanic_pipe_v20',bud:'mechanic_bud_v20',carousel:'mechanic_carousel_v20',curtain:'mechanic_curtain_v20'})){
   expect(goalArt(kind)).toBe(id);expect(featureHelp(kind,'ko')).not.toBe('');expect(featureHelp(kind,'en')).not.toBe('');
  }
  expect(goalArt('combo')).toBe('cross-firework');
  expect(goalArt('special')).toBe('bundle_tools_v7');
  expect(goalArt('flower-seal')).toBe('flower-seal');
  expect(goalArt('frost',{obstacles:[],engineVersion:VISIBLE_TARGETS_ENGINE_VERSION})).toBe('frost-thick');
  expect(goalArt('crate')).toBe('crate_1');expect(goalArt('berry')).toBe('tile_berry');
 });
});
