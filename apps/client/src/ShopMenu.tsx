import {tr,formatLocale} from "./i18n";
import {useEffect,useRef,useState} from 'react';
import type {Player,Product} from '@garden/contracts';
import {request,key} from './api';
import {purchases} from './platform';
import {Amount,Button,Card,Icon,LinkAction,FrameFace,names} from './ui';
import {ProductContents,SalePosterArt,bundlePoster,bundleArt} from './commerce-ui';
import {sound,startMusic} from './sound';
import CommerceDialog from './CommerceDialog';
import './commerce-v7.css';
import './commerce-actions.css';
import './shop-posters-v11.css';

type Mutate=(path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
interface Props {player:Player;mutate:Mutate;refresh:()=>Promise<void>;notify:(message:string)=>void;onPage:(page:string)=>void}
const tools=[['hammer',150],['sweep-row',250],['sweep-column',250],['shuffle',150],['sweep-border',350],['cross-firework',350],['color-magnet',400],['move-hourglass',300],['wind-row',150],['bomb',200],['rainbow',300]] as const;
const title=(product:Product)=>product.kind==='starter'?tr("첫 정원 꾸러미"):product.kind==='boosters'?tr("공략 도구 꾸러미"):tr("정원 패스");
const stateText:Record<string,string>={loading:'상품 확인 중',ready:'구매 준비 완료',purchasing:'스토어에서 구매 진행 중',pending:'스토어 승인 대기 중',verifying:'구매 확인 중',complete:'꾸러미를 받았어요!',cancelled:'구매를 취소했어요',error:'구매 내역을 다시 확인해 주세요',unavailable:'스토어 연결이 필요해요'};

export default function ShopMenu({player,mutate,refresh,notify,onPage}:Props){
 const [products,setProducts]=useState<Product[]>([]),[prices,setPrices]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[loaded,setLoaded]=useState(false);
 const [checkingPrices,setCheckingPrices]=useState(false),[selectedProduct,setSelectedProduct]=useState<Product|null>(null);
 const guard=useRef(false);
 const [selectedTool,setSelectedTool]=useState<typeof tools[number]|null>(null),[toolError,setToolError]=useState('');
 const selectedToolRef=useRef<typeof tools[number]|null>(null);
 const balance=player.coins+player.boundCoins;
 const loadPrices=async(base:Product[])=>{
  setPrices({});setCheckingPrices(purchases.available());
  if(!purchases.available())return;
  try{const values=await purchases.products(base.map(product=>product.id));setPrices(Object.fromEntries(values.map(value=>[value.id,value.price])));}
  catch{setStatus(tr("스토어 가격을 불러오지 못했어요. 잠시 후 다시 확인해 주세요."));}
  finally{setCheckingPrices(false);}
 };
 const load=async()=>{
  const catalog=await request<{products:Product[]}>('/catalog');
  const base=catalog.products.filter(product=>!product.offer);
  setProducts(base);setLoaded(true);setError('');
  void loadPrices(base);
 };
 useEffect(()=>{void load().catch(error=>setError(error instanceof Error?error.message:tr("상품을 불러오지 못했어요.")));},[player.id]);
 async function perform(work:()=>Promise<unknown>){
  if(guard.current)return;guard.current=true;setBusy(true);
  try{await work();}catch(error){notify(error instanceof Error?error.message:tr("구매를 확인하지 못했어요."));}
  finally{guard.current=false;setBusy(false);}
 }
 async function buy(product:Product){
  if(!prices[product.id]||!purchases.available())return;
  await perform(async()=>{
   await purchases.buy(product,player.id,{prepare:productId=>request('/purchases/prepare',{key:key(),productId}),verify:input=>request('/purchases/verify',input),cancel:id=>request('/purchases/intents/'+id+'/cancel',{key:key()}),pending:id=>request('/purchases/intents/'+id+'/pending',{key:key()})},value=>{setStatus(tr(stateText[value]||''));if(value==='complete')setSelectedProduct(null);});
   await refresh();
  });
 }
 function chooseProduct(product:Product){if(!guard.current){setStatus('');setSelectedProduct(product);}}
 function closeProduct(){if(!guard.current)setSelectedProduct(null);}
 const storeNote=!purchases.available()?tr("스토어 연결이 필요해요"):checkingPrices?tr("가격 확인 중"):tr("가격 확인 필요");
 function chooseTool(tool:typeof tools[number]){
  if(guard.current||selectedToolRef.current)return;
  selectedToolRef.current=tool;setSelectedTool(tool);setToolError('');
 }
 function closeTool(){
  if(guard.current)return;
  selectedToolRef.current=null;setSelectedTool(null);setToolError('');
 }
 async function confirmTool(){
  const selected=selectedToolRef.current;
  if(!selected||guard.current)return;
  if(balance<selected[1]){setToolError(tr("코인이 부족해요."));return;}
  await perform(async()=>{
   try{await mutate('/shop/buy',{item:selected[0]});}
   catch(error){setToolError(error instanceof Error?error.message:tr("구매를 확인하지 못했어요."));throw error;}
   selectedToolRef.current=null;setSelectedTool(null);setToolError('');notify(names[selected[0]]+tr(" 1개를 구입했어요!"));
  });
 }
 return <div className="commerce-shop">
  <figure className="commerce-sign" data-content-group><Icon id="poster_shop_v7" size={480}/><figcaption><h2>{tr("루미의 추천")}</h2><span>{tr("도구 · 코인 · 꾸러미")}</span></figcaption></figure>
  <button className="package-feature sale-poster" data-content-group data-art-root onClick={()=>{sound('button');startMusic();onPage('offers')}} aria-label={tr("특별 패키지 보기")}>
   <SalePosterArt id="poster_offer_v11"/><span className="package-feature-copy sale-poster-copy"><strong>{tr("특별 패키지")}</strong><span>{tr("코인과 공략 도구를 한 번에")}</span><span className="package-feature-action"><FrameFace id="button_lime_v9"/>{tr("꾸러미 보기")}</span></span>
  </button>
  <section className="commerce-section" aria-labelledby="tools-title"><header className="commerce-section-title" data-frame="chrome_teal_v6" data-frame-scale="0.1"><Icon id="hammer" size={28}/><h3 id="tools-title">{tr("정원 도구")}</h3></header>
   <div className="tool-shelf">{tools.map(([item,cost],index)=><article key={item} className="tool-product" data-content-group data-frame="card_ice_v9" aria-label={names[item]}>
    <Icon id={item} size={68}/><h4>{names[item]}</h4><span className="commerce-stock">{tr("보유")}{' '}{(player.inventory[item]?.normal||0)+(player.inventory[item]?.bound||0)}</span>
    <Button className="commerce-buy" tone="green" disabled={busy} onClick={()=>chooseTool(tools[index]!)}><Amount kind="coin" value={cost}/></Button>
   </article>)}</div>
  </section>
  {player.level>4&&<>
   <section className="commerce-section" aria-labelledby="coins-title"><header className="commerce-section-title" data-frame="chrome_teal_v6" data-frame-scale="0.1"><Icon id="coin" size={28}/><h3 id="coins-title">{tr("코인")}</h3></header>
    {!purchases.available()&&<p className="commerce-store-note">{tr("스토어 연결 후 구매할 수 있어요.")}</p>}
    {error?<Card><p role="alert">{tr(error)}</p><Button onClick={()=>void load().catch(error=>notify(error.message))}>{tr("다시 불러오기")}</Button></Card>:!loaded?<p role="status" className="commerce-store-note">{tr("상품을 진열하고 있어요.")}</p>:<div className="coin-shelf">{products.filter(product=>product.kind==='coins').map(product=><article key={product.id} className="coin-product" data-content-group data-frame="card_peach_v9" aria-label={tr("{0} 코인",{0:(product.coins.toLocaleString(formatLocale()))})}>
     <Icon id="bundle_coins_v7" size={88}/><Amount kind="coin" value={product.coins}/><Button className="commerce-buy" tone="blue" disabled={busy} onClick={()=>chooseProduct(product)}>{prices[product.id]||tr("구매하기")}</Button>
    </article>)}</div>}
   </section>
   <section className="commerce-section" aria-labelledby="bundles-title"><header className="commerce-section-title" data-frame="chrome_teal_v6" data-frame-scale="0.1"><Icon id="chest" size={28}/><h3 id="bundles-title">{tr("정원 꾸러미")}</h3></header>
    {products.filter(product=>product.kind!=='coins').map(product=><article key={product.id} className={`catalog-bundle sale-poster kind-${product.kind}`} data-content-group data-art-root aria-label={title(product)}>
     <SalePosterArt id={bundlePoster(product)}/><div className="catalog-bundle-head sale-poster-copy"><h3>{title(product)}</h3>{product.oneTime&&<small>{tr("한 번만 만나는 꾸러미")}</small>}{product.kind==='pass'?<><p>{tr("프리미엄 보상 30단계")}</p><LinkAction icon="star" onClick={()=>onPage('pass')}><FrameFace id="button_blue_v9"/>{tr("패스 보상 보기")}</LinkAction></>:<ProductContents product={product}/>} 
      {!prices[product.id]&&<small className="catalog-purchase-state">{storeNote}</small>}
      <Button className="catalog-bundle-buy" tone="green" disabled={busy} onClick={()=>chooseProduct(product)}><FrameFace id="button_lime_v9"/>{prices[product.id]||tr("구매하기")}</Button>
     </div>
    </article>)}
   </section>
  </>}
  {status&&<p className="commerce-message" role="status">{tr(status)}</p>}
  {selectedProduct&&<CommerceDialog title={tr("구매 확인")} onClose={closeProduct}>
   <Card className="catalog-purchase-summary" tone="gold"><Icon id={bundleArt(selectedProduct)} size={108}/><h3>{selectedProduct.kind==='coins'?tr("{0} 코인",{0:selectedProduct.coins.toLocaleString(formatLocale())}):title(selectedProduct)}</h3>{selectedProduct.kind==='pass'?<p>{tr("프리미엄 보상 30단계")}</p>:<ProductContents product={selectedProduct}/>}</Card>
   <p className="purchase-feedback" role="status">{prices[selectedProduct.id]?tr("가격 확인 후 스토어에서 결제해요."):!purchases.available()?tr("이 앱의 스토어 연결 후 구매할 수 있어요."):checkingPrices?tr("스토어 상품을 확인하고 있어요."):tr("스토어 상품 가격을 확인하지 못했어요.")}</p>
   {status&&<p className="purchase-feedback" role="status">{status}</p>}
   <div className="purchase-actions"><Button tone="gold" disabled={busy||!purchases.available()||!prices[selectedProduct.id]} onClick={()=>void buy(selectedProduct)}>{busy?tr("구매 확인 중…"):tr("구매하기")}{prices[selectedProduct.id]&&<small>{prices[selectedProduct.id]}</small>}</Button><Button secondary disabled={busy} onClick={closeProduct}>{tr("취소")}</Button></div>
   {purchases.available()&&!prices[selectedProduct.id]&&<LinkAction className="catalog-price-retry" disabled={busy||checkingPrices} onClick={()=>void loadPrices(products)}>{tr("상품 다시 확인")}</LinkAction>}
  </CommerceDialog>}
  {selectedTool&&<CommerceDialog title={tr("구매 확인")} onClose={closeTool}><Card className="tool-purchase-summary" tone="gold"><Icon id={selectedTool[0]} size={112}/><h3>{names[selectedTool[0]]}</h3><div className="tool-purchase-quantity">{tr("1개")}</div><dl className="tool-purchase-price"><div><dt>{tr("구매 가격")}</dt><dd><Amount kind="coin" value={selectedTool[1]}/></dd></div><div className="purchase-owned"><dt>{tr("보유 코인")}</dt><dd><Amount kind="coin" value={balance}/></dd></div></dl></Card>
   {(toolError||balance<selectedTool[1])&&<p className="purchase-feedback" role="alert">{toolError||tr("코인이 부족해요.")}</p>}
   <div className="purchase-actions"><Button tone="gold" disabled={busy||balance<selectedTool[1]} onClick={()=>void confirmTool()}>{busy?tr("구매 확인 중…"):tr("구매하기")}<Amount kind="coin" value={selectedTool[1]}/></Button><Button secondary disabled={busy} onClick={closeTool}>{tr("취소")}</Button></div>
  </CommerceDialog>}
 </div>;
}
