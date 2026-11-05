import {tr} from "./i18n";
import {useEffect,useRef,useState} from 'react';
import type {Player,Product} from '@garden/contracts';
import {request,key} from './api';
import {purchases} from './platform';
import type {PurchaseState} from './platform/purchases';
import {Amount,Button,Card,Icon,LinkAction} from './ui';
import CommerceDialog from './CommerceDialog';
import {passClaimState,type PassRewardProgress} from './pass-rewards';
import './commerce-actions.css';

interface PassDetails extends PassRewardProgress {tiers:Array<{tier:number;points:number;freeClaimed:boolean;premiumClaimed:boolean;premium:{coins:number;hammer:number;decoration:unknown;guildGift:unknown}}>}
interface Props {player:Player;seasonId:string;pass:PassDetails;working:boolean;onClaimAll:()=>void;perform:(work:()=>Promise<unknown>)=>Promise<void>;onReload:()=>Promise<void>;onPage:(page:string)=>void}
const statusText:Record<PurchaseState,string>={loading:'상품 확인 중',ready:'구매 준비 완료',purchasing:'스토어에서 구매 진행 중',pending:'스토어 승인 대기 중',verifying:'구매 확인 중',complete:'프리미엄 보상선이 열렸어요!',cancelled:'구매를 취소했어요',error:'구매 내역을 다시 확인해 주세요',unavailable:'스토어 연결 후 구매할 수 있어요'};

