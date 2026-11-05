import {tr} from "./i18n";
import type {Player,PreBooster} from '@garden/contracts';
import {getLevel,APPROVED_LEVEL_COUNT} from '@garden/content';
import {goalArt} from './assets';
import {Amount,Button,Card,Icon,Modal,names} from './ui';
interface Props {player:Player;engineVersion?:string;error?:string;selected:PreBooster[];busy:boolean;unlimited:boolean;onToggle:(item:PreBooster)=>void;onPlay:()=>void;onClose:()=>void}
export default function StartLevelModal({player,engineVersion,error,selected,busy,unlimited,onToggle,onPlay,onClose}:Props){
 if(player.level>APPROVED_LEVEL_COUNT)return <Modal title={tr('다음 퍼즐')} onClose={onClose}><Card title={tr('다음 정원을 준비하고 있어요')}><Icon id="lumi" size={120}/><p>{tr('공개된 퍼즐을 모두 완료했어요. 다음 업데이트에서 새로운 퍼즐을 만나요!')}</p></Card><Button onClick={onClose}>{tr('정원으로')}</Button></Modal>;
 const level=getLevel(player.level,engineVersion);
 return <Modal theme="garden" title={tr("레벨 ")+level.id} onClose={onClose}>
  <div className="start-level-layout">
   {level.campaign&&['introduction','practice','celebration'].includes(level.campaign.beat)&&<p className="intro" data-campaign-beat={level.campaign.beat}>{tr(level.campaign.beat==='introduction'?'새로운 규칙을 만나봐요':level.campaign.beat==='practice'?'새 규칙을 가볍게 연습해요':'시원하게 터뜨리는 연쇄 축제')}</p>}
   <section className="start-objectives" data-frame="card_peach_v9" data-content-group aria-labelledby="start-goal-title"><h3 id="start-goal-title">{tr("이번 퍼즐 목표")}</h3><div className="start-goals" data-goal-count={level.goals.length}>{level.goals.map(goal=><div key={goal.kind}><Icon id={goalArt(goal.kind)} size={46}/><strong>{goal.count}</strong><span className="sr-only">{names[goal.kind]}</span></div>)}</div></section>
   {level.strategy&&<section className="start-strategy" data-frame="card_blue_v4" data-frame-scale="0.12"><strong>{tr(level.strategy.name)}</strong><p>{tr(level.strategy.hint)}</p></section>}
   <section className="start-tool-well" data-frame="event_violet_v9" data-frame-scale="0.16" data-content-group aria-labelledby="start-tool-title"><h3 id="start-tool-title">{tr("시작 도구")}</h3><div className="preboosters">{(['wind-row','bomb','rainbow'] as const).map(item=>{const count=(player.inventory[item]?.normal||0)+(player.inventory[item]?.bound||0),active=selected.includes(item);return <button key={item} className={active?'selected':''} aria-pressed={active} aria-label={names[item]+tr(" · 보유 ")+count} disabled={busy} onClick={()=>onToggle(item)}><span className="prebooster-art"><Icon id="booster_socket" size={68}/><Icon id={item} size={49}/></span><span className="prebooster-stock" data-frame={active?'button_coral_v6':'button_mint_v6'} data-frame-scale="0.08">{active?tr("선택"):count}</span><small>{names[item]}</small></button>})}</div><p>{tr("선택한 도구는 시작할 때 사용해요.")}</p></section>
   <div className={"start-play-action"+(busy?" is-preparing":"")} aria-busy={busy} aria-live="polite">{error&&!busy&&<p className="start-error" role="alert">{error}</p>}<Button tone="green" icon={busy?"lumi":undefined} disabled={busy} onClick={onPlay}>{busy?tr("퍼즐 준비 중…"):tr("플레이")}</Button><div className="heart-cost"><Amount kind="heart" value={unlimited?'∞':1}/><span>{unlimited?tr("무제한 이용 중"):tr("실패할 때만 사용")}</span></div></div>
  </div>
 </Modal>;
}
