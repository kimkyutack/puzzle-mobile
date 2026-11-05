import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('@capacitor/haptics',()=>({Haptics:{impact:vi.fn(async()=>{})},ImpactStyle:{Light:'LIGHT'}}));
class AudioMock{static instances:AudioMock[]=[];volume=1;muted=false;loop=false;currentTime=0;onended:(()=>void)|null=null;play=vi.fn(async()=>{});pause=vi.fn();constructor(public src:string){AudioMock.instances.push(this);}}
beforeEach(()=>{vi.resetModules();AudioMock.instances=[];vi.stubGlobal('Audio',AudioMock);const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)});});
afterEach(()=>vi.unstubAllGlobals());
describe('immediate sound preferences',()=>{
 it('mutes and stops all already playing effects, and prevents scheduled impacts from starting',async()=>{
  const audio=await import('../apps/client/src/sound');audio.sound('special');audio.sound('match');const clips=[...AudioMock.instances];audio.configureSound(false,true,true);audio.sound('special');audio.sound('button');
  expect(AudioMock.instances).toHaveLength(2);for(const clip of clips){expect(clip.muted).toBe(true);expect(clip.pause).toHaveBeenCalledOnce();expect(clip.play).toHaveBeenCalledOnce();}
  audio.configureSound(true,true,true);audio.sound('special');expect(clips[0]!.muted).toBe(false);expect(clips[0]!.play).toHaveBeenCalledTimes(2);
 });
 it('keeps disabled music stopped across background and ad resume',async()=>{
  const audio=await import('../apps/client/src/sound');audio.startMusic();const music=AudioMock.instances[0]!;audio.configureSound(true,true,false);audio.pauseAudio();audio.startMusic();expect(music.muted).toBe(true);expect(music.volume).toBe(0);expect(music.play).toHaveBeenCalledOnce();audio.sound('match');expect(AudioMock.instances).toHaveLength(2);
 });
 it('keeps a local toggle during stale responses, restart and a late acknowledgement of an older toggle',async()=>{
  const prefs=await import('../apps/client/src/play-preferences'),player={id:'u',settings:{sound:true,music:true,haptics:true,reducedMotion:false,language:'ko'}} as import('@garden/contracts').Player;
  prefs.rememberPreferences('u',{sound:false});expect(prefs.applyPreferences(player).settings.sound).toBe(false);expect(prefs.pendingPreferences('u')).toEqual({sound:false});
  prefs.confirmPreferences('u',{sound:true},player.settings);expect(prefs.pendingPreferences('u')).toEqual({sound:false});
  prefs.confirmPreferences('u',{sound:false},{...player.settings,sound:false});expect(prefs.pendingPreferences('u')).toEqual({});expect(prefs.applyPreferences({...player,id:'other'}).settings.sound).toBe(true);
 });
 it('restores full effects for old server profiles and offline reduced-motion preferences',async()=>{
  const prefs=await import('../apps/client/src/play-preferences'),player={id:'u',settings:{sound:true,music:false,haptics:true,reducedMotion:true,language:'ko'}} as import('@garden/contracts').Player;
  localStorage.setItem('cloud-garden-preferences-u',JSON.stringify({sound:false,reducedMotion:true}));
  expect(prefs.pendingPreferences('u')).toEqual({sound:false});
  expect(prefs.applyPreferences(player).settings).toEqual({...player.settings,sound:false,reducedMotion:false});
  prefs.rememberPreferences('u',{haptics:false,reducedMotion:true});
  expect(prefs.pendingPreferences('u')).toEqual({sound:false,haptics:false});
  expect(player.settings.reducedMotion).toBe(true);
 });
});
