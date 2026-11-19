import {COLORS,type Action,type GameEvent,type GameState} from '@garden/contracts';
import {combinationParts} from './special-combination';
import {rainbowSelections,rainbowArrival} from './rainbow-selection';
import {MATCH_RELEASE,MATCH_SQUEEZE} from './tile-impact';
import {BEE_BEATS} from './bee-motion';
export const VISUAL_BEATS={fusion:520,charge:360,rainbowCharge:720,rainbowHold:300,gliderFlight:740,windTravel:420,rainbowTravel:1000,rainbowCascadeTravel:640,pop:180,normalPop:110,fall:320,maxChainStart:1100} as const;
export const CROSS_ROCKET_BEATS={fusion:400,travel:VISUAL_BEATS.windTravel,relay:65,afterglow:330} as const;
/** Two bombs fused by the player squash, swell and tremble for `charge`, then hold a white hit-stop for `ignition`. */
export const BOMB_BEATS={ignition:90,step:75,charge:500} as const;
export const specialCharge=(kind:string)=>kind.includes('rainbow')?VISUAL_BEATS.rainbowCharge:kind.includes('beehive')?BEE_BEATS.charge:VISUAL_BEATS.charge;
/** A late chain reaction keeps its target flashes within the same refill. */
export const rainbowTravelTime=(start:number)=>start>VISUAL_BEATS.maxChainStart+VISUAL_BEATS.fusion?VISUAL_BEATS.rainbowCascadeTravel:VISUAL_BEATS.rainbowTravel;
function smoothArrival(progress:number){let low=0,high=1;for(let i=0;i<12;i++){const mid=(low+high)/2;if(mid*mid*(3-2*mid)<progress)low=mid;else high=mid;}return (low+high)/2;}
export const windArrival=(progress:number,travel:number=VISUAL_BEATS.windTravel)=>Math.round(smoothArrival(Math.max(0,Math.min(1,progress)))*travel);
const isRocket=(kind:string)=>kind==='wind-row'||kind==='wind-column';
export const isCrossRocket=(kind:string)=>kind==='wind+wind'||combinationParts(kind)?.every(isRocket)===true;
type RocketShot={at:number;launch:number;horizontal:boolean;vertical:boolean;span:number;quick:boolean};