export default function PassActions({player,seasonId,pass,working,onClaimAll,perform,onReload,onPage}:Props){
 const [product,setProduct]=useState<Product|null>(null),[price,setPrice]=useState(''),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(false),[showPremium,setShowPremium]=useState(false),[purchaseState,setPurchaseState]=useState<PurchaseState|null>(null);
 const buying=useRef(false),stateRef=useRef<PurchaseState|null>(null);
 const claims=passClaimState(pass),owned=pass.premium,pending=purchaseState==='pending',confirmed=purchaseState==='complete';
 const updatePurchaseState=(state:PurchaseState)=>{stateRef.current=state;setPurchaseState(state);};
 const loadProduct=async()=>{
  setLoading(true);setLoadError('');
  try{
   const catalog=await request<{products:Product[]}>('/catalog'),found=catalog.products.find(value=>value.id==='garden.pass'&&value.kind==='pass');
   if(!found)throw new Error(tr("정원 패스 상품을 준비하고 있어요."));
   setProduct(found);
   if(purchases.available()){
    const values=await purchases.products([found.id]);setPrice(values.find(value=>value.id===found.id)?.price||'');
   }
  }catch(error){setLoadError(error instanceof Error?error.message:tr("상품을 불러오지 못했어요."));}
  finally{setLoading(false);}
 };
 useEffect(()=>{setPrice('');stateRef.current=null;setPurchaseState(null);if(!owned)void loadProduct();},[player.id,seasonId,owned]);
 const ready=!!product&&!!price&&purchases.available();
 const close=()=>{if(!working&&!buying.current)setShowPremium(false);};
 async function buy(){
  if(!product||!ready||owned||buying.current||stateRef.current==='pending'||stateRef.current==='complete')return;
  buying.current=true;
  try{await perform(async()=>{
   await purchases.buy(product,player.id,{prepare:productId=>request('/purchases/prepare',{key:key(),productId}),verify:input=>request('/purchases/verify',input),cancel:id=>request('/purchases/intents/'+id+'/cancel',{key:key()}),pending:id=>request('/purchases/intents/'+id+'/pending',{key:key()})},updatePurchaseState);
   await onReload();
  });}finally{buying.current=false;}
 }
 const coins=pass.tiers.reduce((total,tier)=>total+tier.premium.coins,0),hammers=pass.tiers.reduce((total,tier)=>total+tier.premium.hammer,0);
 const allMessage=claims.state==='available'?tr("받을 수 있는 선물 {0}개",{0:(claims.available.length)}):claims.state==='claimed'?tr("현재 열린 선물을 모두 받았어요."):tr("첫 선물은 10점부터 열려요.");
 return <>
  <Card className="pass-claim-tools" tone="blue"><div className="pass-claim-copy"><Icon id="chest" size={48}/><div><h3>{tr("열린 선물 한 번에")}</h3><p role="status">{allMessage}</p></div></div><Button attention={claims.available.length} className="pass-claim-all" icon="chest" tone="green" disabled={working||claims.state!=='available'} onClick={onClaimAll}>{working?tr("확인 중…"):claims.state==='available'?tr("모두 받기"):claims.state==='claimed'?tr("모두 수령 완료"):tr("아직 열리지 않았어요")}</Button></Card>
  <Card className="pass-premium-entry" tone="gold"><div className="pass-premium-copy"><Icon id="rainbow" size={65}/><div><h3>{tr("프리미엄 보상선")}</h3><p>{owned?tr("이번 시즌 프리미엄이 활성화되어 있어요."):tr("무료 선물과 함께 추가 보상을 열어요.")}</p></div></div>{owned?<div className="pass-owned"><Icon id="star" size={25}/><strong>{tr("프리미엄 활성화")}</strong></div>:<><Button tone="gold" className="pass-premium-open" disabled={working} onClick={()=>setShowPremium(true)}>{tr("프리미엄 구매")}{price&&<small>{price}</small>}</Button><p className="pass-store-state">{loading?tr("스토어 상품을 확인하고 있어요."):loadError||(!purchases.available()?tr("스토어 연결 후 구매할 수 있어요."):!price?tr("스토어에서 상품 가격을 확인할 수 없어요."):tr("가격 확인 후 스토어에서 결제해요."))}</p></>}</Card>
  {showPremium&&<CommerceDialog title={tr("프리미엄 보상선")} onClose={close}><Card className="premium-purchase-summary" tone="gold"><Icon id="rainbow" size={105}/><h3>{tr("이번 시즌 추가 선물")}</h3><div className="premium-total"><Amount kind="coin" value={coins}/><Amount kind="hammer" value={hammers}/></div><p>{tr("30단계의 추가 보상과")}<br/>{tr("프로필 문장 · 길드 선물권")}</p><small>{tr("퍼즐을 완료해 열린 단계부터 받을 수 있어요.")}</small></Card>
   {purchaseState&&<p className="purchase-feedback" role="status">{statusText[purchaseState]}</p>}
   {owned?<><p className="purchase-feedback">{tr("프리미엄 보상선이 열렸어요.")}</p><Button tone="green" onClick={close}>{tr("선물 받으러 가기")}</Button></>:ready?<Button tone="gold" disabled={working||pending||confirmed} onClick={()=>void buy()}>{pending?tr("스토어 승인 대기 중"):confirmed?tr("구매 확인 완료"):working?tr("구매 확인 중…"):tr("구매하기")}{!working&&!pending&&!confirmed&&<small>{price}</small>}</Button>:<><p className="purchase-feedback">{loading?tr("스토어 상품을 확인하고 있어요."):loadError||(!purchases.available()?tr("이 앱의 스토어 연결 후 구매할 수 있어요."):tr("스토어 상품 가격을 확인하지 못했어요."))}</p>{loadError&&<Button secondary disabled={working||loading} onClick={()=>void loadProduct()}>{tr("상품 다시 확인")}</Button>}<Button secondary disabled={working} onClick={()=>{setShowPremium(false);onPage('shop')}}>{tr("상점에서 패스 상품 보기")}</Button></>}
   {(pending||confirmed)&&<LinkAction icon="shop" disabled={working} onClick={()=>{setShowPremium(false);onPage('settings')}}>{tr("구매 내역 확인")}</LinkAction>}
   <Button secondary disabled={working} onClick={close}>{tr("돌아가기")}</Button>
  </CommerceDialog>}
 </>;
}
