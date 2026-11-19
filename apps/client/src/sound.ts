import {Haptics,ImpactStyle} from '@capacitor/haptics';
const effects=new Map<string,HTMLAudioElement>();
let soundEnabled=true,hapticEnabled=true,musicEnabled=true;
let suspended=false;
let music:HTMLAudioElement|undefined;const voices:HTMLAudioElement[]=[];
export function configureSound(sound:boolean,haptics:boolean,bgm:boolean){
 soundEnabled=sound;hapticEnabled=haptics;musicEnabled=bgm;
 effects.forEach(sample=>{sample.muted=!sound;if(!sound){sample.pause();sample.currentTime=0;}});
 if(!sound)voices.length=0;
 if(music){music.muted=!bgm;music.volume=bgm?.12:0;if(!bgm)music.pause();else if(!suspended)void music.play().catch(()=>{});}
}
function effect(name:string){let sample=effects.get(name);if(!sample){sample=new Audio(`/audio/${name}.wav`);sample.preload='auto';sample.volume=.32;effects.set(name,sample);}return sample;}
/** Decode/load contact samples before the first hit, without starting playback. */
export function prepareBoardSounds(){if(soundEnabled&&!suspended)for(const name of ['match','impact','crack','swap','invalid'])effect(name);}
export function sound(name:string,accent=false){if(!soundEnabled||suspended)return;const sample=effect(name);sample.muted=false;sample.volume=accent?.49:.32;sample.preservesPitch=!accent;sample.playbackRate=accent?.85:1;const old=voices.indexOf(sample);if(old>=0)voices.splice(old,1);while(voices.length>=3)voices.shift()?.pause();voices.push(sample);sample.onended=()=>{const index=voices.indexOf(sample!);if(index>=0)voices.splice(index,1)};sample.currentTime=0;void sample.play().catch(()=>{});}
export function haptic(strength:'light'|'medium'='light'){if(hapticEnabled&&!suspended)void Haptics.impact({style:strength==='medium'?ImpactStyle.Medium:ImpactStyle.Light}).catch(()=>{});}
export function startMusic(){suspended=false;if(!musicEnabled)return;if(!music){music=new Audio('/audio/garden.wav');music.loop=true;}music.muted=false;music.volume=.12;void music.play().catch(()=>{});}
export function pauseAudio(){suspended=true;effects.forEach(a=>a.pause());voices.length=0;music?.pause();}
