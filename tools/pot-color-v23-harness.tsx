// Actual Board, isolated visual states only. No accounts, wallet, or API calls.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {COLORS,type GameState,type GameEvent} from '@garden/contracts';
import {createGame} from '@garden/core';
import {getLevel} from '@garden/content';
import Board from '../apps/client/src/Board';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import '../apps/client/src/fonts.css';
function sample():GameState{
 const state=createGame(getLevel(36));state.obstacles={};
 state.cells.forEach((cell,i)=>{delete cell.obstacleId;cell.frost=0;cell.exists=true;cell.tile={id:1000+i,kind:'normal',color:COLORS[(i%state.width+2*Math.floor(i/state.width))%COLORS.length]!};});
 COLORS.forEach((color,i)=>{const anchor=(state.height-2)*state.width+i+1,id='pot-'+color;state.obstacles[id]={id,kind:'pot',hp:4,maxHp:4,color,anchor,footprint:[anchor]};state.cells[anchor]!.tile=null;state.cells[anchor]!.obstacleId=id;});
 state.status='playing';return state;
}
function Fixture(){
 const [state,setState]=useState(sample),[events,setEvents]=useState<GameEvent[]>([]),[name,setName]=useState('6가지 요구 색상');
 function show(level:number){setState(level?createGame(getLevel(level)):sample());setEvents([]);setName(level?'실제 레벨 '+level:'6가지 요구 색상');}
 function hit(hp:number){const next=structuredClone(state),events:GameEvent[]=[];for(const obstacle of Object.values(next.obstacles))if(obstacle.kind==='pot'){events.push({type:'hit',kind:'pot',cells:[...obstacle.footprint],effectId:events.length+1});if(hp){obstacle.hp=hp;}else{delete next.obstacles[obstacle.id];for(const at of obstacle.footprint){delete next.cells[at]!.obstacleId;next.cells[at]!.tile={id:2000+at,kind:'normal',color:'sprout'};}}}next.turn++;setState(next);setEvents(events);}
 return <><main><Board state={state} events={events} locked tool={null} reduced={false} onAction={()=>{throw Error('Visual fixture does not allow game input');}}/></main><nav><button onClick={()=>show(0)}>6색 보기</button><button onClick={()=>show(18)}>실제 18레벨</button><button onClick={()=>show(36)}>실제 36레벨</button><button onClick={()=>hit(1)}>1회 남기기</button><button onClick={()=>hit(0)}>화분 제거</button></nav><output>{name}</output></>;
}
configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('15px "Lilita One"');await document.fonts.load('16px Jua');
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);