function rocketContact(shot:RocketShot,cells:readonly number[],width:number,height:number){
 const x=shot.at%width,y=Math.floor(shot.at/width);
 let contact:{at:number;delay:number}|undefined;
 for(const at of cells){
  const col=at%width,row=Math.floor(at/width);
  const across=shot.horizontal&&Math.abs(row-y)<=shot.span?Math.abs(col-x)/(col<x?x+.5:width-x-.5):Infinity;
  const down=shot.vertical&&Math.abs(col-x)<=shot.span?Math.abs(row-y)/(row<y?y+.5:height-y-.5):Infinity;
  const distance=Math.min(across,down);
  if(!Number.isFinite(distance))continue;
  const delay=shot.launch+windArrival(distance,CROSS_ROCKET_BEATS.travel);
  if(!contact||contact.delay>delay)contact={at,delay};
 }
 return contact;
}
export const REFLECTED_ROCKET_STEP=64;
export const ECHO_IMPACT=250;
export const WIND_SEED_FLIGHT=430;
export const PLANTER_REVEAL_TRAVEL=280;
export const DOMINO_BEAT=76;
export const SOIL_SPLIT_TRAVEL=235;
const WIND_SEED_SPACING=105;
export interface VisualTiming {delays:number[];firstRemovalAt:Map<number,number>;activationAt:Map<number,number>;fusionAt:Map<number,number>;conversionAt:Map<number,number>;rocketLaunches:Map<number,number>;rocketContacts:Map<number,number>;directMatchImpacts:ReadonlyMap<number,number>;settleAt:number;special:boolean;toolImpact:number;primaryImpactAt:number;heroBombs:Set<number>}
/** Pure presentation schedule. Chain launches overlap after 1.1 s; each flight/impact keeps its full duration. */
export function effectTiming(events:readonly GameEvent[],state?:Pick<GameState,'width'|'height'|'cells'>,action?:Action):VisualTiming{
 const width=state?.width??7,height=state?.height??7,cellCount=state?.cells.length??width*height;
 const special=events.some(event=>event.type==='special')||action?.type==='booster'&&action.item!=='shuffle';
 const toolImpact=action?.type==='booster'?({hammer:760,shuffle:0,'sweep-border':1150,'world-bomb':1400,'cross-firework':900,'color-magnet':1000,'move-hourglass':0,'sweep-row':930,'sweep-column':930}[action.item]):0;
 const waves:number[]=[];let wave=0,gravity=false;
 for(const event of events){if(event.type==='fall'||event.type==='spawn'&&event.kind==='normal')gravity=true;if(gravity&&['remove','hit','special'].includes(event.type)){wave++;gravity=false;}waves.push(wave);}
 const base=(index:number)=>Math.min(special?700:100,(special?0:MATCH_SQUEEZE)+waves[index]!*(special?180:35));
 const damage=new Map<number,number>(),activationAt=new Map<number,number>(),starts=new Map<number,number>(),launchAt=new Map<number,number>(),fusionAt=new Map<number,number>();
 const beeLaunchAt=new Map<number,number>(),beeStrikes=new Map<number,number>(),beeImpacts=new Map<number,number>(),beeFloorAt=new Map<number,number>();
 const gliderImpacts=new Map<number,number>(),gliderLaunches=new Map<number,number>();
 const directMatchImpacts=new Map<number,number>();
 let directMatchRelease=0;
 const rocketShots=new Map<number,RocketShot>(),rocketLaunches=new Map<number,number>(),rocketContacts=new Map<number,number>();
 let lastGliderLanding=0;
 const heroBombs=new Set<number>();
 const selections=rainbowSelections(events),convertedChildren=new Map<number,number>(),conversionAt=new Map<number,number>(),conversionEvents=new Map<number,number>();let rainbowFloor=0;
 for(const selection of selections.values())for(const index of selection.children.keys())convertedChildren.set(index,selection.index);
 const fusion=events.find(event=>event.type==='special'&&event.cells.length===2&&(isCrossRocket(event.kind??'')||combinationParts(event.kind??'')));
 const fusionLead=fusion?(isCrossRocket(fusion.kind??'')?CROSS_ROCKET_BEATS.fusion:VISUAL_BEATS.fusion):0;
 const mark=(at:number,time:number)=>damage.set(at,Math.max(damage.get(at)??0,time));
 if(toolImpact)for(const event of events)if(event.type==='remove'||event.type==='hit')for(const at of event.cells)mark(at,toolImpact+base(events.indexOf(event)));
 for(const [index,event] of events.entries()){
  if(event.kind==='direct-match'&&event.effectId!==undefined){
   const impact=base(index)+MATCH_SQUEEZE;
   directMatchImpacts.set(event.effectId,impact);
   directMatchRelease=Math.max(directMatchRelease,impact);
   continue;
  }
  if(event.kind==='echo-pulse'){
   starts.set(index,ECHO_IMPACT);
   for(const target of event.cells)mark(target,ECHO_IMPACT);
   continue;
  }
  if(event.type!=='special')continue;const kind=event.kind??'',at=event.from??event.cells.at(-1);if(at===undefined)continue;
  if(kind==='bee-flight'&&event.to!==undefined){
   const ordinal=beeStrikes.get(at)??0,launch=(beeLaunchAt.get(at)??launchAt.get(at)??base(index))+BEE_BEATS.charge+ordinal*BEE_BEATS.stagger,impact=launch+BEE_BEATS.flight;
   beeStrikes.set(at,ordinal+1);starts.set(index,launch);if(event.effectId!==undefined)beeImpacts.set(event.effectId,impact);mark(event.to,impact);beeFloorAt.set(event.to,impact);continue;
  }
  // Flight events share their launch's preparation instead of charging a second time.
  const cross=event.cells.length===2&&isCrossRocket(kind);
  const parts=event.cells.length===2&&(cross||combinationParts(kind)),parent=convertedChildren.get(index);
  // Only a bomb pair the player fuses gets the long anticipation; a single bomb just goes off.
  const hero=kind==='bomb+bomb'&&parent===undefined&&!toolImpact;
  if(hero)heroBombs.add(index);
  const parentStart=parent===undefined?0:starts.get(parent)??0;
  const parentRelease=parentStart+VISUAL_BEATS.rainbowCharge+rainbowTravelTime(parentStart)+VISUAL_BEATS.rainbowHold;
  const previous=events[index-1],parentShot=previous?.type==='remove'&&previous.cells[0]===at&&previous.effectId!==undefined?rocketShots.get(previous.effectId):undefined;
  const parentContact=parentShot?.quick?rocketContact(parentShot,[at],width,height):undefined;
  const preparation=kind==='glider-flight'?(launchAt.get(at)??base(index)):parent!==undefined?parentRelease:parentContact?.delay??Math.max(beeFloorAt.get(at)??0,rainbowFloor,Math.min(Math.max(VISUAL_BEATS.maxChainStart+fusionLead,toolImpact),Math.max(base(index),damage.get(at)??0)));
  const start=Math.max(preparation,directMatchRelease)+(cross?CROSS_ROCKET_BEATS.fusion:parts?VISUAL_BEATS.fusion:0);
  starts.set(index,start);
  if(kind.includes('beehive')&&!kind.includes('rainbow')){beeLaunchAt.set(at,start);beeStrikes.set(at,0);}
  if(parts){fusionAt.set(index,preparation);for(const cell of event.cells)activationAt.set(cell,Math.min(activationAt.get(cell)??Infinity,preparation));}
  if(kind!=='glider-flight'){launchAt.set(at,start);if(!parts)activationAt.set(at,Math.min(activationAt.get(at)??Infinity,start));}
  const wide=kind.includes('wind')&&kind.includes('bomb');
  if(cross||wide||isRocket(kind)&&!event.routes){
   const quick=cross||!wide&&parentContact!==undefined;
   const launch=start+(cross?0:quick?CROSS_ROCKET_BEATS.relay:VISUAL_BEATS.charge);
   const shot={at,launch,horizontal:cross||wide||kind==='wind-row',vertical:cross||wide||kind==='wind-column',span:wide?1:0,quick};
   if(cross||quick&&!wide)rocketLaunches.set(index,launch);
   if(event.effectId!==undefined)rocketShots.set(event.effectId,shot);
   for(let target=0;target<cellCount;target++){
    const contact=rocketContact(shot,[target],width,height);
    if(contact)mark(target,contact.delay);
   }
   continue;
  }
  if(kind==='glider-flight'&&event.to!==undefined){
   let launch=start;
   if(event.effectId!==undefined){
    const order=gliderLaunches.get(start)??0;gliderLaunches.set(start,order+1);
    launch+=Math.min(order*16,144);starts.set(index,launch);
    const landing=launch+VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight;
    lastGliderLanding=Math.max(lastGliderLanding,landing);gliderImpacts.set(event.effectId,landing);
   }
   mark(event.to,launch+VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight);continue;
  }
  if(event.routes){
   for(const route of event.routes)for(const [step,target] of route.entries())mark(target,start+VISUAL_BEATS.charge+step*REFLECTED_ROCKET_STEP);
   continue;
  }
  const x=at%width,y=Math.floor(at/width);
  if(kind.includes('glider')&&!kind.includes('rainbow')){
   const impact=start+VISUAL_BEATS.charge;
   if(kind==='glider'&&event.effectId!==undefined)gliderImpacts.set(event.effectId,impact);
   for(let target=0;target<cellCount;target++)if(Math.abs(target%width-x)+Math.abs(Math.floor(target/width)-y)<=1)mark(target,impact);
   continue;
  }
  if(kind.includes('rainbow')){
   const selection=selections.get(index)!,travel=rainbowTravelTime(start),impact=start+VISUAL_BEATS.rainbowCharge+travel;
   if(selection.replacement)rainbowFloor=Math.max(rainbowFloor,impact+VISUAL_BEATS.rainbowHold);
   for(const [order,target]of selection.targets.entries()){
    mark(target,impact);
    if(selection.replacement){const arrival=start+rainbowArrival(order,selection.targets.length,VISUAL_BEATS.rainbowCharge,travel);if(!conversionAt.has(target))conversionAt.set(target,arrival);
     for(let i=index+1;i<events.length;i++){const next=events[i]!;if(next.type==='remove'&&next.effectId===selection.effectId&&next.cells.includes(target))conversionEvents.set(i,arrival);}
    }
   }
  }else for(let target=0;target<cellCount;target++){
   const dx=Math.abs(target%width-x),dy=Math.abs(Math.floor(target/width)-y);
   if(kind.includes('bomb')){const radius=kind==='bomb+bomb'?4:2;if(Math.max(dx,dy)<=radius)mark(target,start+(hero?BOMB_BEATS.charge:VISUAL_BEATS.charge)+BOMB_BEATS.ignition+Math.max(dx,dy)*BOMB_BEATS.step);}
  }
 }
 // The renderer presents the final cascade in one refill. Later normal matches
 // must not leave holes while the initial rainbow is still visibly charging.
 const rainbowImpacts=[...selections.keys()].map(index=>{
  const start=starts.get(index)??0;
  return start+VISUAL_BEATS.rainbowCharge+rainbowTravelTime(start);
 });
 const rainbowBarrier=rainbowImpacts.length?Math.min(...rainbowImpacts):0;
 const firstBee=events.findIndex(event=>event.kind==='bee-flight'),beeBarrier=Math.max(0,...beeImpacts.values());
 const aftershocks=new Map<number,number>();
 let rainbowDoubleImpact=0;
 for(const [index,event] of events.entries()){
  if(event.type==='special'&&event.kind==='rainbow+rainbow'&&event.powered){
   const start=starts.get(index)??0;
   rainbowDoubleImpact=start+VISUAL_BEATS.rainbowCharge+rainbowTravelTime(start);
  }
  if(event.kind==='power-rainbow-aftershock'&&event.effectId!==undefined)aftershocks.set(event.effectId,rainbowDoubleImpact+180);
 }
 const firstRemovalAt=new Map<number,number>();
 const clearedPods=new Map<number,number>(),windLandings=new Map<number,number>(),lastWindLanding=new Map<number,number>();
 const lanternHits=new Map<string,number>();
 const struckOpeners=new Map<number,number>(),planterReveals=new Map<number,number>(),exposedAt=new Map<number,number>();
 const dominoAt=new Map<number,number>(),dominoHits=new Map<number,number>();
 const soilBreaks=new Map<number,number>(),soilArrivals=new Map<number,number>();
 const crateReveals=new Map<number,number>();
 let lastImpact=0,firstWaveLast=0;
 const delays=events.map((event,index)=>{
  const aftershock=event.effectId===undefined?undefined:aftershocks.get(event.effectId);
  if(event.kind==='power-rainbow-aftershock')return aftershock??base(index);
  if(event.type==='special'||event.kind==='echo-pulse')return starts.get(index)??base(index);
  let delay=base(index);
  if(event.kind==='wind-seed-flight'&&event.from!==undefined&&event.to!==undefined&&event.effectId!==undefined){
   const launch=Math.max((clearedPods.get(event.from)??delay)+40,
    (lastWindLanding.get(event.to)??-Infinity)+WIND_SEED_SPACING-WIND_SEED_FLIGHT);
   const landing=launch+WIND_SEED_FLIGHT;
   lastWindLanding.set(event.to,landing);
   windLandings.set(event.effectId,landing);
   return launch;
  }
  if(event.type==='mechanic'&&event.kind?.endsWith('-open')&&event.from!==undefined&&event.effectId!==undefined&&struckOpeners.has(event.from)){
   const launch=struckOpeners.get(event.from)!;
   planterReveals.set(event.effectId,launch+PLANTER_REVEAL_TRAVEL);
   return launch;
  }
  if(event.kind==='domino-chain'&&event.from!==undefined&&event.effectId!==undefined){
   const launch=dominoAt.get(event.from)??delay;
   dominoHits.set(event.effectId,launch+DOMINO_BEAT);
   return launch;
  }
  if(event.kind==='soil-split'&&event.from!==undefined){
   const launch=soilBreaks.get(event.from)??delay;
   for(const at of event.cells)soilArrivals.set(at,launch+SOIL_SPLIT_TRAVEL);
   return launch;
  }
  if(event.type==='remove'||event.type==='hit')for(const at of event.cells)delay=Math.max(delay,activationAt.has(at)&&event.type==='remove'?activationAt.get(at)!:damage.get(at)??0);
  if((event.type==='remove'||event.type==='hit')&&!(event.type==='remove'&&event.cells.every(at=>activationAt.has(at))))delay=Math.max(delay,rainbowBarrier);
  // A refilled cascade cannot break before the blast that emptied its column has landed.
  if(special&&waves[index]!>0&&(event.type==='remove'||event.type==='hit'))delay=Math.max(delay,firstWaveLast);
  if(conversionEvents.has(index))delay=conversionEvents.get(index)!;
  if(action?.type==='booster'&&action.item==='color-magnet'&&event.type==='remove'&&waves[index]===0)delay=350;
  if(event.type==='remove'||event.type==='hit'){
   const matchImpact=event.effectId===undefined?undefined:directMatchImpacts.get(event.effectId);
   const flightImpact=event.effectId===undefined?undefined:(beeImpacts.get(event.effectId)??gliderImpacts.get(event.effectId)??windLandings.get(event.effectId));
   const shot=event.effectId===undefined?undefined:rocketShots.get(event.effectId);
   const contact=shot?rocketContact(shot,event.cells,width,height):undefined;
   if(matchImpact!==undefined)delay=matchImpact;
   else if(contact){delay=contact.delay;rocketContacts.set(index,contact.at);}
   else if(flightImpact!==undefined)delay=flightImpact;
   else if(firstBee>=0&&index>firstBee&&!event.cells.some(at=>activationAt.has(at)&&event.type==='remove'))delay=Math.max(delay,beeBarrier);
  }
  if(aftershock!==undefined)delay=Math.max(delay,aftershock);
  if(event.type==='hit'&&event.kind==='starlight-lantern'&&event.obstacleId){
   delay=Math.max(delay,(lanternHits.get(event.obstacleId)??-Infinity)+125);
   lanternHits.set(event.obstacleId,delay);
  }
  if(event.type==='hit'&&event.kind==='wind-pod'&&event.obstacleAfter===null)clearedPods.set(event.cells[0]!,delay);
  if(event.type==='hit'&&['greenhouse-sluice','vine-knot','rotating-shelf'].includes(event.kind??''))struckOpeners.set(event.cells[0]!,delay);
  const reveal=event.effectId===undefined?undefined:planterReveals.get(event.effectId);
  if(reveal!==undefined){
   delay=reveal;
   if(event.kind==='planter-reveal')exposedAt.set(event.cells[0]!,reveal);
  }
  if(event.type==='hit'&&event.kind==='garden-planter')delay=Math.max(delay,(exposedAt.get(event.cells[0]!)??-Infinity)+90);
  if(event.type==='hit'&&event.kind==='domino-slat'){
   delay=Math.max(delay,dominoHits.get(event.effectId??-1)??0);dominoAt.set(event.cells[0]!,delay);
  }
  if(event.type==='hit'&&event.kind==='soil-clod')soilBreaks.set(event.cells[0]!,delay);
  if(event.kind==='soil-chip-arrival'||event.kind==='soil-chip'&&event.type==='hit'){
   delay=Math.max(delay,(soilArrivals.get(event.cells[0]!)??-Infinity)+(event.kind==='soil-chip'?85:0));
  }
  if(event.type==='hit'){
   for(const at of event.cells)delay=Math.max(delay,(crateReveals.get(at)??-Infinity)+85);
   if(event.kind==='supply-crate'&&event.cells.length>1&&event.obstacleAfter===null){
    for(const at of event.cells)crateReveals.set(at,delay+100);
   }
  }
  if(event.kind==='crate-pieces-reveal'){
   delay=Math.max(delay,crateReveals.get(event.cells[0]!)??0);
   lastImpact=Math.max(lastImpact,delay);
  }
  if(event.kind==='cart-push')lastImpact=Math.max(lastImpact,220);
  if(event.type==='spawn'&&reveal!==undefined)lastImpact=Math.max(lastImpact,reveal);
  if((event.type==='remove'||event.type==='hit')&&waves[index]===0)firstWaveLast=Math.max(firstWaveLast,delay);
  if(event.type==='remove'||event.type==='hit'){lastImpact=Math.max(lastImpact,delay);if(event.type==='remove')for(const at of event.cells)if(!firstRemovalAt.has(at))firstRemovalAt.set(at,delay);}
  return delay;
 });
 const formsItem=events.some(event=>event.type==='spawn'&&event.kind!=='normal'&&event.kind!=='seed');
 const clearsColor=events.some(event=>event.type==='remove'&&COLORS.some(color=>color===event.kind));
 // Ordinary matches release the board as soon as the tile body is gone. Crumbs keep moving during refill.
 const refillDelay=special?VISUAL_BEATS.pop:clearsColor&&!formsItem?MATCH_RELEASE:VISUAL_BEATS.normalPop;
 const settleAt=events.some(event=>event.type==='remove'||event.type==='hit'||event.kind==='cart-push')?Math.max(lastImpact,lastGliderLanding)+refillDelay:0;
 const firstSpecial=events.findIndex(event=>event.type==='special'&&!['glider-flight','bee-flight'].includes(event.kind??''));let primaryImpactAt=toolImpact;
 if(!primaryImpactAt&&firstSpecial>=0){const kind=events[firstSpecial]!.kind??'',start=delays[firstSpecial]!,replacement=selections.get(firstSpecial)?.replacement;primaryImpactAt=replacement?start+VISUAL_BEATS.rainbowCharge+rainbowTravelTime(start)+VISUAL_BEATS.rainbowHold+specialCharge(replacement)+(replacement==='bomb'?BOMB_BEATS.ignition:replacement==='glider'?VISUAL_BEATS.gliderFlight:replacement==='beehive'?BEE_BEATS.flight:0):start+(heroBombs.has(firstSpecial)?BOMB_BEATS.charge:specialCharge(kind))+(kind.includes('rainbow')?rainbowTravelTime(start):kind.includes('glider')?VISUAL_BEATS.gliderFlight:kind.includes('bomb')&&!kind.includes('wind')?BOMB_BEATS.ignition:0);}
 if(rocketLaunches.has(firstSpecial))primaryImpactAt=Math.min(...[...rocketContacts.keys()].map(index=>delays[index]!),rocketLaunches.get(firstSpecial)!+CROSS_ROCKET_BEATS.travel);
 if(firstSpecial>=0&&events[firstSpecial]!.kind?.includes('beehive')&&firstBee>=0)primaryImpactAt=delays[firstBee]!+BEE_BEATS.flight;
 return {delays,firstRemovalAt,activationAt,fusionAt,conversionAt,rocketLaunches,rocketContacts,directMatchImpacts,settleAt,special,toolImpact,primaryImpactAt,heroBombs};
}
