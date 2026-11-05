import {tr} from "./i18n";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {GardenStyle,Player,StoryState} from '@garden/contracts';
import {STORY_SCENES,getUnlockedStories} from '@garden/content';
import {request} from './api';
import {pendingScenes,enqueueStoryScene,confirmStoryScenes} from './story-progress';
/** Story acknowledgements are retryable and never share the economic mutation queue. */
export function useStory(player:Player|null,notify:(message:string)=>void){
 const [story,setStory]=useState<StoryState|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [saving,setSaving]=useState(false),[styleBusy,setStyleBusy]=useState(false);
 const identity=useRef(player?.id),generation=useRef(0),flushing=useRef<Promise<boolean>|null>(null),styleGuard=useRef(false);
 const latestPlayer=useRef(player);latestPlayer.current=player;
 identity.current=player?.id;
 const id=player?.id,level=player?.level,restored=player?.restored.join('|');
 const commit=useCallback((value:StoryState,userId:string)=>{
  if(identity.current!==userId)return;
  const queued=pendingScenes(userId);
  setStory(previous=>({...value,unlocked:[...new Set([...value.unlocked,...(latestPlayer.current?getUnlockedStories(latestPlayer.current):[])])],seen:[...new Set([...(previous?.seen||[]),...value.seen,...queued])]}));
 },[]);
 const reload=useCallback(async()=>{
  if(!id)return;const ticket=++generation.current;setLoading(true);setError('');
  try{const value=await request<StoryState>('/story');if(ticket===generation.current)commit(value,id);}
  catch(cause){if(ticket===generation.current)setError(cause instanceof Error?cause.message:tr("이야기를 불러오지 못했어요."));}
  finally{if(ticket===generation.current)setLoading(false);}
 },[id,commit]);
 const flush=useCallback(async():Promise<boolean>=>{
  if(!id||!navigator.onLine)return false;if(flushing.current)return flushing.current;
  const operation=(async()=>{
   try{while(identity.current===id){const queued=pendingScenes(id).slice(0,19);if(!queued.length)return true;
    const value=await request<StoryState>('/story/seen',{sceneIds:queued});
    if(identity.current!==id)return false;
    confirmStoryScenes(id,queued);commit(value,id);
   }return false;}
   catch{return false;}
  })();flushing.current=operation;
  try{return await operation;}finally{if(flushing.current===operation)flushing.current=null;}
 },[id,commit]);
 useEffect(()=>{setStory(null);setError('');},[id]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{if(!player)return;const unlocked=getUnlockedStories(player);setStory(previous=>previous?{...previous,unlocked}:previous);},[id,level,restored]);
 useEffect(()=>{if(!id)return;const resume=()=>{void flush().then(()=>reload());};void flush();const timer=setInterval(()=>{if(pendingScenes(id).length)void flush();},10000);window.addEventListener('online',resume);return()=>{clearInterval(timer);window.removeEventListener('online',resume);};},[id,flush,reload]);
 const acknowledge=async(sceneId:string)=>{
  if(!id||!STORY_SCENES.some(scene=>scene.id===sceneId))return;
  if(story?.seen.includes(sceneId)&&!pendingScenes(id).includes(sceneId))return;
  ++generation.current;setLoading(false);setSaving(true);
  try{
   enqueueStoryScene(id,sceneId);
   setStory(previous=>previous?{...previous,seen:[...new Set([...previous.seen,sceneId])]}:previous);
   void flush().then(saved=>{if(!saved&&identity.current===id)notify(tr("연결되면 감상 기록을 저장할게요."));});
  }finally{setSaving(false);}
 };
 const chooseStyle=async(taskId:string,style:GardenStyle)=>{
  if(!id||styleGuard.current)return;styleGuard.current=true;++generation.current;setLoading(false);setStyleBusy(true);
  try{const value=await request<StoryState>('/garden/style',{taskId,style});commit(value,id);notify(tr("정원에 새로운 모습을 입혔어요."));}
  catch(cause){notify(cause instanceof Error?cause.message:tr("장식을 바꾸지 못했어요. 연결을 확인해 주세요."));}
  finally{styleGuard.current=false;setStyleBusy(false);}
 };
 return {story,loading,error,saving,styleBusy,reload,acknowledge,chooseStyle};
}
