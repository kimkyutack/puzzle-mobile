/** World decoration IDs are deliberately separate from consumable puzzle items. */
export type GardenRotation = 0 | 90 | 180 | 270;
export type GardenRegionId = 'sky' | 'workshop' | 'terrace' | 'pond' | 'forest';
export interface GridRect {x:number;y:number;width:number;height:number}
export interface GardenRegion extends GridRect {id:GardenRegionId;name:string}
export interface GardenDefinition {
 id:string;width:number;height:number;initialRegions:readonly GardenRegionId[];
 regions:readonly GardenRegion[];
}
export interface DecorationDefinition {
 id:string;name:string;width:number;height:number;layer:'ground'|'object';
 category:'building'|'decoration'|'animal';
 rotations:readonly GardenRotation[];variants:readonly string[];
 role:'landmark'|'decoration';regions?:readonly GardenRegionId[];
 /** Eligibility for a later catalog; this does not publish a purchasable offer. */
 futureShop:boolean;
}

export const GARDEN_WORLD:GardenDefinition={
 id:'cloud-estate-1',width:32,height:32,initialRegions:['sky'],
 regions:[
  {id:'sky',name:'하늘 정원',x:10,y:10,width:12,height:12},
  {id:'workshop',name:'온실 작업실',x:2,y:10,width:8,height:12},
  {id:'terrace',name:'분수 테라스',x:10,y:2,width:12,height:8},
  {id:'pond',name:'연못 정원',x:22,y:10,width:8,height:12},
  {id:'forest',name:'숲속 산책길',x:10,y:22,width:12,height:8}
 ]
};

/** Draft footprints. New map art must be authored to these footprints before UI integration. */
export const DECORATIONS:readonly DecorationDefinition[]=[
 {id:'garden-bench',name:'정원 벤치',category:'decoration',width:2,height:1,layer:'object',rotations:[0,90],variants:['classic','festival'],role:'decoration',futureShop:true},
 {id:'garden-planter',name:'꽃 화단',category:'decoration',width:1,height:1,layer:'object',rotations:[0],variants:['classic','festival'],role:'decoration',futureShop:true},
 {id:'garden-lamp',name:'정원 가로등',category:'decoration',width:1,height:1,layer:'object',rotations:[0],variants:['classic','festival'],role:'decoration',futureShop:true},
 {id:'garden-fountain',name:'정원 분수',category:'building',width:3,height:3,layer:'object',rotations:[0],variants:['classic'],role:'landmark',regions:['sky','workshop','terrace'],futureShop:false},
 {id:'garden-greenhouse',name:'유리 온실',category:'building',width:4,height:3,layer:'object',rotations:[0,90],variants:['classic'],role:'landmark',regions:['workshop'],futureShop:false},
 {id:'garden-path-stone',name:'돌 산책로',category:'decoration',width:1,height:1,layer:'ground',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-tree',name:'정원 나무',category:'decoration',width:2,height:2,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-rose-arch',name:'장미 아치',category:'decoration',width:2,height:1,layer:'object',rotations:[0,90],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-gazebo',name:'꽃그늘 정자',category:'building',width:3,height:3,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-pond',name:'수련 연못',category:'decoration',width:3,height:2,layer:'object',rotations:[0,90],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-picnic',name:'피크닉 테이블',category:'decoration',width:2,height:2,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-hedge',name:'꽃울타리',category:'decoration',width:1,height:2,layer:'object',rotations:[0,90],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-mushroom',name:'버섯 조명',category:'decoration',width:1,height:1,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'animal-rabbit',name:'꽃귀 토끼',category:'animal',width:1,height:1,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'animal-cat',name:'치즈 고양이',category:'animal',width:1,height:1,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'animal-dog',name:'꼬마 웰시코기',category:'animal',width:1,height:1,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-gate',name:'정원 입구',category:'building',width:2,height:2,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:false},
 {id:'garden-telescope',name:'별빛 망원경',category:'decoration',width:2,height:2,layer:'object',rotations:[0],variants:['classic'],role:'decoration',futureShop:false}
];
