import {tr} from "./i18n";
import type {Product} from '@garden/contracts';
import {Amount,Icon,names} from './ui';
import {art} from './assets';

export function PurchaseQuantity({className,label,quantity,max,disabled,onChange}:{className:string;label:string;quantity:number;max:number;disabled?:boolean;onChange:(value:number)=>void}){
 return <div className={className} role="group" aria-label={label+' '+tr('구매 수량')}>
  <button type="button" aria-label={tr('수량 줄이기')} disabled={disabled||quantity<=1} onClick={()=>onChange(quantity-1)}>−</button>
  <input type="number" inputMode="numeric" aria-label={label+' '+tr('수량')} min={1} max={max} disabled={disabled} value={quantity} onChange={event=>onChange(Math.max(1,Math.min(max,Math.trunc(Number(event.target.value))||1)))}/>
  <button type="button" aria-label={tr('수량 늘리기')} disabled={disabled||quantity>=max} onClick={()=>onChange(quantity+1)}>+</button>
 </div>;
}

/** Quantities remain separate from the promotional painting and come from the catalog. */
export function ProductContents({product}:{product:Pick<Product,'coins'|'items'>&{unlimitedSeconds?:number}}){
 const minutes=(product.unlimitedSeconds??0)/60;
 return <div className="commerce-loot" aria-label={tr("상품 구성")}>
  {product.coins>0&&<Amount kind="coin" value={product.coins}/>}
  {Object.entries(product.items).map(([item,quantity])=><span key={item} aria-label={tr("{0} {1}개",{0:(names[item]),1:(quantity)})}><Icon id={item} size={30}/><strong>{quantity}</strong></span>)}
  {minutes>0&&<span className="commerce-loot-heart" aria-label={tr("무제한 하트 {0}분",{0:minutes})}><Icon id="heart" size={29}/><strong>{minutes}<small>{tr("분")}</small></strong></span>}
 </div>;
}

export function bundleArt(product:Product){
 if(product.kind==='coins')return 'bundle_coins_v7';
 if(product.kind==='pass')return 'rainbow';
 return product.kind==='starter'||product.offer?.kind==='limited'?'bundle_starter_v7':'bundle_tools_v7';
}

/** Full paintings provide the scene; catalog text and quantities stay live. */
export function SalePosterArt({id}:{id:string}){
 return <img className="sale-poster-art" src={art(id)||undefined} alt="" aria-hidden="true" draggable={false}/>;
}
export function bundlePoster(product:Product){
 if(product.kind==='pass')return 'poster_pass_v11';
 return product.kind==='starter'||product.offer?.kind==='limited'||product.offer?.kind==='timed'?'poster_starter_v11':'poster_tools_v11';
}
