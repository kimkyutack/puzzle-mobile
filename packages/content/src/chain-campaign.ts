import {COLORS,supportsObstacleGarden,type Goal,type LevelDefinition,type Obstacle,type Special,type Tile} from '@garden/contracts';
import {campaignPosition} from './campaign';

export const CHAIN_CAMPAIGN_VERSION='garden-2026.11.16-chain-v1';
const firstLevel=39,interval=100;
const powers:Readonly<Partial<Record<string,Special>>>={
 H:'wind-row',V:'wind-column',B:'bomb',G:'glider',R:'rainbow',
};
const barriers:Readonly<Partial<Record<string,Pick<Obstacle,'kind'|'hp'|'contents'>>>>={
 c:{kind:'crate',hp:1},
 d:{kind:'crate',hp:2},
 u:{kind:'urn',hp:2},
 s:{kind:'supply-crate',hp:1,contents:{kind:'urn',hp:2}},
 l:{kind:'starlight-lantern',hp:3},
 t:{kind:'statue',hp:4},
};

const layouts=[
 {
  name:'꽃폭탄 화단',
  hint:'미리 놓인 꽃폭탄과 로켓을 이어 터뜨려 아래쪽 상자밭을 열어요.',
  rows:[
   '.........',
   '.V.....V.',
   '..H.B.H..',
   '.B..B..B.',
   'ccccccccc',
   'ccdcccdcc',
   '.cc...cc.',
   '.........',
   'dH.....Hd',
  ],
 },
 {
  name:'교차 로켓 마당',
  hint:'가로 로켓으로 양쪽을 타격하고, 세로 로켓을 이어 발사해 상자와 항아리를 깨요.',
  rows:[
   'cc..H..cc',
   'ud..V..du',
   'ccVB.BVcc',
   'ud..H..du',
   'cc..B..cc',
   'cc..H..cc',
   '..V.B.V..',
   '.........',
   '.........',
  ],
 },
 {
  name:'무지개 보관소',
  hint:'무지개등과 특수 블록을 합쳐 보관 상자를 열어요. 안에서 나온 항아리까지 부수세요.',
  rows:[
   '.........',
   '.s.s.s.s.',
   '..V...V..',
   's..RB..s.',
   'ss.B.V.ss',
   '.s..BH.s.',
   '.s.RV..s.',
   '..s...s..',
   '.........',
  ],
 },
 {
  name:'씨앗비행기 편대',
  hint:'무지개등과 씨앗비행기를 합치면 비행기들이 흩어진 장애물을 찾아 날아가요.',
  rows:[
   'u..c.c..u',
   '...V...G.',
   '.c..u..c.',
   '....G....',
   'cV..R..Bc',
   '....H....',
   '.c..u..c.',
   '.G...V...',
   'u..c.c..u',
  ],
 },
 {
  name:'별빛 폭죽길',
  hint:'꽃폭탄과 로켓을 차례로 터뜨려 등불의 별빛을 드러낸 뒤 한 번 더 타격하세요.',
  rows:[
   '.ll...ll.',
   'l..V.V..l',
   '.l.B.B.l.',
   '.l.B.B.l.',
   'lH.B.B.Hl',
   '.l..R..l.',
   '.l.VB..l.',
   'l.......l',
   '.l..H..l.',
  ],
 },
 {
  name:'석상 사이의 불꽃',
  hint:'로켓과 꽃폭탄을 여러 방향에서 이어 터뜨려 석상과 상자를 깨요.',
  rows:[
   '..t...t..',
   '.B.....B.',
   'u..H.H..u',
   'tV.B...Vt',
   'd..BRB..d',
   'tV...B.Vt',
   'u..H.H..u',
   '.B.....B.',
   '..t...t..',
  ],
 },
] as const;

export const chainCampaignCopy=layouts.map(({name,hint})=>[name,hint] as const);
export const CHAIN_LAYOUT_COUNT=layouts.length*2;

export function chainCampaignBoard(variant:number,engineVersion:string,seed:number):LevelDefinition{
 const {rows,name,hint}=layouts[variant%layouts.length]!,width=9,height=rows.length;
 const mirrored=variant>=layouts.length;
 const cells=rows.flatMap(row=>mirrored?[...row].reverse():[...row]);
 if(rows.some(row=>row.length!==width))throw new Error('CHAIN_BOARD_WIDTH');
 const colors=[...COLORS.slice(0,5)],obstacles:Obstacle[]=[],counts=new Map<Goal['kind'],number>();
 const initial=cells.map((glyph,at):Tile|null=>{
  const barrier=barriers[glyph];
  if(barrier){
   obstacles.push({...barrier,id:`chain-${at}`,anchor:at,footprint:[at],maxHp:barrier.hp});
   const kind=barrier.contents?.kind??barrier.kind;
   counts.set(kind,(counts.get(kind)??0)+1);
   return null;
  }
  const power=powers[glyph];
  if(power)return {id:at+1,kind:power};
  if(glyph!=='.')throw new Error('CHAIN_BOARD_GLYPH');
  return {id:at+1,kind:'normal',color:colors[(at%width+2*Math.floor(at/width)+variant)%colors.length]!};
 });
 const goals=[...counts].map(([kind,count])=>({kind,count,remaining:count}));
 return {id:firstLevel,version:CHAIN_CAMPAIGN_VERSION,engineVersion,width,height,colors,shape:cells.map(()=>true),
  moves:8,seed,goals,obstacles,initial,difficulty:'normal',strategy:{id:`chain-campaign/${variant}`,name,hint}};
}

export function chainCampaignLevel(source:LevelDefinition):LevelDefinition{
 const offset=source.id-firstLevel;
 if(!supportsObstacleGarden(source.engineVersion)||!source.approved||source.tutorial||source.gardenStage||
  offset<0||offset%interval!==0||source.id>20_000)return source;
 const variant=(offset/interval)%CHAIN_LAYOUT_COUNT;
 return {...chainCampaignBoard(variant,source.engineVersion,147733+variant*25913),
  id:source.id,approved:true,campaign:{...campaignPosition(source.id),beat:'celebration'}};
}
