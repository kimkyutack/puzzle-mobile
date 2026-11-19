/** World decoration IDs are deliberately separate from consumable puzzle items. */
export type GardenRotation = 0 | 90 | 180 | 270;
export const GARDEN_ROTATIONS:readonly GardenRotation[]=[0,90,180,270];
export const nextGardenRotation=(rotation:GardenRotation):GardenRotation=>GARDEN_ROTATIONS[(GARDEN_ROTATIONS.indexOf(rotation)+1)%GARDEN_ROTATIONS.length]!;
export type GardenRegionId = 'sky' | 'workshop' | 'terrace' | 'pond' | 'forest' | 'postal' | 'firefly' | 'station';
export interface GridRect {x:number;y:number;width:number;height:number}
export interface GardenRegion extends GridRect {id:GardenRegionId;name:string;storyLocked?:boolean}
export interface GardenDefinition {
 id:string;width:number;height:number;initialRegions:readonly GardenRegionId[];
 maxWidth?:number;maxHeight?:number;
 regions:readonly GardenRegion[];
}
export interface DecorationDefinition {
 id:string;name:string;width:number;height:number;layer:'ground'|'object';
 category:'building'|'decoration'|'animal';
 rotations:readonly GardenRotation[];variants:readonly string[];
 role:'landmark'|'decoration';
 /** Eligibility for a later catalog; this does not publish a purchasable offer. */
 futureShop:boolean;
}

export const GARDEN_WORLD:GardenDefinition={
 id:'cloud-estate-1',width:32,height:32,maxWidth:64,maxHeight:64,initialRegions:['sky'],
 regions:[
  {id:'sky',name:'하늘 정원',x:10,y:10,width:12,height:12},
  {id:'workshop',name:'온실 작업실',x:2,y:10,width:8,height:12},
  {id:'terrace',name:'분수 테라스',x:10,y:2,width:12,height:8},
  {id:'pond',name:'연못 정원',x:22,y:10,width:8,height:12},
  {id:'forest',name:'숲속 산책길',x:10,y:22,width:12,height:8},
  {id:'postal',name:'바람 우체국',x:34,y:7,width:12,height:13,storyLocked:true},
  {id:'firefly',name:'반딧불 연못',x:34,y:24,width:12,height:12,storyLocked:true},
  {id:'station',name:'숲속 기차역',x:14,y:34,width:16,height:12,storyLocked:true}
 ]
};

/** New shop art and corresponding footprints for older clients. */
export const GARDEN_MARKET_ART='garden-v64';
export const GARDEN_MARKET_ITEMS=[
 ['garden-brick-path','벽돌 산책로',1,1,'decoration','ground',100,5,'garden-path-stone'],
 ['garden-wood-fence','나무 울타리',2,1,'decoration','object',220,5,'garden-bench'],
 ['garden-bird-feeder','새 모이대',1,1,'decoration','object',1100,5,'garden-lamp'],
 ['garden-hydrangea-bed','수국 화단',1,1,'decoration','object',1600,5,'garden-planter'],
 ['garden-swing','흔들 그네',2,1,'decoration','object',2800,5,'garden-bench'],
 ['garden-stone-bridge','석재 정원 다리',2,1,'decoration','object',4200,5,'garden-bench'],
 ['animal-duckling','아기 오리',1,1,'animal','object',900,5,'animal-rabbit'],
 ['animal-hedgehog','고슴도치',1,1,'animal','object',1200,5,'animal-cat'],
 ['garden-apiary','작은 양봉장',2,2,'building','object',5500,10,'garden-gate'],
 ['garden-shed','정원 창고',2,2,'building','object',6000,15,'garden-gate'],
 ['garden-pottery-studio','도예 공방',2,2,'building','object',7000,30,'garden-gate'],
 ['garden-glass-teahouse','유리 찻집',2,2,'building','object',7500,40,'garden-gate'],
 ['garden-watermill-cottage','물레방아 오두막',3,3,'building','object',8500,60,'garden-gazebo'],
 ['garden-lantern-arcade','등불 회랑',3,2,'building','object',9000,75,'garden-carriage'],
 ['garden-blossom-lookout','꽃나무 전망대',2,2,'building','object',9500,90,'garden-gate'],
 ['garden-music-hall','정원 음악당',3,2,'building','object',10000,100,'garden-carriage'],
] as const;

export const DECORATIONS:readonly DecorationDefinition[]=[
 {id:'garden-bench',name:'정원 벤치',category:'decoration',width:2,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic','festival'],role:'decoration',futureShop:true},
 {id:'garden-planter',name:'꽃 화단',category:'decoration',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic','festival'],role:'decoration',futureShop:true},
 {id:'garden-lamp',name:'정원 가로등',category:'decoration',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic','festival'],role:'decoration',futureShop:true},
 {id:'garden-fountain',name:'정원 분수',category:'building',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'landmark',futureShop:false},
 {id:'garden-greenhouse',name:'유리 온실',category:'building',width:4,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'landmark',futureShop:false},
 {id:'garden-path-stone',name:'돌 산책로',category:'decoration',width:1,height:1,layer:'ground',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-tree',name:'정원 나무',category:'decoration',width:2,height:2,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-rose-arch',name:'장미 아치',category:'decoration',width:2,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-lotus-pavilion',name:'연꽃 정자',category:'building',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-aurora-conservatory',name:'오로라 온실',category:'building',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-acorn-cottage',name:'도토리 오두막',category:'building',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'garden-waterwork-pavilion',name:'샘물 정원관',category:'building',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'garden-gazebo',name:'꽃그늘 정자',category:'building',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-pond',name:'수련 연못',category:'decoration',width:3,height:2,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-picnic',name:'피크닉 테이블',category:'decoration',width:2,height:2,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-hedge',name:'꽃울타리',category:'decoration',width:1,height:2,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-mushroom',name:'버섯 조명',category:'decoration',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'garden-flowerlight-arch',name:'꽃빛 축제 아치',category:'decoration',width:2,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'garden-flowerlight-fountain',name:'꽃빛 분수',category:'decoration',width:3,height:3,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'animal-rabbit',name:'꽃귀 토끼',category:'animal',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'animal-cat',name:'치즈 고양이',category:'animal',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'animal-dog',name:'꼬마 웰시코기',category:'animal',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true},
 {id:'animal-panda',name:'아기 판다',category:'animal',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'animal-fox',name:'사막여우',category:'animal',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'animal-red-panda',name:'아기 레서판다',category:'animal',width:1,height:1,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'garden-gate',name:'정원 입구',category:'building',width:2,height:2,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 {id:'garden-telescope',name:'별빛 망원경',category:'decoration',width:2,height:2,layer:'object',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 ...[
  ['post-office','바람 우체국',4,3],['mailbox','빨간 우편함',1,1],['willow','반딧불 버드나무',3,3],['jetty','물가 관찰 나루',3,2],['forest-station','숲속 기차역',4,3],['carriage','꽃빛 객차',3,2]
 ].map(([id,name,width,height])=>({id:'garden-'+id,name:name as string,width:width as number,height:height as number,category:'building' as const,layer:'object' as const,rotations:GARDEN_ROTATIONS,variants:['classic'],role:'landmark' as const,futureShop:false})),
 {id:'garden-rail',name:'정원 열차 선로',width:1,height:1,category:'decoration',layer:'ground',rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:false},
 ...GARDEN_MARKET_ITEMS.map(([id,name,width,height,category,layer]):DecorationDefinition=>({id,name,width,height,category,layer,rotations:GARDEN_ROTATIONS,variants:['classic'],role:'decoration',futureShop:true}))
];
