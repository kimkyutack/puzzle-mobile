import type {TreasureAttempt} from '@garden/contracts';
import type {replayTreasure} from '@garden/content';
import {Button,Icon,names} from './ui';
import {tr} from './i18n';
import background from '../../../packages/assets/event-design-v62/treasure-scene-v72.webp';
import cardBack from '../../../packages/assets/event-design-v62/treasure-card-back-v72.webp';
import cardFace from '../../../packages/assets/event-design-v62/treasure-card-face-v72.webp';
import check from '../../../packages/assets/event-design-v62/attendance-check-v63.webp';
import './treasure-card-scene.css';

interface Props {
 attempt:TreasureAttempt|null;result:ReturnType<typeof replayTreasure>|null;flipped:number[];
 busy:boolean;available:boolean;remaining:number;reset:string;message:string;
 onBegin:()=>void;onFlip:(index:number)=>void;onFinish:()=>void;
}
export default function TreasureCardScene(p:Props){
 const {attempt,result}=p,playing=!!attempt&&attempt.status==='playing'&&result?.status==='playing';
 const pending=!!attempt&&attempt.status==='playing'&&!!result&&result.status!=='playing';
 const reward=attempt?.reward,deck=attempt?.deck??Array.from({length:12},()=>null);
 return <section className="treasure-scene-v72" aria-label={tr('보물 카드')}>
  <img className="treasure-scene-art" src={background} alt="" draggable={false}/>
  <h2 className="treasure-scene-title">{tr('보물 카드')}</h2>
  <div className="treasure-scene-status" aria-live="polite">
   <span><Icon id="chest"/><span>{attempt?<>{tr('찾은 짝')} <b>{(result?.matched.length??0)/2}/6</b></>:<>{tr('오늘 남은 도전')} <b>{p.remaining}/3</b></>}</span></span>
   <span><Icon id="heart"/><span>{attempt?<>{tr('남은 기회')} <b>{Math.max(0,attempt.maxTurns-(result?.turns??0))}</b></>:tr('하트 소모 없음')}</span></span>
  </div>
  <div className="treasure-scene-grid" role="group" aria-label={tr('보물 카드 12장')}>
   {deck.map((color,index)=>{
    const matched=result?.matched.includes(index)??false,shown=!!color&&(p.flipped.includes(index)||matched);
    const contents=<><span className="treasure-scene-card-back"><img src={cardBack} alt="" draggable={false}/></span><span className="treasure-scene-card-face"><img src={cardFace} alt="" draggable={false}/>{color&&<Icon id={'tile_'+color}/>}</span>{matched&&<img className="treasure-scene-matched" src={check} alt="" draggable={false}/>}</>;
    return color?<button key={attempt!.id+index} className="treasure-scene-card" data-shown={shown} data-matched={matched} disabled={p.busy||!playing||matched||p.flipped.length>=2} aria-label={tr('카드')+' '+(index+1)+(shown?' · '+names[color]:'')} aria-pressed={shown} onClick={()=>p.onFlip(index)}>{contents}</button>:<div key={index} className="treasure-scene-card" aria-hidden="true">{contents}</div>;
   })}
  </div>
  <section className="treasure-scene-reward" aria-label={tr('6쌍 완성 보상')}>
   <h3>{tr('6쌍 완성 보상')}</h3>
   <div className="treasure-scene-prizes">
    <span><Icon id="coin"/><strong>{reward?.coins??25}</strong></span>
    {reward?Object.entries(reward.items).filter(([,n])=>(n??0)>0).map(([id,n])=><span key={id}><Icon id={id}/><strong>×{n}</strong></span>):<span><Icon id="bundle_tools_v7"/><strong>{tr('무작위 도구 1개')}</strong></span>}
   </div>
   <p>{p.remaining===0&&!playing?tr('새 도전까지')+' '+p.reset:attempt?tr('오늘 남은 도전')+' '+p.remaining+' / 3':tr('12번 안에 같은 그림 6쌍을 찾아요.')}</p>
  </section>
  {playing?<p className="treasure-scene-guide">{tr('카드를 눌러 뒤집어요')}</p>:<Button className="treasure-scene-action" tone="green" disabled={p.busy||(!pending&&(!p.available||p.remaining===0))} onClick={pending?p.onFinish:p.onBegin}>{p.busy?tr(pending?'보상 확인 중':'카드 준비 중'):pending?tr('보상 다시 확인'):attempt?tr(p.remaining?'한 번 더 도전':'오늘 도전 완료'):tr(p.remaining?'보물 카드 시작':'오늘 도전 완료')}</Button>}
  {p.message&&<p className="treasure-scene-feedback" role="status">{p.message}</p>}
 </section>;
}
