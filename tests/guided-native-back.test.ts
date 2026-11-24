import {beforeEach,describe,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({native:false,platform:'web',remove:vi.fn(),listen:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>fake.native,getPlatform:()=>fake.platform},SystemBars:{},SystemBarsStyle:{},SystemBarType:{}}));
vi.mock('@capacitor/app',()=>({App:{addListener:fake.listen}}));
import {onGuidedBack} from '../apps/client/src/platform/lifecycle';
beforeEach(()=>{fake.native=false;fake.platform='web';fake.listen.mockReset().mockResolvedValue({remove:fake.remove});fake.remove.mockReset();});
describe('guided native back ownership',()=>{
 it('does not replace browser or iOS system back behavior',async()=>{
  (await onGuidedBack(vi.fn()))();expect(fake.listen).not.toHaveBeenCalled();
  fake.native=true;fake.platform='ios';(await onGuidedBack(vi.fn()))();expect(fake.listen).not.toHaveBeenCalled();
 });
 it('registers Android back only during the guide and releases it on completion',async()=>{
  fake.native=true;fake.platform='android';const back=vi.fn(),release=await onGuidedBack(back);
  expect(fake.listen).toHaveBeenCalledWith('backButton',back);expect(fake.remove).not.toHaveBeenCalled();
  fake.listen.mock.calls[0]![1]();expect(back).toHaveBeenCalledOnce();release();expect(fake.remove).toHaveBeenCalledOnce();
 });
});
