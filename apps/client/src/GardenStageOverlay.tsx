import type {ExpeditionAnimal} from '@garden/contracts';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {supportsOpenGardenStages,type Action,type GameEvent,type GameState} from '@garden/contracts';
import {cellPosition,type BoardGeometry} from './board-geometry';
import {effectTiming} from './visual-timing';
import {gardenStageMotion} from './garden-stage-motion';
import {animalRouteDirection,gardenFloor} from './garden-stage-visual';
import {stageFloorArt} from './garden-stage-texture';
import {art} from './assets';
import {tr} from './i18n';
import {WORLD_ART} from './garden-world/assets';
import {EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import rabbit from '../../../packages/garden-world/art/runtime/residents-v22/rabbit-0.png';
import './garden-stages.css';

export default function GardenStageOverlay({state,events,action,geometry,reduced,animal='rabbit'}:{animal?:'rabbit'|ExpeditionAnimal;state:GameState;events:GameEvent[];action?:Action;geometry:BoardGeometry;reduced:boolean}){
 const stage=state.gardenStage!,[shown,setShown]=useState(stage),previous=useRef(stage),key=JSON.stringify(stage);
 const [travel,setTravel]=useState<{cells:number[];duration:number;at:number}|null>(null),[newCells,setNewCells]=useState<number[]>([]);
 useEffect(()=>{
  const before=previous.current;previous.current=stage;
  if(JSON.stringify(before)===key)return;
  const timing=gardenStageMotion(events,effectTiming(events,state,action).settleAt,reduced);
  if(!timing.end){setShown(stage);setTravel(null);setNewCells([]);return;}
  const changes=stage.connected.filter(at=>!before.connected.includes(at));
  const move=events.find(e=>e.kind==='garden-route'&&e.from!==undefined&&e.to!==undefined);
  const reveal=setTimeout(()=>{
   setShown({...stage,completed:before.completed,animalAt:before.animalAt});setNewCells(changes);
   if(move?.from!==undefined)setTravel({cells:move.cells,duration:timing.duration,at:move.from});
  },timing.delay);
  const turns:ReturnType<typeof setTimeout>[]=[];
  if(move){
   let lastDirection=animalRouteDirection(move.cells[0]!,move.cells[1],state.width);
   for(let i=1;i<move.cells.length-1;i++){
    const at=move.cells[i]!,direction=animalRouteDirection(at,move.cells[i+1],state.width);
    if(direction===lastDirection)continue;
    lastDirection=direction;
    const time=timing.delay+timing.duration*i/(move.cells.length-1);
    turns.push(setTimeout(()=>setTravel({cells:move.cells,duration:timing.duration,at}),time));
   }
  }
  const arrive=setTimeout(()=>{setShown(stage);setTravel(null);},timing.delay+timing.duration);
  const end=setTimeout(()=>setNewCells([]),timing.end);
  return()=>{clearTimeout(reveal);clearTimeout(arrive);clearTimeout(end);turns.forEach(clearTimeout);};
 },[key,reduced]);
 const cell=geometry.cell,{face}=geometry,pos=(at:number)=>{const p=cellPosition(at,geometry);return {x:p.x-face.x,y:p.y-face.y};};
 const box=(at:number,size=1):CSSProperties=>{const p=pos(at);return {left:p.x-cell*size/2,top:p.y-cell*size/2,width:cell*size,height:cell*size};};
 const route=travel?.cells.map((at,i)=>{const p=pos(at);return `${i?'L':'M'}${p.x} ${p.y}`;}).join(' ');
 const actorAt=shown.animalAt??stage.source,actor=pos(actorAt);
 const facingAt=travel?.at??actorAt;
 const direction=animalRouteDirection(facingAt,stage.channels[stage.channels.indexOf(facingAt)+1],state.width);
 const animalId=animal==='rabbit'?'animal-rabbit':EXPEDITION_ANIMALS[animal].itemId;
 const front=animal==='rabbit'?rabbit:WORLD_ART[animalId];
 const rear=WORLD_ART[animalId+':rear']??front;
 return <div className={'garden-stage-overlay stage-'+stage.kind} style={{width:geometry.width,height:geometry.height}} data-stage-kind={stage.kind} data-stage-blocked={JSON.stringify(shown.blocked)} data-stage-connected={JSON.stringify(shown.connected)} data-stage-completed={shown.completed.length} data-stage-travelling={!!travel} aria-label={tr(stage.kind==='water'?'화단으로 이어지는 물길':'동물 친구가 집으로 가는 길')}>
  <div className="stage-face" style={{left:face.x,top:face.y,width:face.width,height:face.height}} aria-hidden="true">
   {supportsOpenGardenStages(state.engineVersion)&&shown.connected.map(at=>{
    const floor=gardenFloor(stage,at,state.width,true),fresh=newCells.indexOf(at);
    return <div key={at} className={'stage-revealed-floor'+(fresh>=0?' is-fresh':'')} style={{...box(at),animationDelay:`${fresh<0||reduced?0:Math.min(fresh*65,900)}ms`}}>
     <img src={art('board_cell')} alt=""/>
     <img className="stage-floor-art" src={stageFloorArt(floor.id).src} style={{transform:`rotate(${floor.rotation}deg)`}} alt=""/>
    </div>;
   })}
   {shown.blocked.map(at=><img key={at} className="stage-earth-gate" data-gate={at} src={art('stage_mud_gate_v33')} style={{...box(at),top:pos(at).y-cell*.03,height:cell*.53}} alt=""/>)}
   {stage.kind==='water'&&<img className="stage-ornament stage-spring" src={art('stage_spring_v33')} style={box(stage.source,.96)} alt=""/>}
   {stage.destinations.map(at=>{const open=shown.completed.includes(at);return <img key={at} className={'stage-ornament stage-destination'+(open?' is-complete':'')} data-destination={at} src={art(stage.kind==='water'?open?'stage_flower_bloom_v33':'stage_flower_bud_v33':'stage_rabbit_home_v33')} style={box(at,1)} alt=""/>;})}
   {stage.kind==='animal'&&<div key={route||'rest'} className={'stage-rabbit'+(travel?' is-walking':'')} data-animal={animal} data-direction={direction}
    style={travel?{left:0,top:0,width:cell*.84,height:cell*.92,offsetPath:`path('${route}')`,offsetAnchor:'50% 65%',animationDuration:`${travel.duration}ms`}:{left:actor.x-cell*.42,top:actor.y-cell*.6,width:cell*.84,height:cell*.92}}>
    <img src={front} alt="" hidden={direction==='up'} style={{transform:direction==='left'?'scaleX(-1)':undefined}}/>
    <img src={rear} alt="" hidden={direction!=='up'}/>
   </div>}
  </div>
  <span className="sr-only">{tr('흙마개')} {shown.blocked.length} · {tr('완료')} {shown.completed.length}/{stage.destinations.length}</span>
 </div>;
}
