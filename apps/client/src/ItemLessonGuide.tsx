import type {ItemGuide} from './item-guidance';
import {Button,Icon,Modal} from './ui';
import {tr,itemName} from './i18n';
import './item-lesson.css';

const instructions=[
 ['같은 색 타일 4개를 한 줄로 맞추면 로켓이 생겨요. 표시된 타일을 옮겨 보세요.','로켓을 눌러 보세요! 화살표 방향의 한 줄을 시원하게 정리해요.'],
 ['같은 색 타일 4개를 네모로 맞추면 {0} 아이템이 생겨요.','{0} 아이템을 눌러 보세요! 날아가서 목표가 있는 칸을 도와줘요.'],
 ['같은 색 타일 5개를 T자나 L자로 맞추면 꽃폭탄이 생겨요.','꽃폭탄을 눌러 보세요! 주변 타일을 한꺼번에 정리해요.'],
 ['같은 색 타일 5개를 한 줄로 맞추면 무지개등이 생겨요.','무지개등을 눌러 보세요! 한 가지 색 타일을 모두 모아요.'],
 ['한 번의 이동으로 두 곳에서 3개씩 맞추면 {0} 아이템이 생겨요.','{0} 아이템을 눌러 보세요! 여러 마리가 날아가 목표를 도와줘요.'],
] as const;
export function itemLessonHint(guide:ItemGuide){
 const action=guide.action;
 return action.type==='swap'?{from:action.from,to:action.to,cells:guide.cells}:{from:action.at,to:action.at,cells:guide.cells};
}
export function ItemLessonGuide({guide,waiting}:{guide:ItemGuide;waiting:boolean}){
 const index=guide.kind==='wind-row'||guide.kind==='wind-column'?0:guide.kind==='glider'?1:guide.kind==='bomb'?2:guide.kind==='rainbow'?3:4;
 return <section className="item-lesson-guide" aria-live="polite" aria-label={tr('루미의 아이템 안내')}>
  <Icon id="lumi_happy" size={78}/><div className="item-lesson-speech"><small>{tr('루미')}<span>{itemName(guide.kind)}</span></small><p>{tr(waiting?'잘했어요! 아이템의 힘을 살펴봐요.':instructions[index]![guide.phase==='make'?0:1],{0:itemName(guide.kind)})}</p></div>
 </section>;
}
export function ItemLessonInvitation({busy,error,onPlay,onClose}:{busy:boolean;error:string;onPlay:()=>void;onClose?:()=>void}){
 return <Modal theme="garden" title={tr('루미와 다음 퍼즐로!')} className="item-lesson-invitation" onClose={onClose}>
  <Icon id="lumi_happy" size={112}/><h3>{tr('정원이 살아났어요! 다음 퍼즐도 함께 해요.')}</h3><p>{tr('아이템을 만들 수 있는 타일 배치를 발견하면 제가 알려드릴게요!')}</p>
  {error&&<p role="alert">{error}</p>}
  <Button tone="green" disabled={busy} onClick={onPlay}>{tr(busy?'준비 중…':'다음 퍼즐 시작')}</Button>
 </Modal>;
}
