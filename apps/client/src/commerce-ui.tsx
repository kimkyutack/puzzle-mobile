import {tr} from "./i18n";
import type {Product} from '@garden/contracts';
import {Amount,Icon,names} from './ui';
import {art} from './assets';

/** Quantities remain separate from the promotional painting and come from the catalog. */
export function ProductContents({product}:{product:Product}){
 return <div className="commerce-loot" aria-label={tr("상품 구성")}>
  {product.coins>0&&<Amount kind="coin" value={product.coins}/>}
  {Object.entries(product.items).map(([item,quantity])=><span key={item} aria-label={tr("{0} {1}개",{0:(names[item]),1:(quantity)})}><Icon id={item} size={30}/><strong>{quantity}</strong></span>)}
  {product.unlimitedSeconds>0&&<span aria-label={tr("무제한 하트 {0}분",{0:(product.unlimitedSeconds/60)})}><Icon id="heart" size={29}/><strong>{product.unlimitedSeconds/60}<small>{tr("분")}</small></strong></span>}
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
