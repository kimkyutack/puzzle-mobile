import {useEffect,useState} from 'react';
import {GAME_EVENT_FEATURES,gameEventAvailable,type GameEventFeature,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {ANIMAL_EXPEDITION_STAGES,EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import {GARDEN_GAME_PRIZES,isGardenGame,type GardenGamePrize} from '../../../packages/contracts/src/garden-games';
import {GARDEN_GAME_TITLES} from '../../../packages/content/src/garden-games';
import {DECORATIONS} from '../../../packages/garden-world/src/catalog';
import {api} from './api';
import {Badge,Button,Card,Field,Switch} from './components';
import {useConsole} from './context';
import {useResource} from './use-resource';

export const kstInput=(value:number|null)=>value?new Date(value+9*3600000).toISOString().slice(0,16):'';
export const parseKstInput=(value:string)=>value?Date.parse(value+':00+09:00'):null;
const labels:Record<GameEventFeature,[string,string]>={flowerlight:['꽃빛축제','꽃잎을 모아 5개 장소를 복원하고 분수를 받는 개인 이벤트'],animalExpedition:['동물 구출 원정',`${ANIMAL_EXPEDITION_STAGES.length}단계 · 회차별 전용 동물 구출 및 정원 동물 보상`],powerFestival:['도구 축제','특수 타일 목표와 단계 보상을 제공하는 30분 이벤트'],treasure:['보물 카드','하루 3회 카드 짝 맞추기 미니게임'],
 'acorn-pinball':[GARDEN_GAME_TITLES['acorn-pinball'],'도토리 3개로 표적을 맞히는 10단계 미니게임'],
 'greenhouse-water':[GARDEN_GAME_TITLES['greenhouse-water'],'수로를 돌려 화분을 연결하는 10단계 미니게임'],
};
const prizeName=(id:GardenGamePrize)=>DECORATIONS.find(item=>item.id===id)?.name??id;

export default function GameEventSettings(){
 const {data,error,loading,reload}=useResource<{settings:RuntimeSettings;revision:number}>('/runtime',{settings:null as unknown as RuntimeSettings,revision:0});
 const [draft,setDraft]=useState<RuntimeSettings|null>(null),{canWrite,confirm}=useConsole();
 useEffect(()=>{if(data.settings)setDraft(structuredClone(data.settings));},[data]);
 useEffect(()=>{const update=()=>reload();window.addEventListener('admin-runtime-updated',update);return()=>window.removeEventListener('admin-runtime-updated',update)},[]);
 if(error)return <p role="alert" className="error">{error}</p>;
 if(loading||!draft)return <p className="loading">게임 이벤트 설정을 불러오는 중…</p>;
 const change=<K extends GameEventFeature>(feature:K,patch:Partial<RuntimeSettings['gameEvents'][K]>)=>setDraft({...draft,gameEvents:{...draft.gameEvents,[feature]:{...draft.gameEvents[feature],...patch}}});
 return <section aria-label="게임 이벤트 운영"><h2>게임 이벤트 운영</h2><p className="page-description">개최 시간은 한국 시간(UTC+9)입니다. 종료 시간은 신규 참여에 적용되고, 진행·보상 기록은 삭제하지 않습니다. 기능을 끄면 해당 이벤트의 요청과 노출을 중지합니다.</p><form onSubmit={event=>{event.preventDefault();confirm('게임 이벤트 설정 적용',GAME_EVENT_FEATURES.map(feature=>{const config=draft.gameEvents[feature];return `${labels[feature][0]}: ${draft.features[feature]?'활성화':'중지'} · 해금 레벨 ${config.minLevel}\n한국 시간 ${kstInput(config.startsAt)||'즉시'} ~ ${kstInput(config.endsAt)||'종료 미지정'}${feature==='flowerlight'?' · 개인 진행 '+draft.gameEvents.flowerlight.durationDays+'일':''}`}).join('\n\n')+`\n원정 회차: ${draft.gameEvents.animalExpedition.roundId} · ${EXPEDITION_ANIMALS[draft.gameEvents.animalExpedition.animal].name}\n동물 구출 원정: 하루 ${draft.gameEvents.animalExpedition.dailyLimit}회 · 한국 시간 00:00 초기화`,async(reason,key)=>{await api('/runtime',{key,reason,revision:data.revision,data:draft},'PUT');window.dispatchEvent(new Event('admin-runtime-updated'));});}}><fieldset disabled={!canWrite}>
  <div className="event-grid">{GAME_EVENT_FEATURES.map(feature=>{const config=draft.gameEvents[feature],active=gameEventAvailable(feature,draft,Date.now());return <Card key={feature} title={labels[feature][0]} detail={labels[feature][1]} action={<Badge tone={active?'green':''}>{!draft.features[feature]?'중지':active?'개최 중':Date.now()<config.startsAt?'예약':'신규 참여 종료'}</Badge>}>
   <Switch checked={draft.features[feature]} label={labels[feature][0]+' 활성화'} detail="기능·상점 설정의 제공 상태와 함께 반영됩니다." onChange={enabled=>setDraft({...draft,features:{...draft.features,[feature]:enabled}})}/>
   <div className="form-grid"><Field label={labels[feature][0]+' 시작 (한국 시간)'} hint="비워두면 즉시 참여할 수 있습니다."><input type="datetime-local" value={kstInput(config.startsAt)} onInput={e=>change(feature,{startsAt:parseKstInput(e.currentTarget.value)??0})}/></Field><Field label={labels[feature][0]+' 종료 (한국 시간)'} hint="비워두면 종료 시각을 지정하지 않습니다."><input type="datetime-local" value={kstInput(config.endsAt)} onInput={e=>change(feature,{endsAt:parseKstInput(e.currentTarget.value)})}/></Field></div>
   <Field label={labels[feature][0]+' 해금 레벨'}><input type="number" required min={1} max={100000} value={config.minLevel} onChange={e=>change(feature,{minLevel:Number(e.target.value)})}/></Field>
   {feature==='flowerlight'&&<Field label="꽃빛축제 개인 진행 일수" hint="새로 참여하는 사용자에게 적용합니다. 진행 중인 축제의 종료 시각은 유지합니다."><input type="number" required min={1} max={30} value={draft.gameEvents.flowerlight.durationDays} onChange={e=>change('flowerlight',{durationDays:Number(e.target.value)})}/></Field>}
   {isGardenGame(feature)&&<>
    <Field label={labels[feature][0]+' 회차 ID'} hint="새 ID를 사용하면 단계와 입장권이 새 회차로 시작합니다."><input required maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9_\-]*" value={draft.gameEvents[feature].roundId} onChange={e=>change(feature,{roundId:e.target.value})}/></Field>
    <Field label={labels[feature][0]+' 입장권 보유 상한'} hint="메인 퍼즐을 새로 클리어하면 1장을 얻습니다. 한국 시간 00:00에 게임별 무료 도전 1회를 갱신합니다."><input type="number" required min={1} max={20} value={draft.gameEvents[feature].ticketCap} onChange={e=>change(feature,{ticketCap:Number(e.target.value)})}/></Field>
    <Field label={labels[feature][0]+' 완주 보상'} hint="이미 시작한 회차는 플레이어에게 표시된 완주 보상을 유지합니다."><select value={draft.gameEvents[feature].grandPrize} onChange={e=>change(feature,{grandPrize:e.target.value as GardenGamePrize})}>{GARDEN_GAME_PRIZES.map(id=><option key={id} value={id}>{prizeName(id)}</option>)}</select></Field>
   </>}
   {feature==='animalExpedition'&&<><Field label="원정 회차 ID" hint="새 회차를 열 때 새 ID를 입력하세요. 같은 동물과 ID는 기존 회차로 이어집니다. 저장된 이전 원정과 보상, 오늘의 사용 횟수는 유지됩니다."><input required maxLength={64} pattern="[a-zA-Z0-9_-]+" value={draft.gameEvents.animalExpedition.roundId} onChange={e=>change('animalExpedition',{roundId:e.target.value})}/></Field><Field label="구출 동물 · 완주 보상"><select value={draft.gameEvents.animalExpedition.animal} onChange={e=>change('animalExpedition',{animal:e.target.value as 'panda'|'fox'|'red-panda'})}>{(['panda','fox','red-panda'] as const).map(animal=><option key={animal} value={animal}>{EXPEDITION_ANIMALS[animal].name}</option>)}</select></Field><Field label="동물 구출 원정 하루 도전 횟수" hint="새 단계 시작·재시도에 1회 차감합니다. 이어하기는 무료이며 한국 시간 00:00에 초기화합니다. 횟수 변경은 오늘 사용한 횟수를 유지한 상태로 적용합니다."><input type="number" required min={1} max={20} value={draft.gameEvents.animalExpedition.dailyLimit} onChange={e=>change('animalExpedition',{dailyLimit:Number(e.target.value)})}/></Field></>}
  </Card>})}</div><div className="button-row"><Button type="submit" variant="primary">게임 이벤트 설정 검토</Button></div>
 </fieldset></form></section>;
}
