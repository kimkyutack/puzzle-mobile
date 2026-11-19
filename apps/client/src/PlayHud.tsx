import {EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import {WORLD_ART} from './garden-world/assets';
import type {ExpeditionAnimal} from '@garden/contracts';
import {supportsVisibleTargets,type Booster,type GameState} from '@garden/contracts';
import type {CSSProperties} from 'react';
import {art,goalArt} from './assets';
import {tr,useI18n} from './i18n';
import {Icon,names} from './ui';
import './play-hud-v32.css';

/** Goals own the available width; Lumi decorates the rim rather than a column. */
export default function PlayHud({state,moves=state.moves,tool,locked,onCancelTool,animal='rabbit'}:{state:GameState;animal?:'rabbit'|ExpeditionAnimal;moves?:number;tool:Booster|null;locked:boolean;onCancelTool:()=>void}){
 const {t}=useI18n(),count=state.goals.length,columns=count===4?2:Math.min(3,Math.max(1,count)),rows=Math.ceil(count/columns);
 const style={'--hud-goal-columns':columns,'--hud-goal-rows':rows} as CSSProperties;
 return <header className="play-hud play-hud-v32" data-frame="play_hud_band_v32" data-frame-scale="0.32" data-goal-count={count} data-goal-rows={rows} style={style}>
  <section className="hud-goals-v32" data-frame="play_hud_goals_v32" data-frame-scale="0.38" aria-label={t('hud.goals')}>
   <span className="hud-goal-heading-v32">{t('hud.goals')}</span>
   <div className="hud-goal-list-v32" role="list">
    {state.goals.map(goal=><div className={'hud-goal-v32'+(goal.remaining===0?' is-complete':'')} key={goal.kind} role="listitem" aria-label={`${goal.kind==='garden-route'&&animal!=='rabbit'?tr(EXPEDITION_ANIMALS[animal].name):goal.kind==='device'?tr('장치 작동'):names[goal.kind==='pipe'&&Object.values(state.obstacles).some(o=>o.endOnly)?'magnet-rail':goal.kind]??goal.kind} ${goal.remaining===0?t('common.done'):goal.remaining}`}>
     {goal.kind==='garden-route'&&animal!=='rabbit'?<img className="hud-expedition-animal" src={WORLD_ART[EXPEDITION_ANIMALS[animal].itemId]} alt=""/>:<Icon id={goal.kind==='frost'&&!supportsVisibleTargets(state.engineVersion)?'frost_floor_v19':goalArt(goal.kind,state)} size={34}/>}
     <strong className={goal.remaining===0?'goal-complete':undefined}>{goal.remaining===0?t('common.done'):goal.remaining}</strong>
    </div>)}
   </div>
  </section>
  <div className="hud-mascot-v32">
   {tool?<button className="hud-tool-v32" disabled={locked} aria-label={tr('{0} 취소',{0:names[tool]})} onClick={onCancelTool}>
    <Icon id="booster_socket" size={48}/><Icon id={tool} size={33}/><span data-frame="event_sky_v9" data-frame-scale="0.04">{tr('취소')}</span>
   </button>:<><Icon id="portrait_frame" size={48}/><span className="hud-lumi-window-v32"><img className="hud-lumi-v32" src={art(state.status==='won'?'lumi_happy':moves<=5?'lumi_focus':'lumi')} alt={tr('루미')} draggable={false}/></span></>}
  </div>
  <div className="hud-moves-v32" data-frame="hud_moves" data-frame-scale="0.28" data-move-digits={Math.min(4,String(moves).length)} aria-label={`${t('hud.moves')} ${moves}`}>
   <span>{t('hud.moves')}</span><strong>{moves}</strong>
  </div>
 </header>;
}
