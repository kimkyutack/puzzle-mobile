import crownLumi from '../../../packages/assets/guild-emblems/runtime/laurel-crown.webp';
import moonRabbit from '../../../packages/assets/guild-emblems/runtime/moon-feather.webp';
import forestGuardian from '../../../packages/assets/guild-emblems/runtime/forest-guardian.webp';
import blueWave from '../../../packages/assets/guild-emblems/runtime/blue-wave.webp';
import sunLion from '../../../packages/assets/guild-emblems/runtime/sun-lion.webp';
import firePhoenix from '../../../packages/assets/guild-emblems/runtime/fire-phoenix.webp';
import starCompass from '../../../packages/assets/guild-emblems/runtime/star-compass.webp';
import redRose from '../../../packages/assets/guild-emblems/runtime/red-rose.webp';

// Array positions are the emblem numbers saved with each guild.
export const guildEmblems = [
 {icon:'guild-emblem-laurel-crown',label:'왕관 루미',url:crownLumi},
 {icon:'guild-emblem-moon-feather',label:'달빛 토끼',url:moonRabbit},
 {icon:'guild-emblem-forest-guardian',label:'숲의 수호',url:forestGuardian},
 {icon:'guild-emblem-blue-wave',label:'푸른 물결',url:blueWave},
 {icon:'guild-emblem-sun-lion',label:'태양 사자',url:sunLion},
 {icon:'guild-emblem-fire-phoenix',label:'불꽃 봉황',url:firePhoenix},
 {icon:'guild-emblem-star-compass',label:'별의 나침반',url:starCompass},
 {icon:'guild-emblem-red-rose',label:'붉은 장미',url:redRose},
] as const;

export function guildEmblemIcon(emblem=0){
 return (guildEmblems[emblem]??guildEmblems[0]).icon;
}
