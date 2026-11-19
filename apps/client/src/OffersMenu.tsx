import {tr,formatLocale} from "./i18n";
import {useEffect,useRef,useState} from 'react';
import type {OfferChainReward,OfferDefinition,OffersResponse,Player,ShopOffer} from '@garden/contracts';
import {duration,key,request,serverNow} from './api';
import {purchases} from './platform';
import {Button,Card,Icon,FrameFace} from './ui';
import {ProductContents,SalePosterArt,bundlePoster} from './commerce-ui';
import OfferChainCarousel from './OfferChainCarousel';
import {isOfferListed} from './shop-offers';
import './commerce-v7.css';
import './offers-menu.css';
import './shop-posters-v11.css';
interface Props {player:Player;refresh:()=>Promise<void>;notify:(message:string)=>void;kind:OfferDefinition['kind']}
const headings={limited:'한정 패키지',timed:'타임 특가',chain:'연쇄 패키지'};
const remaining=(ms:number)=>ms>=86_400_000?Math.floor(ms/86_400_000)+tr("일 ")+Math.floor(ms%86_400_000/3_600_000)+tr("시간"):duration(ms);
const stateText:Record<string,string>={loading:'상품 확인 중',ready:'구매 준비 완료',purchasing:'스토어에서 구매 진행 중',pending:'스토어 승인 대기 중',verifying:'구매 확인 중',complete:'꾸러미를 받았어요!',cancelled:'구매를 취소했어요',error:'구매 내역을 다시 확인해 주세요',unavailable:'스토어 연결이 필요해요'};

export default function OffersMenu({player,refresh,notify,kind}:Props){
 const [data,setData]=useState<OffersResponse|null>(null),[prices,setPrices]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const guard=useRef(false);
 const load=async()=>{const result=await request<OffersResponse>('/offers');setData(result);setError('');return result};
 useEffect(()=>{
  void load().then(result=>{
   const now=serverNow(),productIds=result.offers.filter(offer=>offer.product.offer?.kind===kind&&isOfferListed(offer,now)).map(offer=>offer.product.id);
   if(purchases.available()&&productIds.length){
    void purchases.products(productIds).then(products=>setPrices(Object.fromEntries(products.map(product=>[product.id,product.price]))))
     .catch(()=>setStatus(tr("스토어 가격을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.")));
   }
  }).catch(error=>setError(error instanceof Error?error.message:tr("패키지를 불러오지 못했어요.")));
 },[player.id,kind]);
 async function perform(work:()=>Promise<void>,failure:string){
  if(guard.current)return;
  guard.current=true;setBusy(true);setStatus('');
  try{await work();}
  catch(error){notify(error instanceof Error?error.message:tr(failure));}
  finally{guard.current=false;setBusy(false);}
 }
 async function buy(offer:ShopOffer){
  const {product}=offer;
  if(offer.status!=='available'||!isOfferListed(offer,serverNow())||!prices[product.id]||!purchases.available())return;
  await perform(async()=>{
   await purchases.buy(product,player.id,{prepare:productId=>request('/purchases/prepare',{key:key(),productId}),verify:input=>request('/purchases/verify',input),cancel:id=>request('/purchases/intents/'+id+'/cancel',{key:key()}),pending:id=>request('/purchases/intents/'+id+'/pending',{key:key()})},value=>setStatus(tr(stateText[value]||'')));
   await Promise.all([refresh(),load()]);
  },"구매를 확인하지 못했어요.");
 }
 async function claim(reward:OfferChainReward){
  await perform(async()=>{
   await request('/offers/chain-rewards/claim',{rewardId:reward.id,periodId:reward.periodId});
   await Promise.all([refresh(),load()]);
  },"보상을 받지 못했어요.");
 }
 const now=serverNow(),selected=data?.offers.filter(offer=>offer.product.offer?.kind===kind&&isOfferListed(offer,now))??[];
 function action(offer:ShopOffer,disabled=busy){
  const product=offer.product;
  if(offer.status==='refunded')return <p className="deal-state"><Icon id="close" size={22}/>{tr("환불 완료 · 이번 판매 기간 재구매 불가")}</p>;
  if(offer.status==='purchased')return <p className="deal-state"><Icon id="star" size={24}/>{tr("구매 완료")}</p>;
  if(offer.status==='locked')return <p className="deal-state"><Icon id="close" size={22}/>{tr(offer.reason)||tr("앞 단계 구매 후 열려요")}</p>;
  const chain=kind==='chain';
  return prices[product.id]?
   <Button className="deal-buy" tone="green" rasterFrame={!chain} disabled={disabled} onClick={()=>void buy(offer)}>
    {!chain&&<FrameFace id="button_lime_v9"/>}{prices[product.id]}
   </Button>:
   <div className="deal-price">
    {!chain&&<FrameFace id="button_blue_v9"/>}
    <strong>₩{product.offer!.referencePriceKrw.toLocaleString(formatLocale())}</strong><small>{tr("기준 가격")}</small>
   </div>;
 }
 return <div className="offers-menu-v7">
  {error?<Card title={tr("패키지를 불러오지 못했어요")}><p role="alert">{tr(error)}</p><Button icon="shuffle" onClick={()=>void load().catch(error=>notify(error.message))}>{tr("다시 연결")}</Button></Card>:!data?<p className="deal-message" role="status">{tr("정원 꾸러미를 진열하고 있어요.")}</p>:<>
   {!selected.length?<Card><p>{tr("지금 열려 있는 꾸러미가 없어요.")}</p></Card>:
   kind==='chain'?<OfferChainCarousel offers={selected} rewards={data.chainRewards??[]}
    timeLeft={remaining(selected[0]!.endsAt-now)+tr(" 남음")} busy={busy} reducedMotion={player.settings.reducedMotion}
    purchaseAction={action} claim={reward=>void claim(reward)}/>:
   <section className="deal-products" aria-label={tr(headings[kind])}>{selected.map(offer=><article key={offer.product.id} className={`deal-banner sale-poster deal-${kind}`} data-content-group data-art-root aria-label={tr(offer.product.offer!.title)}>
    <SalePosterArt id={bundlePoster(offer.product)}/>
    <div className="sale-poster-copy"><div className="deal-heading"><h3>{tr(offer.product.offer!.title)}</h3>{offer.status==='available'&&<p className="deal-deadline">{remaining(offer.endsAt-now)+tr(" 남음")}</p>}</div>
     <ProductContents product={offer.product}/><footer className="deal-footer">{action(offer)}</footer>
    </div>
   </article>)}</section>}
   {selected.some(offer=>offer.status==='available')&&!purchases.available()&&<p className="deal-message">{tr("표시 금액은 구성의 기준 가격입니다.")}<br/>{tr("실제 결제 가격은 연결된 스토어에 표시돼요.")}</p>}
  </>}
  {status&&<p className="deal-message" role="status">{tr(status)}</p>}
 </div>;
}
