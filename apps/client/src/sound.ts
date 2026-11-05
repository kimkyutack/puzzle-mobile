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
export function sound(name:string){if(!soundEnabled||suspended)return;let sample=effects.get(name);if(!sample){sample=new Audio(`/audio/${name}.wav`);sample.volume=.32;effects.set(name,sample)}sample.muted=false;const old=voices.indexOf(sample);if(old>=0)voices.splice(old,1);while(voices.length>=3)voices.shift()?.pause();voices.push(sample);sample.onended=()=>{const index=voices.indexOf(sample!);if(index>=0)voices.splice(index,1)};sample.currentTime=0;void sample.play().catch(()=>{});}
export function haptic(){if(hapticEnabled)void Haptics.impact({style:ImpactStyle.Light}).catch(()=>{});}
export function startMusic(){suspended=false;if(!musicEnabled)return;if(!music){music=new Audio('/audio/garden.wav');music.loop=true;}music.muted=false;music.volume=.12;void music.play().catch(()=>{});}
export function pauseAudio(){suspended=true;effects.forEach(a=>a.pause());voices.length=0;music?.pause();}
