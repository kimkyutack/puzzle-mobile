import {tr} from "./i18n";
import {useEffect,useId,useMemo,useState} from 'react';
import type {Player,StoryScene,StoryState} from '@garden/contracts';
import {BRIDGE_EPISODE,rescueUnlocked,RESTORATIONS,STORY_SCENES,STORY_SPEAKERS} from '@garden/content';
import {Amount,Button,Icon,LinkAction,Modal,Poster,Card} from './ui';
import {serverNow} from './api';
import {dailyRescueCacheKey,restoreRescue} from './rescue-progress';
import {sound,startMusic} from './sound';
import './story-ui.css';
import './rescue.css';

interface ViewerProps {scene:StoryScene;busy:boolean;error:string;onClose:()=>void}
export function StoryViewer({scene,busy,error,onClose}:ViewerProps){
 const [index,setIndex]=useState(0),speakerId=useId();
 const beatIndex=Math.min(index,scene.beats.length-1),beat=scene.beats[beatIndex]!,speaker=STORY_SPEAKERS[beat.speaker];
 const last=beatIndex===scene.beats.length-1;
 const close=()=>{if(!busy)onClose();};
 return <Modal theme="sky" title={tr(scene.title)} onClose={close}>
  <div className="story-viewer" data-story-scene={scene.id} data-story-beat={beatIndex} aria-busy={busy}>
   <Poster id={scene.art} className="story-viewer-art" label={tr(scene.title)+tr(" 이야기 장면")}/>
   <section className="story-dialogue" data-content-group data-frame="card_sage_v6" data-frame-scale="0.2" data-story-speaker={beat.speaker} aria-labelledby={speakerId}>
    <div key={beat.speaker+'-'+beatIndex} className="story-speaker-art"><Icon id={speaker.art} size={85}/></div>
    <div className="story-dialogue-copy"><h3 id={speakerId}>{tr(speaker.name)}</h3><p key={beatIndex} aria-live="polite" aria-atomic="true">{tr(beat.text)}</p></div>
   </section>
   <div className="story-viewer-controls">
    <p className="story-beat-count" aria-label={tr("이야기 {0}/{1}",{0:(beatIndex+1),1:(scene.beats.length)})}>{beatIndex+1} / {scene.beats.length}</p>
    {error&&<p className="story-viewer-error" role="alert">{tr(error)}</p>}
    {error?<Button className="story-next" tone="green" disabled={busy} onClick={close}>{busy?tr("잠시만요…"):tr("다시 시도")}</Button>:<Button className="story-next" tone="green" disabled={busy} onClick={()=>last?close():setIndex(value=>Math.min(value+1,scene.beats.length-1))}>{busy?tr("잠시만요…"):last?tr("이야기 마치기"):tr("다음")}</Button>}
    {!last&&!error&&<LinkAction className="story-skip" disabled={busy} onClick={close}>{tr("건너뛰기")}</LinkAction>}
   </div>
  </div>
 </Modal>;
}

