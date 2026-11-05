import {DECORATIONS,GardenWorldError,applyTrustedDecorationGrant,type GardenWorldState} from '../../../../packages/garden-world/src';
import {PREVIEW_OWNER} from './preview-state';
/** Free demonstration only. No wallet, payment, receipt provider or live account is accessed. */
export function purchasePreviewItem(world:GardenWorldState,itemId:string,purchaseId:string):{world:GardenWorldState;instanceId:string} {
 if(world.ownerId!==PREVIEW_OWNER)throw new GardenWorldError('FORBIDDEN');
 const item=DECORATIONS.find(item=>item.id===itemId);
 if(!item?.futureShop)throw new GardenWorldError('ITEM_NOT_FOR_SALE');
 const grantId='preview-shop-'+purchaseId,instanceId='preview-item-'+purchaseId;
 if(!Object.hasOwn(world.grants,grantId)&&Object.keys(world.owned).length>=1000)throw new Error('꾸미기 보관함이 가득 찼어요.');
 return {instanceId,world:applyTrustedDecorationGrant(world,{ownerId:PREVIEW_OWNER,grantId,itemId,variant:'classic',source:'shop',instanceIds:[instanceId]})};
}
