import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {stateHash,type CascadeFrame} from '@garden/core';
import type {GameState} from '@garden/contracts';
import Board,{type BoardProps} from './Board';
import {effectTiming} from './visual-timing';

interface Playback {frames:readonly CascadeFrame[];at:number;target:string;done:boolean}
const QUIET_EVENTS:BoardProps['events']=[];
/** One local action, one input barrier, real refill states between matches. */
export default function CascadeBoard({frames,onStateShown,...props}:BoardProps&{frames?:readonly CascadeFrame[];onStateShown?:(state:GameState)=>void}){
 const [playback,setPlayback]=useState<Playback|null>(null),seen=useRef(frames),current=useRef(playback),target=useMemo(()=>stateHash(props.state),[props.state]);
 if(seen.current!==frames){seen.current=frames;setPlayback(frames?.length?{frames:props.reduced?[{state:props.state,events:props.events}]:frames,at:0,target,done:false}:null);}
 current.current=playback;
 const compatible=!!playback&&playback.target===target,frame=compatible?playback.frames[playback.at]:undefined;
 const shown=frame?.state??props.state,shownCallback=useRef(onStateShown);shownCallback.current=onStateShown;
 useLayoutEffect(()=>{
  const delay=frame&&!playback?.done&&!props.reduced?effectTiming(frame.events,frame.state,playback?.at?undefined:props.action).settleAt:0;
  if(!delay){shownCallback.current?.(shown);return;}
  const timer=setTimeout(()=>shownCallback.current?.(shown),delay);return()=>clearTimeout(timer);
 },[shown]);
 useLayoutEffect(()=>{
  if(playback&&!compatible){const authoritative={frames:[{state:props.state,events:QUIET_EVENTS}],at:0,target,done:true};current.current=authoritative;setPlayback(authoritative);props.onVisualSettled?.();}
 },[props.state,compatible]);
 const settled=()=>{
  if(playback&&!compatible){props.onVisualSettled?.();return;}
  const active=current.current;
  if(!active||active.done){props.onVisualSettled?.();return;}
  const at=active.at+1;
  if(at<active.frames.length){const next={...active,at};current.current=next;setPlayback(next);}
  else{const next={...active,done:true};current.current=next;setPlayback(next);props.onVisualSettled?.();}
 };
 return <div className="cascade-playback" style={{display:'contents'}} data-cascade-wave={compatible?playback.at+1:0} data-cascade-total={compatible?playback.frames.length:0} data-cascade-playing={compatible&&!playback.done}>
  <Board {...props} state={frame?.state??props.state} events={playback&&!compatible?QUIET_EVENTS:frame?.events??props.events} action={compatible&&playback.at>0?undefined:props.action} continuingCascade={compatible&&playback.at>0} locked={props.locked||compatible&&!playback.done} onVisualSettled={settled}/>
 </div>;
}