interface JournalProps {story:StoryState|null;player:Player;loading:boolean;error:string;onRetry:()=>void;onPlay:(scene:StoryScene)=>void;onClose:()=>void;onEpisode:()=>void}
export function StoryJournal({story,player,loading,error,onRetry,onPlay,onClose,onEpisode}:JournalProps){
 const scenes=STORY_SCENES,unlocked=new Set(story?.unlocked??[]),seen=new Set(story?.seen??[]);
 const read=scenes.filter(scene=>seen.has(scene.id)).length,open=scenes.filter(scene=>unlocked.has(scene.id)).length;
 const featured=scenes.find(scene=>unlocked.has(scene.id)&&!seen.has(scene.id))??[...scenes].reverse().find(scene=>unlocked.has(scene.id))??scenes[0]!;
 const daily=story?.dailyRescue,currentDaily=!!daily&&daily.endsAt>serverNow();
 const hasProgress=useMemo(()=>{if(!daily)return false;try{return restoreRescue(localStorage.getItem(dailyRescueCacheKey(player.id,daily.periodId))).actions.length>0;}catch{return false;}},[player.id,daily?.periodId]);
 useEffect(()=>{if(!daily)return;const timer=setTimeout(onRetry,Math.max(50,daily.endsAt-serverNow()+50));return()=>clearTimeout(timer);},[daily?.endsAt,onRetry]);
 return <Modal theme="sky" title={tr("루미의 기록")} onClose={onClose} wide>
  <div className="story-journal" data-story-flow="continuous">
   <Card className="rescue-journal-card" tone="gold"><Poster id={BRIDGE_EPISODE.scene} label={tr("토리가 기다리는 구름다리")}/><h3>{tr("구름길 구조대")}</h3><p>{tr('성공 보상은 하루 한 번 받을 수 있어요.')}</p>{daily&&<div className="rescue-daily-reward"><span>{tr('오늘의 보상')}</span><Amount kind={daily.reward.item} value={'+'+daily.reward.quantity}/></div>}<Button icon="tori_v8" disabled={loading||!rescueUnlocked(player)||!currentDaily||!!daily?.claimed} onClick={onEpisode}>{!rescueUnlocked(player)?tr("7판 완료 후 열려요"):!currentDaily?tr('도전 준비 중…'):daily?.claimed?tr('오늘 보상 수령 완료'):hasProgress?tr('이어서 도와주기'):tr('오늘의 구조 도전')}</Button>{daily?.claimed&&currentDaily&&<p className="rescue-daily-reset">{tr('한국 시간 자정에 새 도전이 열려요.')}</p>}</Card>
   <section aria-label={tr('이어지는 정원 이야기')}>
    <Poster id={featured.art} className="story-journal-cover" label={tr(featured.title)}><figcaption className="poster-caption" data-frame="event_sky_v9" data-frame-scale="0.08">{tr('감상')}{' '}{read} / {scenes.length}</figcaption></Poster>
    <h3 className="story-chapter-title">{tr('한 통의 편지로 이어지는 정원')}</h3><p className="story-chapter-summary">{tr('복원한 정원마다 다음 이야기가 기다려요.')}</p>
    <div className="story-journal-progress" data-frame="card_ice_v9" data-frame-scale="0.14"><span>{tr('열린 이야기')}{' '}{open}{tr('편')}</span><span>{tr('감상')}{' '}{read}</span></div>
    {error&&<div className="story-journal-error" data-frame="card_gold_v4" data-content-group><p role="alert">{tr(error)}</p><Button tone="blue" disabled={loading} onClick={onRetry}>{loading?tr("불러오는 중…"):tr("다시 불러오기")}</Button></div>}
    {loading&&!story?<p className="story-journal-loading" role="status">{tr("이야기 기록을 펼치는 중…")}</p>:!story&&!error?<div className="story-journal-error" data-frame="card_sage_v6"><p>{tr("이야기 기록을 다시 불러와 주세요.")}</p><Button tone="blue" onClick={onRetry}>{tr("다시 불러오기")}</Button></div>:<ol className="story-scene-list" aria-label={tr("이어지는 이야기 목록")}>{scenes.map((scene,index)=>{
     const available=unlocked.has(scene.id),finished=seen.has(scene.id),task=RESTORATIONS.find(task=>task.id===scene.taskId);
     const contents=<><Icon id="story_letter_v8" size={43}/><span className="story-entry-copy"><strong>{tr(scene.title)}</strong><small>{available?(finished?tr("감상한 이야기"):tr("새 이야기")):task?tr(task.name)+tr(" 후 열려요"):tr("첫 퍼즐을 완료하면 열려요")}</small></span>{available&&<span className="story-entry-action" data-frame={finished?'button_mint_v6':'button_coral_v6'} data-frame-scale="0.08">{finished?tr("다시 보기"):tr("읽기")}</span>}</>;
     return <li key={scene.id} data-story-entry={scene.id}>{available?<button className="story-entry" data-frame={finished?'card_sage_v6':'card_green_v4'} data-frame-scale="0.15" data-content-group aria-label={`${index+1}. ${tr(scene.title)} · ${finished?tr("다시 보기"):tr("읽기")}`} onClick={()=>{sound('button');startMusic();onPlay(scene);}}>{contents}</button>:<div className="story-entry story-entry-locked" data-frame="card_sage_v6" data-frame-scale="0.15" data-content-group>{contents}</div>}</li>;
    })}</ol>}
    <p className="story-journal-note">{tr("정원을 복원하면 새로운 이야기가 열려요.")}<br/>{tr("감상한 장면은 언제든 다시 볼 수 있어요.")}</p>
   </section>
  </div>
 </Modal>;
}
