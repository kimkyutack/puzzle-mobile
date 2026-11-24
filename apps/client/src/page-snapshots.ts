import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';

/** Presentation-only snapshots. They never authorize a claim or a purchase. */
export class PageSnapshots {
 private entries=new Map<string,{owner:string;page:string;at:number;value:unknown}>();
 constructor(private maximum=16,private lifetime=5*60_000){}
 read<T>(owner:string,page:string,now=Date.now()):T|null{
  const entry=this.entries.get(owner+'\0'+page);
  if(!entry)return null;
  if(now-entry.at>=this.lifetime){this.entries.delete(owner+'\0'+page);return null;}
  return entry.value as T;
 }
 put<T>(owner:string,page:string,value:T|null,now=Date.now()){
  const key=owner+'\0'+page;this.entries.delete(key);
  if(value!==null)this.entries.set(key,{owner,page,at:now,value});
  while(this.entries.size>this.maximum)this.entries.delete(this.entries.keys().next().value!);
 }
 clear(){this.entries.clear();}
}
const snapshots=new PageSnapshots();
if(typeof window!=='undefined')window.addEventListener('game-session',()=>snapshots.clear());

export function usePageSnapshot<T>(owner:string,page:string){
 const [state,setState]=useState(()=>({owner,page,data:snapshots.read<T>(owner,page)}));
 const data=state.owner===owner&&state.page===page?state.data:snapshots.read<T>(owner,page);
 const current=useRef({owner,page,data,alive:true});current.current={owner,page,data,alive:current.current.alive};
 useEffect(()=>{current.current.alive=true;return()=>{current.current.alive=false;};},[owner,page]);
 const publish=useCallback((update:SetStateAction<T|null>)=>{
  const value=current.current;
  if(!value.alive||value.owner!==owner||value.page!==page)return;
  const next=typeof update==='function'?(update as (old:T|null)=>T|null)(value.data):update;
  snapshots.put(owner,page,next);value.data=next;setState({owner,page,data:next});
 },[owner,page]);
 return [data,publish] as const;
}
