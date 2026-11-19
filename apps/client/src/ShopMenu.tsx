import {t,tr,formatLocale} from "./i18n";
import {useEffect,useRef,useState,type UIEvent} from 'react';
import {SHOP_ITEM_MAX_QUANTITY,SHOP_ITEM_PRICES,type Item,type MonthlyBundleStatus,type Player,type Product} from '@garden/contracts';
import {ApiFailure,request,key,serverNow} from './api';
import {purchases} from './platform';
import {childAccount} from './platform/account-age';
import {Amount,Button,Card,Icon,LinkAction,FrameFace,names} from './ui';
import {ProductContents,PurchaseQuantity,SalePosterArt,bundlePoster,bundleArt} from './commerce-ui';
import {sound} from './sound';
import CommerceDialog from './CommerceDialog';
import {featureEnabled,useOperations} from './OperationsUI';
import {useShopOffers} from './shop-offers';
import './commerce-v7.css';
import './commerce-actions.css';
import './shop-posters-v11.css';

type Mutate=(path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
interface Props {player:Player;mutate:Mutate;refresh:()=>Promise<void>;notify:(message:string)=>void;onPage:(page:string)=>void}
interface ToolPurchase {item:Item;quantity:number}
const tools=['hammer','sweep-row','sweep-column','shuffle','sweep-border','cross-firework','color-magnet',
 'move-hourglass','wind-row','bomb','rainbow','world-bomb'] as const;
const title=(product:Product)=>product.offer?tr(product.offer.title):product.kind==='starter'?tr("첫 정원 꾸러미"):product.kind==='boosters'?tr("공략 도구 꾸러미"):tr("정원 패스");
const stateText:Record<string,string>={loading:'상품 확인 중',ready:'구매 준비 완료',purchasing:'스토어에서 구매 진행 중',pending:'스토어 승인 대기 중',verifying:'구매 확인 중',complete:'꾸러미를 받았어요!',cancelled:'구매를 취소했어요',error:'구매 내역을 다시 확인해 주세요',unavailable:'스토어 연결이 필요해요'};

export default function ShopMenu({player,mutate,refresh,notify,onPage}:Props){
 const [toolPrices,setToolPrices]=useState<Record<Item,number>>(SHOP_ITEM_PRICES);
 const [products,setProducts]=useState<Product[]>([]),[prices,setPrices]=useState<Record<string,string>>({});
 const [monthlyBundle,setMonthlyBundle]=useState<MonthlyBundleStatus|null>(null);
 const [seasonEndsAt,setSeasonEndsAt]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[loaded,setLoaded]=useState(false);
 const [checkingPrices,setCheckingPrices]=useState(false),[selectedProduct,setSelectedProduct]=useState<Product|null>(null);
 const guard=useRef(false);
 const toolsSection=useRef<HTMLElement>(null);
 const bundleTrack=useRef<HTMLDivElement>(null);
 const [bundleIndex,setBundleIndex]=useState(0);
 const [activeTool,setActiveTool]=useState<Item|null>(null);
 const [toolQuantities,setToolQuantities]=useState<Partial<Record<Item,number>>>({});
 const [selectedTool,setSelectedTool]=useState<ToolPurchase|null>(null),[toolError,setToolError]=useState('');
 const selectedToolRef=useRef<ToolPurchase|null>(null);
 const selectedToolCost=selectedTool?toolPrices[selectedTool.item]*selectedTool.quantity:0;
 const activeToolQuantity=activeTool?toolQuantities[activeTool]??1:1;
 const activeToolCost=activeTool?toolPrices[activeTool]*activeToolQuantity:0;
 const balance=player.coins+player.boundCoins,restricted=childAccount();
 const operations=useOperations(),offers=useShopOffers(player,!restricted&&featureEnabled('offers',operations.data));
 const showCatalog=!restricted&&player.level>4;
 const featuredOffers=(['limited','timed','chain'] as const).flatMap(kind=>{
  const group=offers.filter(offer=>offer.product.offer?.kind===kind);
  const offer=group.find(offer=>offer.status==='available')??group[0];
  return offer?[offer.product]:[];
 });
 const bundles=[...(showCatalog?products.filter(product=>product.kind!=='coins'):[]),...featuredOffers];
 const currentBundle=Math.max(0,Math.min(bundleIndex,bundles.length-1));
 const loadPrices=async(base:Product[])=>{
  setPrices({});setCheckingPrices(purchases.available());
  if(!purchases.available())return;
  try{const values=await purchases.products(base.map(product=>product.id));setPrices(Object.fromEntries(values.map(value=>[value.id,value.price])));}
  catch{setStatus(tr("스토어 가격을 불러오지 못했어요. 잠시 후 다시 확인해 주세요."));}
  finally{setCheckingPrices(false);}
 };
 const load=async()=>{
  const catalog=await request<{products:Product[];prices:Record<Item,number>;season:{endsAt:number}|null;monthlyBundle?:MonthlyBundleStatus|null}>('/catalog');
  setToolPrices({...SHOP_ITEM_PRICES,...catalog.prices});
  setMonthlyBundle(catalog.monthlyBundle??null);
  const base=catalog.products.filter(product=>!product.offer);
  setSeasonEndsAt(catalog.season?.endsAt??null);
  setProducts(base);setLoaded(true);setError('');
  if(!restricted)void loadPrices(base);
 };
 useEffect(()=>{void load().catch(error=>setError(error instanceof Error?error.message:tr("상품을 불러오지 못했어요.")));},[player.id,restricted]);
 async function perform(work:()=>Promise<unknown>){
  if(guard.current)return;guard.current=true;setBusy(true);
  try{await work();}catch(error){notify(error instanceof Error?error.message:tr("구매를 확인하지 못했어요."));}
  finally{guard.current=false;setBusy(false);}
 }
 const monthlySold=(product:Product)=>monthlyBundle?.productId===product.id&&monthlyBundle.purchased&&monthlyBundle.resetsAt>serverNow();
 async function buy(product:Product){
  if(!prices[product.id]||!purchases.available()||monthlySold(product))return;
  await perform(async()=>{
   await purchases.buy(product,player.id,{prepare:productId=>request('/purchases/prepare',{key:key(),productId}),verify:input=>request('/purchases/verify',input),cancel:id=>request('/purchases/intents/'+id+'/cancel',{key:key()}),pending:id=>request('/purchases/intents/'+id+'/pending',{key:key()})},value=>{setStatus(tr(stateText[value]||''));if(value==='complete')setSelectedProduct(null);});
   await refresh();
   if(product.monthlyLimit)await load();
  });
 }
 function chooseProduct(product:Product){if(!guard.current){setStatus('');setSelectedProduct(product);}}
 function closeProduct(){if(!guard.current)setSelectedProduct(null);}
 function onBundleScroll(event:UIEvent<HTMLDivElement>){
  const track=event.currentTarget;
  const second=track.children.item(1) as HTMLElement|null;
  if(second?.offsetLeft)setBundleIndex(Math.round(track.scrollLeft/second.offsetLeft));
 }
 function scrollToBundle(index:number){
  const track=bundleTrack.current,slide=track?.children.item(index) as HTMLElement|null;
  if(!track||!slide)return;
  const reducedMotion=player.settings.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  sound('button');
  track.scrollTo({left:slide.offsetLeft,behavior:reducedMotion?'instant':'smooth'});
 }
 function selectTool(item:Item){
  if(guard.current||selectedToolRef.current)return;
  sound('button');setActiveTool(item);
 }
 function onShopScroll(event:UIEvent<HTMLDivElement>){
  if(!activeTool||!toolsSection.current)return;
  const view=event.currentTarget.getBoundingClientRect(),tools=toolsSection.current.getBoundingClientRect();
  if(tools.bottom<=view.top||tools.top>=view.bottom)setActiveTool(null);
 }
 function chooseTool(item:Item,quantity:number){
  if(guard.current||selectedToolRef.current)return;
  const selection={item,quantity};
  selectedToolRef.current=selection;
  setSelectedTool(selection);setToolError('');
 }
 function closeTool(){
  if(guard.current)return;
  selectedToolRef.current=null;setSelectedTool(null);setToolError('');
 }
 async function confirmTool(){
  const selected=selectedToolRef.current;
  if(!selected||guard.current)return;
  const {item,quantity}=selected;
  const expectedCost=toolPrices[item]*quantity;
  if(expectedCost<=0)return;
  if(balance<expectedCost){setToolError(tr("코인이 부족해요."));return;}
  await perform(async()=>{
   try{await mutate('/shop/buy',{item,expectedCost,...(quantity===1?{}:{quantity})});}
   catch(error){
    setToolError(error instanceof Error?error.message:tr("구매를 확인하지 못했어요."));
    if(error instanceof ApiFailure&&error.code==='SHOP_PRICE_CHANGED')await load().catch(()=>{});
    return;
   }
   selectedToolRef.current=null;setSelectedTool(null);setToolError('');
   notify(tr('{0} {1}개',{0:names[item],1:quantity})+' · '+tr('구매 완료'));
  });
 }
 return <div className="commerce-shop">
  <div className="shop-content" onScroll={onShopScroll}>
  {bundles.length>0&&<section className="shop-bundles" aria-label={tr("정원 꾸러미")}>
   <div className="shop-bundle-track" ref={bundleTrack} data-multiple={bundles.length>1} onScroll={onBundleScroll}>
    {bundles.map(product=>{
     const offer=product.offer,sold=monthlySold(product);
     return <article key={offer?.kind??product.id} className={`catalog-bundle sale-poster kind-${product.kind}`} aria-label={title(product)}>
      <SalePosterArt id={bundlePoster(product)}/>
      <div className="catalog-bundle-head sale-poster-copy">
       <h3>{title(product)}</h3>
       {product.kind==='pass'?<><p>{tr("프리미엄 보상 30단계")}</p><LinkAction icon="star" onClick={()=>onPage('pass')}><FrameFace id="button_blue_v9"/>{tr("패스 보상 보기")}</LinkAction></>:<ProductContents product={product}/>}
       <Button className="catalog-bundle-buy" tone="green" rasterFrame={false} disabled={busy||sold}
        onClick={()=>offer?onPage('offers-'+offer.kind):chooseProduct(product)}>
        <FrameFace id="button_lime_v9"/>{offer?tr("꾸러미 보기"):sold?tr("이번 달 구매 완료"):prices[product.id]||tr("구매하기")}
       </Button>
      </div>
     </article>;
    })}
   </div>
   {bundles.length>1&&<div className="shop-bundle-pages">
    {bundles.map((product,index)=><button type="button" key={product.offer?.kind??product.id} aria-label={title(product)} aria-current={index===currentBundle?true:undefined} onClick={()=>scrollToBundle(index)}/>)}
   </div>}
  </section>}
  <section className="commerce-section" ref={toolsSection} aria-labelledby="tools-title"><header className="commerce-section-title" data-frame="chrome_teal_v6" data-frame-scale="0.1"><Icon id="hammer" size={28}/><h3 id="tools-title">{tr("정원 도구")}</h3></header>
   <div className="tool-shelf">{tools.filter(item=>toolPrices[item]>0).map(item=>{
    const stock=(player.inventory[item]?.normal||0)+(player.inventory[item]?.bound||0);
    return <button type="button" key={item} className="tool-product tool-select-card" data-frame="card_ice_v9" data-frame-scale="0.16" aria-pressed={activeTool===item} disabled={busy} onClick={()=>selectTool(item)}>
     <Icon id={item} size={58}/>
     <span className="tool-card-name">{names[item]}</span>
     <span className="commerce-stock">{tr("보유")}{' '}{stock}</span>
     <span className="tool-card-price" data-frame="button_lime_v9" data-frame-scale="0.1"><Amount kind="coin" value={toolPrices[item]}/></span>
    </button>;
   })}</div>
  </section>
  {showCatalog&&
   <section className="commerce-section" aria-labelledby="coins-title"><header className="commerce-section-title" data-frame="chrome_teal_v6" data-frame-scale="0.1"><Icon id="coin" size={28}/><h3 id="coins-title">{tr("코인")}</h3></header>
    {!purchases.available()&&<p className="commerce-store-note">{tr("스토어 연결 후 구매할 수 있어요.")}</p>}
    {error?<Card><p role="alert">{tr(error)}</p><Button onClick={()=>void load().catch(error=>notify(error.message))}>{tr("다시 불러오기")}</Button></Card>:!loaded?<p role="status" className="commerce-store-note">{tr("상품을 진열하고 있어요.")}</p>:<div className="coin-shelf">{products.filter(product=>product.kind==='coins').map(product=><article key={product.id} className="coin-product" data-content-group data-frame="card_peach_v9" aria-label={tr("{0} 코인",{0:(product.coins.toLocaleString(formatLocale()))})}>
     <Icon id="bundle_coins_v7" size={88}/><Amount kind="coin" value={product.coins}/><Button className="commerce-buy" tone="blue" disabled={busy} onClick={()=>chooseProduct(product)}>{prices[product.id]||tr("구매하기")}</Button>
    </article>)}</div>}
   </section>}
  {status&&<p className="commerce-message" role="status">{tr(status)}</p>}
  </div>
  {activeTool&&activeToolCost>0&&<div className="tool-purchase-dock" data-frame="event_sky_v9" data-frame-scale="0.15" role="group" aria-label={tr("정원 도구")+' · '+tr("구매하기")}>
   <span className="tool-dock-selection"><Icon id={activeTool} size={38}/><strong>{names[activeTool]}</strong></span>
   <PurchaseQuantity className="tool-quantity" label={names[activeTool]} quantity={activeToolQuantity} max={SHOP_ITEM_MAX_QUANTITY} disabled={busy} onChange={value=>setToolQuantities(old=>({...old,[activeTool]:value}))}/>
   <Button className="tool-dock-buy" tone="green" disabled={busy||balance<activeToolCost} onClick={()=>chooseTool(activeTool,activeToolQuantity)}><Amount kind="coin" value={activeToolCost}/>{tr("구매하기")}</Button>
  </div>}
  {selectedProduct&&<CommerceDialog title={tr("구매 확인")} onClose={closeProduct}>
   <Card className="catalog-purchase-summary" tone="gold"><Icon id={bundleArt(selectedProduct)} size={108}/><h3>{selectedProduct.kind==='coins'?tr("{0} 코인",{0:selectedProduct.coins.toLocaleString(formatLocale())}):title(selectedProduct)}</h3>{selectedProduct.kind==='pass'?<p>{tr("프리미엄 보상 30단계")}</p>:<ProductContents product={selectedProduct}/>}
    {selectedProduct.oneTime&&<p>{tr("한 번만 만나는 꾸러미")}</p>}
    {selectedProduct.monthlyLimit&&<p>{tr(monthlySold(selectedProduct)?"이번 달 구매 완료":"월 1회 구매 가능")}</p>}
   </Card>
   {selectedProduct.kind==='pass'&&seasonEndsAt&&<p className="purchase-feedback">{tr("시즌 종료")}{' '}{new Date(seasonEndsAt).toLocaleString(formatLocale())}<br/>{tr("이번 시즌 1회 결제 · 자동 갱신 없음")}</p>}
   <p className="purchase-feedback" role="status">{prices[selectedProduct.id]?tr("가격 확인 후 스토어에서 결제해요."):!purchases.available()?tr("이 앱의 스토어 연결 후 구매할 수 있어요."):checkingPrices?tr("스토어 상품을 확인하고 있어요."):tr("스토어 상품 가격을 확인하지 못했어요.")}</p>
   {status&&<p className="purchase-feedback" role="status">{status}</p>}
   <div className="purchase-actions"><Button tone="gold" disabled={busy||!purchases.available()||!prices[selectedProduct.id]||monthlySold(selectedProduct)} onClick={()=>void buy(selectedProduct)}>{busy?tr("구매 확인 중…"):tr("구매하기")}{prices[selectedProduct.id]&&<small>{prices[selectedProduct.id]}</small>}</Button><Button secondary disabled={busy} onClick={closeProduct}>{tr("취소")}</Button></div>
   {purchases.available()&&!prices[selectedProduct.id]&&<LinkAction className="catalog-price-retry" disabled={busy||checkingPrices} onClick={()=>void loadPrices(products)}>{tr("상품 다시 확인")}</LinkAction>}
  </CommerceDialog>}
  {selectedTool&&<CommerceDialog title={tr("구매 확인")} onClose={closeTool}><Card className="tool-purchase-summary" tone="gold"><Icon id={selectedTool.item} size={112}/><h3>{names[selectedTool.item]}</h3><div className="tool-purchase-quantity">{t('hud.count',{count:selectedTool.quantity})}</div><dl className="tool-purchase-price"><div><dt>{tr("구매 가격")}</dt><dd><Amount kind="coin" value={selectedToolCost}/></dd></div><div className="purchase-owned"><dt>{tr("보유 코인")}</dt><dd><Amount kind="coin" value={balance}/></dd></div></dl></Card>
   {(toolError||balance<selectedToolCost)&&<p className="purchase-feedback" role="alert">{toolError||tr("코인이 부족해요.")}</p>}
   <div className="purchase-actions"><Button tone="gold" disabled={busy||selectedToolCost<=0||balance<selectedToolCost} onClick={()=>void confirmTool()}>{busy?tr("구매 확인 중…"):tr("구매하기")}<Amount kind="coin" value={selectedToolCost}/></Button><Button secondary disabled={busy} onClick={closeTool}>{tr("취소")}</Button></div>
  </CommerceDialog>}
 </div>;
}
