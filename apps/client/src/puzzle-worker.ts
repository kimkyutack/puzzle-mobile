import {actionWithFrames} from '@garden/core';
import type {Action,GameState} from '@garden/contracts';

self.onmessage=(event:MessageEvent<{id:number;state:GameState;action:Action}>)=>{
 const {id,state,action}=event.data;
 try{self.postMessage({id,result:actionWithFrames(state,action)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:'PUZZLE_CALCULATION_FAILED'});}
};
