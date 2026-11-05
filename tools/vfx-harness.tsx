import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Board from '../apps/client/src/Board';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,Booster,GameEvent,GameState} from '@garden/contracts';
interface Snapshot {state:GameState;events:GameEvent[];tool:Booster|null;key:number;name:string}
declare global {interface Window {effectsHarness:{load:(name:string,level:number,actions:Action[],tool?:Booster)=>void;info:()=>{name:string;hash:string;actions:number;settlements:number;duration:number;ready:boolean}}}}
function Harness(){const [snapshot,setSnapshot]=useState<Snapshot>({state:createGame(getLevel(1)),events:[],tool:null,key:0,name:'initial'}),current=useRef(snapshot);current.current=snapshot;const metadata=useRef({actions:0,settlements:0,duration:0,ready:true});
 useEffect(()=>{window.effectsHarness={load:(name,level,actions,tool)=>{let state=createGame(getLevel(level));for(const action of actions){const result=applyAction(state,action);if(!result.accepted)throw new Error('Harness setup action rejected');state=result.state;}metadata.current={actions:0,settlements:0,duration:0,ready:true};setSnapshot(previous=>({state,events:[],tool:tool??null,key:previous.key+1,name}));},info:()=>({...metadata.current,name:current.current.name,hash:stateHash(current.current.state)})};},[]);
 function action(action:Action){const result=applyAction(current.current.state,action);metadata.current.actions++;setSnapshot(previous=>({...previous,state:result.state,events:result.events,tool:null}));}
 return <main data-harness-name={snapshot.name} data-state-hash={stateHash(snapshot.state)}><Board key={snapshot.key} state={snapshot.state} events={snapshot.events} locked={false} tool={snapshot.tool} onAction={action} onVisualStart={duration=>{metadata.current.duration=duration;metadata.current.ready=false;}} onVisualSettled={()=>{metadata.current.settlements++;metadata.current.ready=true;}} reduced={false}/></main>;
}
const host=document.getElementById('root')!;if(!host.dataset.harnessMounted){host.dataset.harnessMounted='loading';await prepareAssets(()=>{});configureSound(false,false,false);await document.fonts.load('16px \"Lilita One\"');createRoot(host).render(<Harness/>);host.dataset.harnessMounted='ready';}
