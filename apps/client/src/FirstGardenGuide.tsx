import {tr} from './i18n';
import {Amount,Button,Card,Icon,LinkAction,Modal} from './ui';
import {FIRST_GARDEN_RESTORATION} from './first-garden-tutorial';
import './first-garden-guide.css';

export function FirstGardenGuide({stars,busy,ready,onRestore,onRetry}:{onRetry:()=>void;ready:boolean;stars:number;busy:boolean;onRestore:()=>void}){
 return <Modal theme="garden" title={tr('첫 정원을 복구해요')} className="first-garden-guide">
  <div className="first-garden-guide-art"><Icon id="lumi_happy" size={96}/><Icon id="home" size={96}/></div>
  <Card tone="blue"><h3>{tr(FIRST_GARDEN_RESTORATION.name)}</h3><p>{tr('퍼즐에서 얻은 꽃별로 정원 입구를 고쳐 보세요.')}</p><Amount kind="star" value={FIRST_GARDEN_RESTORATION.cost}/></Card>
  <p className="fine">{tr('복구 버튼을 누르면 정원이 되살아나요!')}</p>
  <Button className="first-garden-restore" tone="green" icon="hammer" disabled={busy||!ready||stars<FIRST_GARDEN_RESTORATION.cost} onClick={onRestore}>{tr(!ready?'정원 준비 중…':busy?'가꾸는 중…':'정원 복구하기')}</Button>
  {!ready&&<LinkAction onClick={onRetry}>{tr('다시 불러오기')}</LinkAction>}
 </Modal>;
}
export function FirstGardenBuilding(){
 return <div className="first-garden-building" role="status" aria-live="polite"><p>{tr('첫 정원을 복구하고 있어요…')}</p></div>;
}
export function FirstPuzzleRetry({busy,onRetry}:{busy:boolean;onRetry:()=>void}){
 return <Modal theme="result" title={tr('한 번 더 해볼까요?')}><Card><Icon id="lumi_happy" size={100}/><p>{tr('같은 색 타일을 3개 이상 맞춰 첫 퍼즐을 완성해 보세요.')}</p></Card><Button tone="green" disabled={busy} onClick={onRetry}>{tr('다시 도전')}</Button></Modal>;
}
