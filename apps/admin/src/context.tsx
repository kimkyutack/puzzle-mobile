import {createContext,useContext} from 'react';
import type {AdminIdentity} from '../../../packages/contracts/src/operations';
export interface ConsoleContext {admin:AdminIdentity;canWrite:boolean;confirm:(title:string,summary:string,action:(reason:string,key:string)=>Promise<void>,danger?:boolean)=>void;notify:(text:string)=>void;navigate:(page:string,query?:string)=>void}
export const Context=createContext<ConsoleContext|null>(null);
export function useConsole(){return useContext(Context)!;}
