import {tr} from "./i18n";
import {useEffect,useState} from 'react';
import type {Player,RankingEntry,RankingScope,RankingsResponse} from '@garden/contracts';
import {getRankings} from './api';
import {Button,Card,Icon} from './ui';
import {sound} from './sound';
import './ranking.css';
import {useFriendProfiles} from './FriendProfiles';

const emblems=['guild','tile_flower','tile_sprout','tile_drop','tile_sun','tile_acorn','star','heart'];
const number=(value:number)=>value.toLocaleString('ko-KR');
const rankText=(entry:RankingEntry)=>entry.rank===null?tr("기록 없음"):tr("{0}{1}위",{0:(entry.tied?tr("공동 "):''),1:(number(entry.rank))});
const entryIcon=(entry:RankingEntry)=>entry.emblem===undefined?'lumi':emblems[entry.emblem]||'guild';
function Position({entry}:{entry:RankingEntry}){
 const frame=entry.rank===1?'card_gold_v4':entry.rank===2?'card_sage_v6':entry.rank===3?'card_green_v4':undefined;
 return <span className={'ranking-position'+(entry.rank!==null&&entry.rank>999?' ranking-position-wide':'')} data-frame={frame} data-frame-scale="0.1" title={rankText(entry)} aria-label={rankText(entry)}><strong>{entry.rank===null?'—':number(entry.rank)}</strong></span>;
}
function Entry({entry,scope,mine=false}:{entry:RankingEntry;scope:RankingScope;mine?:boolean}){
 const {openProfile}=useFriendProfiles();
 return <div className="ranking-entry" data-frame={mine?'card_green_v4':'card_sage_v6'} data-frame-scale="0.16" data-current={mine||undefined} data-rank={entry.rank??'unranked'} data-content-group aria-label={`${rankText(entry)} · ${entry.name} · ${number(entry.score)}${scope!=='guilds'?tr("레벨 완료"):tr("합계")}${mine?tr(" · 내 기록"):''}`}>
  <Position entry={entry}/>{scope!=='guilds'?<button className="ranking-avatar" aria-label={entry.name+' '+tr("프로필 보기")} onClick={()=>openProfile(entry.id)}><Icon id={entryIcon(entry)} size={38}/></button>:<Icon id={entryIcon(entry)} size={38}/>}
  <div className="ranking-name"><strong title={entry.name}>{scope!=='guilds'?<button onClick={()=>openProfile(entry.id)} aria-label={entry.name+' '+tr("프로필 보기")}>{entry.name}</button>:entry.name}</strong>{scope==='guilds'?<small>{entry.members??0}{tr("명")}{mine?tr(" · 우리 길드"):''}</small>:mine?<small className="ranking-you">{tr("내 기록")}</small>:null}</div>
  <div className="ranking-score"><Icon id="star" size={24}/><strong>{number(entry.score)}</strong></div>
 </div>;
}

export default function RankingMenu({player,onGuild,friendsOnly=false}:{player:Player;onGuild?:()=>void;friendsOnly?:boolean}){
 const {revision}=useFriendProfiles();
 const [scope,setScope]=useState<RankingScope>(friendsOnly?'friends':'players'),[data,setData]=useState<RankingsResponse|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let current=true,sequence=0;setData(null);setError('');const load=()=>{const sent=++sequence;void getRankings(scope).then(result=>{if(current&&sent===sequence){setData(result);setError('')}},cause=>{if(current&&sent===sequence)setError(cause instanceof Error?cause.message:tr("순위를 불러오지 못했어요."));});};load();const timer=scope==='friends'?setInterval(()=>{if(document.visibilityState==='visible')load()},15000):undefined;window.addEventListener('focus',load);return()=>{current=false;clearInterval(timer);window.removeEventListener('focus',load);};},[scope,player.id,refresh,revision]);
 const listedMe=!!data?.me&&data.entries.some(entry=>entry.id===data.me!.id);
 return <div className="ranking-menu">
  {!friendsOnly&&<div className="ranking-tabs" role="group" aria-label={tr("순위 종류")}>{([['players','lumi',tr("개인")],['friends','lumi_happy',tr("친구")],['guilds','guild',tr("길드")]] as const).map(([value,icon,label])=><button key={value} className="ranking-scope-tab" aria-pressed={scope===value} data-frame={scope===value?'button_play':'button_secondary'} data-frame-scale="0.13" onClick={()=>{sound('button');setScope(value)}}><Icon id={icon} size={29}/><span>{label}</span></button>)}</div>}
  <div className="ranking-table-heading" aria-hidden="true"><span>{tr("순위")}</span><span>{scope!=='guilds'?tr("정원사"):tr("길드")}</span><span>{scope!=='guilds'?tr("완료 레벨"):tr("클리어 합계")}</span></div>
  {error?<Card title={tr("순위를 불러오지 못했어요")} className="ranking-message"><Icon id="star" size={62}/><p role="alert">{tr(error)}</p><Button icon="shuffle" onClick={()=>setRefresh(value=>value+1)}>{tr("다시 불러오기")}</Button></Card>:!data?<Card className="ranking-message"><Icon id="star" size={62}/><p role="status">{tr("순위를 불러오는 중…")}</p></Card>:<>
   {data.entries.length>0?<ol className="ranking-list" aria-label={scope!=='guilds'?tr("정원사 순위"):tr("길드 순위")}>{data.entries.map(entry=><li key={entry.id}><Entry entry={entry} scope={scope} mine={entry.isMine||entry.id===data.me?.id}/></li>)}</ol>:<Card className="ranking-message"><Icon id={scope!=='guilds'?'star':'guild'} size={68}/><p>{tr("첫 기록을 기다리고 있어요.")}</p></Card>}
   {!listedMe&&data.me&&<section className="ranking-own-record" aria-label={scope!=='guilds'?tr("내 기록"):tr("우리 길드 기록")}><h3>{scope!=='guilds'?tr("내 기록"):tr("우리 길드")}</h3><Entry entry={data.me} scope={scope} mine/>{data.me.rank===null&&<p>{tr("퍼즐을 완료하면 순위에 올라요.")}</p>}</section>}
   {scope==='guilds'&&!data.me&&<Card className="ranking-join"><Icon id="guild" size={43}/><p>{tr("길드에 가입하고 함께 도전해요.")}</p>{onGuild&&<Button icon="guild" onClick={onGuild}>{tr("길드 찾기")}</Button>}</Card>}
   <div className="ranking-list-note"><span>{scope==='friends'?tr("나와 친구"):tr("참여")} {number(data.participants)}{scope!=='guilds'?tr("명"):tr("개 길드")}{scope!=='friends'&&<>{' '}{tr("· 상위")}{' '}{data.limit}{scope!=='guilds'?tr("명"):tr("개")}</>}</span><span>{tr("같은 기록은 공동 순위")}</span></div>
  </>}
 </div>;
}
