import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Board from '../apps/client/src/Board';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,GameState,GameEvent,Booster} from '@garden/contracts';
interface Snapshot {state:GameState;events:GameEvent[];key:number;name:string;tool:Booster|null}
declare global {interface Window {boardClipHarness:{load:(level:number,empty?:boolean,tool?:Booster)=>void;supply:()=>void;info:()=>{hash:string;actions:number;settlements:number;ready:boolean;duration:number;name:string}}}}
function Harness(){
 const [snapshot,setSnapshot]=useState<Snapshot>({state:createGame(getLevel(1)),events:[],key:0,name:'initial',tool:null}),current=useRef(snapshot);current.current=snapshot;const info=useRef({actions:0,settlements:0,ready:true,duration:0});
 useEffect(()=>{window.boardClipHarness={load:(level,empty=false,tool)=>{const state=createGame(getLevel(level));if(empty){state.cells=state.cells.map(cell=>({...cell,exists:false,tile:null,obstacleId:undefined,frost:0}));state.obstacles={};}info.current={actions:0,settlements:0,ready:true,duration:0};setSnapshot(old=>({state,events:[],key:old.key+1,name:'level-'+level+(empty?'-empty':''),tool:tool??null}));},supply:()=>{const state=structuredClone(current.current.state),cells:number[]=[];for(const [index,cell]of state.cells.entries())if(cell.exists&&cell.tile?.kind==='normal'){cell.tile.id=state.nextTileId++;cells.push(index);}setSnapshot(old=>({...old,state,events:[{type:'spawn',kind:'normal',cells}],name:'supply'}));},info:()=>({...info.current,hash:stateHash(current.current.state),name:current.current.name})};},[]);
 const action=(action:Action)=>{const result=applyAction(current.current.state,action);info.current.actions++;setSnapshot(old=>({...old,state:result.state,events:result.events,tool:null}));};
 return <main data-harness-name={snapshot.name}><Board key={snapshot.key} state={snapshot.state} events={snapshot.events} locked={false} tool={snapshot.tool} onAction={action} onVisualStart={duration=>{info.current.duration=duration;info.current.ready=false}} onVisualSettled={()=>{info.current.ready=true;info.current.settlements++}} reduced={false}/></main>;
}
const host=document.getElementById('root')!;if(!host.dataset.boardHarness){host.dataset.boardHarness='loading';await prepareAssets(()=>{});configureSound(false,false,false);await document.fonts.load('16px "Lilita One"');createRoot(host).render(<Harness/>);host.dataset.boardHarness='ready';}
