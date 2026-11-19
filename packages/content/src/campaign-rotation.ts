import {COLORS,supportsGliderSwarm,type CampaignBeat,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';

export const ROTATION_CONTENT_VERSION='garden-2026.11.14-rotation-v1';
export const ROTATION_MAGNET_VERSION=ROTATION_CONTENT_VERSION+':magnet-rails-v1';
export const rotationHasMagnets=(family:RotationFamily)=>['magnet-ends','magnet-crates','magnet-delivery','carousel-crossing'].includes(family);
export const ROTATION_FAMILIES=[
 'crate-courtyard','frost-pockets','magnet-ends','magnet-crates','color-vaults',
 'pipe-delivery','split-delivery','magnet-delivery','moss-race','carousel','carousel-crossing','moving-greenhouse'
] as const;
export type RotationFamily=typeof ROTATION_FAMILIES[number];
export type RotationPressure=0|1|2;

// Each entry teaches or revisits one way of playing for 2–3 puzzles. Story
// boards occupy every tenth slot, so they do not advance the rotation.
const earlyRuns:ReadonlyArray<{start:number;length:number;family:RotationFamily}>=[
 {start:41,length:2,family:'crate-courtyard'},
 {start:43,length:2,family:'frost-pockets'},
 {start:55,length:3,family:'color-vaults'},
 {start:67,length:3,family:'frost-pockets'},
];
const chapters:readonly (readonly [RotationFamily,...RotationFamily[]])[]=[
 ['magnet-ends','magnet-crates','frost-pockets','color-vaults','crate-courtyard'],
 ['pipe-delivery','split-delivery','magnet-delivery','moss-race','color-vaults','magnet-crates','frost-pockets','crate-courtyard'],
 ['carousel','carousel-crossing','moving-greenhouse','split-delivery','magnet-delivery','moss-race','frost-pockets','color-vaults','magnet-crates','crate-courtyard','pipe-delivery'],
];
const firstChapter=101,chapterLength=100,storyInterval=10;
export const ROTATION_LAST_LEVEL=firstChapter+chapters.length*chapterLength-1;
const runLengths=[3,3,2,3,2,2] as const;
const practicePuzzles=3;
const rotationPuzzlesPerChapter=chapterLength-chapterLength/storyInterval-practicePuzzles;

export function campaignRotation(id:number,beat:CampaignBeat){
 if(id>ROTATION_LAST_LEVEL||id%storyInterval===0)return;
 let family:RotationFamily|undefined,lesson:CampaignBeat|undefined,layout=0;
 if(id<firstChapter){
  const run=earlyRuns.find(({start,length})=>id>=start&&id<start+length);
  if(run){family=run.family;layout=id-run.start;}
 }else{
  const chapter=Math.floor((id-firstChapter)/chapterLength);
  const inChapter=(id-firstChapter)%chapterLength;
  const slot=inChapter-Math.floor(inChapter/storyInterval);
  const families=chapters[chapter]!;
  if(slot<practicePuzzles){
   family=families[0];
   lesson=slot===0?'introduction':'practice';
   layout=slot;
  }else{
   let left=slot-practicePuzzles,remaining=rotationPuzzlesPerChapter,run=0;
   for(;;run++){
    const length=remaining===4?2:remaining<=3?remaining:runLengths[run%runLengths.length]!;
    if(left<length)break;
    left-=length;
    remaining-=length;
   }
   // Revisit each family before rotating their order on the next pass.
   family=families[1+((run+Math.floor(run/(families.length-1)))%(families.length-1))];
   if(run%families.length===families.length-1)family=families[0];
   layout=(left+Math.floor(run/families.length))%3;
  }
 }
 if(!family)return;
 const pressure:RotationPressure=lesson||beat==='easy'||beat==='introduction'||beat==='practice'?0:beat==='hard'||beat==='super'?2:1;
 const publishedBeat=lesson??(beat==='introduction'||beat==='practice'?'normal':beat);
 return {family,pressure,layout,beat:publishedBeat};
}

const strategies:Record<RotationFamily,readonly [string,string]>={
 'crate-courtyard':['갈림길 상자 정원','양쪽 통로를 열고, 로켓이나 폭탄으로 떨어져 있는 상자를 한꺼번에 공략해요.'],
 'frost-pockets':['서리 골짜기','상자를 열어 양쪽 골짜기에 닿은 뒤, 두꺼운 서리를 걷어내요.'],
 'magnet-ends':['자석의 양 끝','자석 레일의 몸통 대신 양 끝에 닿는 매치나 특수 타일을 만들어요.'],
 'magnet-crates':['상자 사이 자석길','상자로 가려진 자석 끝을 먼저 열고, 반대편에서도 레일을 줄여요.'],
 'color-vaults':['색상 화분 온실','화분에 맞는 색을 모으면서 덩굴에 갇힌 타일도 풀어요.'],
 'pipe-delivery':['물관 아래 씨앗 배달','저장함을 열고 물관을 줄인 뒤, 씨앗 주머니 아래를 비워 출구로 내려보내요.'],
 'split-delivery':['두 갈래 씨앗 배달','양쪽 출구가 떨어져 있어요. 각 저장함 아래의 상자를 열고 씨앗을 배달해요.'],
 'magnet-delivery':['자석 너머 씨앗 배달','레일 끝을 공략해 씨앗이 내려갈 통로를 열어요.'],
 'moss-race':['번지기 전에 이끼 정리','이끼는 한 수 동안 타격하지 않으면 번져요. 멀리 떨어진 곳에도 닿는 로켓을 만들어 보세요.'],
 'carousel':['회전 화분 쫓기','화분은 타일을 움직일 때마다 한 칸 이동해요. 다음 위치를 보고 특수 타일을 준비해요.'],
 'carousel-crossing':['화분과 자석의 교차로','움직이는 화분을 쫓으면서 바깥 통로의 자석 양 끝도 공략해요.'],
 'moving-greenhouse':['회전 화분과 서리','화분을 쫓는 동안 양옆에 남은 서리도 걷어내요.'],
};

export function rotationCandidate(family:RotationFamily,pressure:RotationPressure,layout:number,seed:number,engineVersion:string):LevelDefinition{
 const width=9,height=9,at=(x:number,y:number)=>y*width+(layout%2===0?x:8-x);
 const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[],frost:Record<number,number>={},exits:number[]=[];
 const colors=[...COLORS.slice(0,pressure===2?6:5)],raised=pressure===2?1:0;
 const add=(kind:Obstacle['kind'],footprint:number[],hp:number,details:Partial<Obstacle>={})=>{
  obstacles.push({id:kind+'-'+footprint[0],kind,anchor:footprint[0]!,footprint,hp,maxHp:hp,...details});
 };
 const crate=(x:number,y:number,hp=1)=>add('crate',[at(x,y)],hp);
 const rail=(path:number[],magnet:boolean)=>add('pipe',path,path.length,magnet?{endOnly:true}:{});
 const row=(y:number,left:number,right:number)=>Array.from({length:right-left+1},(_,x)=>at(left+x,y));
 const loop=(x:number,y:number)=>[at(x,y),at(x+1,y),at(x+2,y),at(x+2,y+1),at(x+2,y+2),at(x+1,y+2),at(x,y+2),at(x,y+1)];
 const carousel=(x:number,y:number)=>{const path=loop(x,y);add('carousel',[path[(layout+pressure)%path.length]!],3+pressure,{path});};
 const cabinet=(x:number,y:number)=>{add('cabinet',[at(x,y),at(x,y+1)],2+raised,{seeds:1});exits.push(at(x,8));};
 const cut=(cells:number[])=>{for(const cell of cells)shape[cell]=false;};
 const corners=()=>cut([at(0,0),at(8,0),at(0,8),at(8,8)]);
 const patch=(cells:number[])=>{for(const cell of cells)frost[cell]=1+raised;};
 const long=supportsGliderSwarm(engineVersion)&&rotationHasMagnets(family);
 switch(family){
  case 'crate-courtyard':
   corners();
   for(const x of [0,1,2,3,5,6,7,8])crate(x,4,(x+layout)%3===0?2+raised:1+raised);
   for(const x of [1,3,5,7])crate(x,7,1+pressure);
   if(pressure>0)for(const x of [1,2,6,7])crate(x,6,1+raised);
   break;
  case 'frost-pockets':
   cut([at(3,6),at(4,6),at(5,6),at(3,7),at(4,7),at(5,7),at(3,8),at(4,8),at(5,8)]);
   for(const x of [0,1,2,6,7,8])crate(x,5,pressure===0?1:2);
   patch([6,7,8].flatMap(y=>[0,1,2,6,7,8].map(x=>at(x,y))));
   break;
  case 'magnet-ends':
   corners();
   rail([...(long?[at(1,2)]:[]),...row(3,1,4+raised),at(4+raised,4),at(4+raised,5),...(long?[at(4+raised,6)]:[])],true);
   if(pressure>0)rail([...(long?[at(7,1)]:[]),at(7,2),at(7,3),at(7,4),at(7,5),at(7,6),...(long?[at(7,7),at(6,7)]:raised?[at(6,6)]:[])],true);
   break;
  case 'magnet-crates':
   rail([...row(4,1,5),at(5,5),at(5,6),...(raised||long?[at(6,6),at(7,6)]:[]),...(long?[at(7,5),at(7,4)]:[])],true);
   for(const [x,y] of [[1,3],[1,5],[0,4],[8,6],[7,7],[5,7],[4,6],[5,3],[7,3]])crate(x!,y!,1+pressure);
   if(pressure>0)patch([at(0,7),at(1,7),at(7,2),at(8,2),at(0,8),at(8,8)]);
   break;
  case 'color-vaults':
   corners();
   for(const x of pressure===0?[2,6]:[1,4,7])add('pot',[at(x,4)],4+pressure,{color:colors[(x+layout)%colors.length]});
   for(const [x,y] of [[1,6],[2,6],[6,6],[7,6],[2,7],[6,7]])add('vine',[at(x!,y!)],1+raised);
   if(pressure>0)patch([at(2,8),at(1,7),at(7,7),at(6,8)]);
   break;
  case 'pipe-delivery':
   corners();
   for(const x of pressure===0?[4]:[2,6]){
    cabinet(x,2);
    rail([at(x-1,5),at(x,5),at(x+1,5),...(raised?[at(x+1,6),at(x+1,7)]:[])],false);
    if(pressure>0)crate(x,7,1+raised);
   }
   break;
  case 'split-delivery':
   cut([3,4,5,6,7,8].map(y=>at(4,y)));
   for(const x of [2,6]){
    cabinet(x,3);
    for(const y of [5,7])for(const dx of [-1,0,1])if(dx===0||pressure>0&&y===5)crate(x+dx,y,1+Number(raised&&dx===0));
    if(pressure>0)patch([at(x-1,8),at(x+1,8)]);
   }
   break;
  case 'magnet-delivery':
   cabinet(2,2);cabinet(6,2);
   rail([...row(5,1,4),at(4,6),...row(6,5,7),...(long?[at(7,7),at(6,7)]:[])],true);
   if(pressure>0)for(const [x,y] of [[1,4],[0,5],[1,6],[7,5],[8,6],[long?8:7,7]])crate(x!,y!,1+raised);
   break;
  case 'moss-race':
   corners();
   for(const [x,y] of [[1,2],[7,2],[1,6],[7,6],...(pressure===2?[[4,6]]:[])])add('moss',[at(x!,y!)],1+raised);
   for(const x of [1,2,6,7])crate(x,4,1+pressure);
   if(pressure===1)patch([6,7,8].flatMap(y=>(y===8?[2,6]:[0,2,6,8]).map(x=>at(x,y))));
   break;
  case 'carousel':
   corners();carousel(1,3);carousel(5,4);
   if(pressure===2)carousel(3,0);
   break;
  case 'carousel-crossing':
   carousel(3,3);
   rail([...(long?[at(2,1),at(1,1)]:[]),at(1,2),at(1,3),at(1,4),at(1,5),at(1,6),...(long?[at(1,7),at(2,7)]:[])],true);
   if(pressure>0)rail([...(long?[at(6,1),at(7,1)]:[]),at(7,2),at(7,3),at(7,4),at(7,5),at(7,6),...(long?[at(7,7),at(6,7),at(6,8)]:raised?[at(7,7),at(6,7),at(5,7)]:[])],true);
   if(pressure>0)carousel(3,6);
   break;
  case 'moving-greenhouse':
   carousel(3,3);
   for(const x of [0,1,7,8])crate(x,5,1+pressure);
   patch([1,2,6,7].flatMap(y=>[0,1,7,8].map(x=>at(x,y))));
   break;
 }
 const goals:Goal[]=[];
 const goal=(kind:Goal['kind'],count:number)=>{if(count>0)goals.push({kind,count,remaining:count});};
 for(const kind of new Set(obstacles.map(o=>o.kind)))goal(kind,obstacles.filter(o=>o.kind===kind).length);
 goal('seed',exits.length);
 goal('frost',Object.values(frost).reduce((sum,hp)=>sum+hp,0));
 if(pressure>0&&['crate-courtyard','frost-pockets','magnet-ends','carousel','carousel-crossing','moving-greenhouse'].includes(family)){
  goal('special',pressure===2?5:3);
 }
 if(pressure===1&&family==='moss-race')goal('special',4);
 if(pressure===1&&family==='carousel-crossing')goal(colors[layout%colors.length]!,32);
 if(pressure>0&&(family==='magnet-ends'||family==='carousel'))goal(colors[layout%colors.length]!,pressure===2?45:32);
 if(goals.length===1&&pressure>0)goal(colors[layout%colors.length]!,pressure===2?45:32);
 const [name,hint]=strategies[family];
 return {id:101,engineVersion,version:long?ROTATION_MAGNET_VERSION:ROTATION_CONTENT_VERSION,width,height,colors,moves:90,seed,shape,goals,obstacles,
  ...(Object.keys(frost).length?{frost}:{}),...(exits.length?{exits}:{}),
  difficulty:pressure===2?'hard':'normal',strategy:{id:family,name,hint}};
}
