import {tr} from "./i18n";
import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import type {Player,GardenStyle,StoryState} from '@garden/contracts';
import {RESTORATIONS,AREAS} from '@garden/content';
import {art,assetInfo} from './assets';
import {Amount,Button,Icon,IconButton} from './ui';
export type GardenTask=typeof RESTORATIONS[number];
export interface RestorationVisual {taskId:string;phase:'building'|'revealed';nonce:number}
// Coordinates refer to the actual 1080x2340 background, never a UI inset box.
const anchors=[
 [[.50,.621,.29],[.11,.621,.235],[.89,.621,.23],[.11,.744,.23],[.50,.744,.33],[.89,.744,.27]],
 [[.50,.570,.29],[.19,.640,.28],[.80,.640,.27],[.18,.748,.23],[.50,.748,.31],[.82,.748,.27]],
 [[.50,.724,.26],[.22,.646,.29],[.80,.646,.25],[.20,.555,.22],[.80,.555,.26],[.50,.539,.37]]
];
// Site labels must paint above their own world image, rather than on the scene's
// background compositor. This nine-slices the same authored PNG in DOM order.
function SiteLabelArt({id,scale}:{id:string;scale:number}){
 const inset=assetInfo(id)!.sliceInsets!;
 return <span aria-hidden="true" className="site-label-art" style={{borderStyle:'solid',borderColor:'transparent',borderWidth:`${inset.top*scale}px ${inset.right*scale}px ${inset.bottom*scale}px ${inset.left*scale}px`,borderImageSource:`url("${art(id)}")`,borderImageSlice:`${inset.top} ${inset.right} ${inset.bottom} ${inset.left} fill`,borderImageWidth:1,borderImageRepeat:'stretch'}}/>;
}
export function GardenScene({player,area,editing,selected,visual,onSelect,showUnrestored=true,styles={}}:{player:Player;area:number;editing:boolean;selected:string;visual:RestorationVisual|null;onSelect:(task:GardenTask)=>void;showUnrestored?:boolean;styles?:StoryState['styles']}){
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({w:390,h:844,actionTop:Infinity});
 useLayoutEffect(()=>{
  const el=ref.current!,actions=el.parentElement?.querySelector<HTMLElement>('.hub-main-actions'),footer=el.closest('.game-shell')?.querySelector<HTMLElement>('.hub-navigation');
  const measure=()=>{const bounds=el.getBoundingClientRect(),ratio=bounds.height/el.clientHeight||1;const next={w:el.clientWidth,h:el.clientHeight,actionTop:actions?(actions.getBoundingClientRect().top-bounds.top)/ratio:Infinity};setSize(previous=>previous.w===next.w&&previous.h===next.h&&previous.actionTop===next.actionTop?previous:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(el);if(actions)observer.observe(actions);if(footer)observer.observe(footer);return()=>observer.disconnect();
 },[editing]);
 const scale=Math.max(size.w/1080,size.h/2340),ox=(size.w-1080*scale)/2,oy=(size.h-2340*scale)/2;
 return <div ref={ref} className={`garden-scene ${editing?'is-editing':''}`} aria-label={tr("정원 건물")} data-garden-area={AREAS[area]?.id}>
  {RESTORATIONS.slice(area*6,area*6+6).map((task,index)=>{
   const point=anchors[area]![index]!,done=player.restored.includes(task.id),active=visual?.taskId===task.id;
   if(!editing&&!showUnrestored&&!done)return null;
   const shown=done&&!(active&&visual.phase==='building');
   const style={left:ox+point[0]!*1080*scale,top:oy+point[1]!*2340*scale,width:point[2]!*1080*scale,zIndex:Math.round(point[1]!*100)} as CSSProperties;
   return <button key={task.id} type="button" style={style} className={`garden-site ${editing&&selected===task.id?'is-selected':''} ${active?'is-'+visual.phase:''}`} aria-label={`${tr(task.name)} · ${done?tr("복원 완료"):tr("복원 전")}`} aria-pressed={editing?selected===task.id:undefined} data-task-id={task.id} data-restored={shown} onClick={()=>onSelect(task)} disabled={!!visual}>
    {editing&&selected===task.id&&<Icon className="site-selection" id="fx_ring" size={120}/>}
    <img className="garden-object" src={art(shown&&styles[task.id]==='festival'?task.asset+'_festival_v8':task.asset+'_'+(shown?'after':'before'))} alt={tr(task.name)+' '+(shown?styles[task.id]==='festival'?tr("축제 장식"):tr("복원 후"):tr("복원 전"))} data-garden-style={shown?styles[task.id]||'classic':'unrestored'} draggable={false}/>
    {editing&&!done&&!active&&<span className="site-price"><SiteLabelArt id="resource_pearl_v9" scale={.1}/><Amount kind="star" value={task.cost}/></span>}
    {editing&&done&&!active&&<span className="site-completed"><SiteLabelArt id="resource_pearl_v9" scale={.09}/><span>{tr("완료")}</span></span>}
    {active&&<span key={visual.nonce} className="restoration-fx" aria-hidden="true"><Icon className="build-smoke smoke-a" id="fx_smoke" size={100}/><Icon className="build-smoke smoke-b" id="fx_smoke" size={100}/><Icon className="build-ring" id="fx_ring" size={150}/>{Array.from({length:7},(_,i)=><Icon key={i} className={'build-spark spark-'+i} id={i%2?'sparkle':'star'} size={25}/>)}</span>}
   </button>;
  })}
  {([{id:'tori',task:'sky-bench',points:[[.775,.635,.115],[.34,.67,.115],[.68,.71,.115]]},{id:'naru',task:'sky-fountain',points:[[.685,.755,.17],[.65,.755,.17],[.36,.76,.17]]}] as const).map(resident=>{
   if(!player.restored.includes(resident.task)||(visual?.taskId===resident.task&&visual.phase==='building'))return null;
   const [x,y,width]=resident.points[area]!;
   const residentWidth=width*1080*scale,top=Math.min(oy+y*2340*scale,size.actionTop-8-residentWidth*.12);
   return <img key={resident.id} data-resident={resident.id} className={'garden-resident resident-'+resident.id} src={art(resident.id+'_v8')} alt={resident.id==='tori'?tr("편지를 배달하는 토리"):tr("정원을 살피는 나루")} draggable={false} style={{left:ox+x*1080*scale,top,width:residentWidth,zIndex:Math.round(y*100)+1}}/>;
  })}
 </div>;
}
export function GardenEditor({player,area,onArea,selected,onSelect,busy,visual,onRestore,onClose,styles={},styleBusy=false,styleReady=false,onStyle}:{player:Player;area:number;onArea:(area:number)=>void;selected:string;onSelect:(task:GardenTask)=>void;busy:boolean;visual:RestorationVisual|null;onRestore:(task:GardenTask)=>void;onClose:()=>void;styles?:StoryState['styles'];styleBusy?:boolean;styleReady?:boolean;onStyle?:(taskId:string,style:GardenStyle)=>void}){
 const tasks=RESTORATIONS.slice(area*6,area*6+6),task=tasks.find(t=>t.id===selected)||tasks.find(t=>!player.restored.includes(t.id))||tasks[0]!;
 const done=player.restored.includes(task.id),missing=Math.max(0,task.cost-player.stars),next=tasks.find(t=>!player.restored.includes(t.id));
 const canStyle=done&&['bench','lamp','planter'].includes(task.asset)&&!!onStyle;
 return <>
  <nav className="garden-area-tabs" aria-label={tr("꾸밀 정원")}>{AREAS.map((a,i)=><button key={a.id} aria-pressed={area===i} disabled={busy||!!visual} data-frame={area===i?'button_gold':'button_secondary'} data-frame-scale="0.14" onClick={()=>onArea(i)}><Icon id={['home','door','fountain'][i]!} size={31}/><span>{a.name}</span><small>{RESTORATIONS.slice(i*6,i*6+6).filter(t=>player.restored.includes(t.id)).length}/6</small></button>)}</nav>
  {canStyle&&!visual&&<section className="garden-style-picker" data-frame="card_sage_v6" data-frame-scale="0.16" aria-label={tr("정원 장식 선택")}><p>{tr("우리 정원의 모습")}</p><div className="garden-style-options">{(['classic','festival'] as const).map(style=><button key={style} aria-pressed={(styles[task.id]||'classic')===style} disabled={styleBusy||!styleReady} data-frame={(styles[task.id]||'classic')===style?'button_coral_v6':'button_mint_v6'} data-frame-scale="0.1" onClick={()=>onStyle(task.id,style)}><Icon id={style==='festival'?task.asset+'_festival_v8':task.asset+'_after'} size={32}/><span>{style==='classic'?tr("자연"):tr("축제")}</span></button>)}</div><div className="garden-style-note">{styleBusy?tr("정원에 입히는 중…"):styleReady?tr("무료 · 언제든 바꿀 수 있어요"):tr("연결되면 장식을 바꿀 수 있어요")}</div></section>}
  <aside className="garden-editor" aria-label={tr("선택한 정원 건물")} data-frame="dock_v3" data-frame-bleed="8"><div className="garden-editor-preview"><Icon id={styles[task.id]==='festival'?task.asset+'_festival_v8':task.asset+'_after'} size={84}/></div><div className="garden-editor-info"><h2>{visual?.taskId===task.id?visual.phase==='building'?tr("뚝딱뚝딱, 가꾸는 중…"):tr("정원이 새로 피어났어요!"):tr(task.name)}</h2><p>{done?tr("정원에 완성된 모습을 확인해 보세요."):tr("정원 위의 건물을 눌러 골라보세요.")}</p><div className="garden-editor-wallet"><Amount kind="star" value={player.stars}/><span>{tr("보유")}</span></div></div><div className="garden-editor-action">{done&&!visual?<Button tone="green" icon={next?'hammer':'home'} disabled={busy||styleBusy} onClick={()=>next?onSelect(next):onClose()}>{next?tr("다음 건물"):tr("정원으로")}</Button>:<Button tone="green" disabled={busy||!!visual||missing>0} onClick={()=>onRestore(task)}>{visual?tr("완성하는 중…"):<><span>{tr("꾸미기")}</span><Amount kind="star" value={task.cost}/></>}</Button>}{missing>0&&!done&&<small className="garden-missing">{tr("퍼즐을 깨고")}{' '}<Amount kind="star" value={missing}/>{' '}{tr("더 모아요")}</small>}</div><IconButton id="close" label={tr("정원 꾸미기 닫기")} disabled={busy||!!visual||styleBusy} onClick={onClose}/></aside>
 </>;
}
