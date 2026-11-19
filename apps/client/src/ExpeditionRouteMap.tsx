import type {ExpeditionAnimal} from '@garden/contracts';
import {ANIMAL_EXPEDITION_STAGES,EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import woodland from '../../../packages/assets/expedition-map/woodland.webp';
import currentMarker from '../../../packages/assets/expedition-map/marker-current.webp';
import lockedMarker from '../../../packages/assets/expedition-map/marker-locked.webp';
import rewardSign from '../../../packages/assets/expedition-map/reward-sign.webp';
import {WORLD_ART} from './garden-world/assets';
import {tr} from './i18n';
import {Icon} from './ui';

// The coordinates anchor each pin's base on the winding path in woodland.webp.
const trailPoints=[
 [33,82],[44,77],[49,72],[46,65],[51,58],
 [57,55],[65,51],[72,46],[76,40],[65,37],
] as const;

interface Props {
 animal:ExpeditionAnimal;
 completed:number;
 startLabel:string;
 startDisabled:boolean;
 onStart:()=>void;
}

export default function ExpeditionRouteMap({animal,completed,startLabel,startDisabled,onStart}:Props){
 const friend=EXPEDITION_ANIMALS[animal];
 const next=completed+1;
 // Keep three readable landmarks. Replace the marker on the current leg with the active stage.
 const visibleStages=[
  next<=3?next:1,
  next>=4&&next<=7?next:5,
  next>=8&&next<=trailPoints.length?next:trailPoints.length,
 ];
 return <div className="expedition-route-map" role="group" aria-label={tr('원정 지도')}>
  <div className="expedition-map-scene">
   <img className="expedition-route-art" src={woodland} alt="" draggable={false}/>
   <img className="expedition-map-animal" src={WORLD_ART[friend.itemId]} alt={tr(friend.name)} draggable={false}/>
   <span className="expedition-map-sign">
    <img src={rewardSign} alt="" draggable={false}/>
    <span>{tr('완주 선물')}</span>
   </span>
   {visibleStages.map(stage=>{
    const [x,y]=trailPoints[stage-1]!;
    const state=stage<=completed?'complete':stage===next?'current':'locked';
    const face=<>
     <img src={state==='locked'?lockedMarker:currentMarker} alt="" draggable={false}/>
     <span className="expedition-map-marker-number">{stage}</span>
     {state==='complete'&&<Icon id="star" className="expedition-map-marker-star" size={18}/>}
    </>;
    return <div key={stage} className="expedition-map-marker" data-state={state} data-stage={stage} style={{left:x+'%',top:y+'%'}}>
     {state==='current'?<button type="button" onClick={onStart} disabled={startDisabled} aria-current="step"
       aria-label={tr(ANIMAL_EXPEDITION_STAGES[stage-1]!.title)+' · '+startLabel}>{face}</button>:
      <span className="expedition-map-marker-face" aria-hidden="true">{face}</span>}
    </div>;
   })}
  </div>
 </div>;
}
