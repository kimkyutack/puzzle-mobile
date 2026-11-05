import type {Player,Run} from '@garden/contracts';
import type {ReactNode} from 'react';
import {tr} from './i18n';
import {Amount,Button,Icon,LinkAction,Modal,Poster} from './ui';
import {completionReward,needsFinish} from './completion';

export default function WinModal({run,player,busy,onClose,onNext,onHome,onDouble,children}:{run:Run;player:Player;busy:boolean;onClose:()=>void;onNext:()=>void;onHome:()=>void;onDouble:()=>void;children?:ReactNode}){
 const confirming=needsFinish(run),reward=completionReward(run);
 return <Modal theme="result" title={tr('정원이 활짝 피었어요!')} onClose={onClose}>
  <Poster id="poster_victory_v5" className="victory-poster" label={tr('꽃별을 들어 올리며 기뻐하는 루미')}/>
  <div className="result-payout" data-content-group data-frame="card_gold_v4"><Amount kind="coin" value={'+'+reward.coins}/><Amount kind="star" value={'+'+reward.stars}/></div>
  {confirming&&<p className="result-confirming" role="status">{tr('보상을 확인하고 있어요.')}</p>}
  {!!reward.items?.['world-bomb']&&<div className="world-bomb-earned"><Icon id="world-bomb" size={74}/><strong>+{reward.items['world-bomb']}</strong><span>{tr('10판 완성 선물!')}</span></div>}
  <p className="result-level">{tr('레벨')}{' '}{run.level.id}{' '}{tr('완료')}</p>
  <Button tone="green" icon="lumi" disabled={confirming||busy} onClick={onNext}>{tr('다음 레벨')}</Button>
  <LinkAction className="result-return" icon="home" onClick={onHome}>{tr('정원으로')}</LinkAction>
  {player.level>5&&run.reward&&<LinkAction icon="coin" disabled={busy||confirming} onClick={onDouble}>{tr('광고 보고 보상 2배')}{' '}<Amount kind="coin" value={'+'+run.reward.coins}/></LinkAction>}
  {children}
 </Modal>;
}
