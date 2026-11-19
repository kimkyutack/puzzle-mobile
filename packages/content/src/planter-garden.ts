import {COLORS,supportsPlanterGarden,type LevelDefinition,type Obstacle,type Special,type Tile} from '@garden/contracts';
import type {GardenOpenerKind} from '../../contracts/src/breakable-obstacles';
import {campaignPosition} from './campaign';

export const PLANTER_GARDEN_VERSION='garden-2026.11.16-planter-garden-v1';
const layouts=[
 {
  name:'온실 수문',
  hint:'미리 놓인 가로 로켓으로 수문을 열어요. 같은 표식의 진흙이 씻겨 나가면 화분을 깨세요.',
  rows:[
   '.........',
   '.........',
   '..S.H....',
   '.........',
   '....H.T..',
   '.........',
   'ss.....tt',
   'ssB...Btt',
   '.ss...tt.',
  ],
 },
 {
  name:'덩굴 화분 마당',
  hint:'로켓이나 꽃폭탄으로 덩굴 매듭을 끊으면 같은 표식의 화분이 풀려요. 화분은 하나씩 깨세요.',
  rows:[
   '.........',
   '.V.....V.',
   '.K.....L.',
   '....Z.H..',
   '.........',
   'kk...zzll',
   'kkB.B.Bll',
   '.....zz..',
   '.........',
  ],
 },
 {
  name:'돌아가는 화분 선반',
  hint:'선반을 로켓으로 맞히면 화분이 드러나고 선반 자리에 세로 로켓이 나와요.',
  rows:[
   '.........',
   '.........',
   '.X..H..Y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
  ],
  practiceRows:[
   '.........',
   '....H..Y.',
   '.X..H..y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
   '.x.....y.',
   '.x.......',
  ],
 },
 {
  name:'물길과 덩굴',
  hint:'수문을 열어 진흙을 씻고, 매듭을 끊어 덩굴을 풀어요. 드러난 화분을 꽃폭탄으로 함께 깨세요.',
  rows:[
   '.........',
   '..S.H....',
   '......V..',
   '......K..',
   '.........',
   '.ss...kk.',
   '.ssB.Bkk.',
   '..ss.kk..',
   '..H...H..',
  ],
 },
 {
  name:'온실 화분 대청소',
  hint:'수문과 매듭을 먼저 공략하고, 선반에서 나온 세로 로켓을 이용해 가운데 화분까지 깨세요.',
  rows:[
   '.........',
   '....H..S.',
   '.V..X..H.',
   '.K..x....',
   '....x....',
   'kk..x..ss',
   'kkB.x.Bss',
   '.kk.x.ss.',
   '....x....',
  ],
 },
] as const;

export const planterGardenCopy=layouts.map(({name,hint})=>[name,hint] as const);
const openers:Readonly<Partial<Record<string,GardenOpenerKind>>>={
 S:'greenhouse-sluice',T:'greenhouse-sluice',K:'vine-knot',L:'vine-knot',Z:'vine-knot',X:'rotating-shelf',Y:'rotating-shelf',
};
const powers:Readonly<Partial<Record<string,Special>>>={H:'wind-row',V:'wind-column',B:'bomb',G:'glider'};
const openerId=(glyph:string)=>`planter-opener-${Object.keys(openers).indexOf(glyph)+1}`;

export function planterGardenLevel(source:LevelDefinition):LevelDefinition{
 const offset=source.id-251,position=offset%100;
 if(!supportsPlanterGarden(source.engineVersion)||!source.approved||source.tutorial||source.gardenStage||offset<0||position>1)return source;
 const chapter=Math.floor(offset/100),layout=chapter<layouts.length?chapter:(chapter-layouts.length)%layouts.length;
 const design=layouts[layout]!;
 const {name,hint}=design;
 const practice=position===1,mirror=practice!==(chapter>=layouts.length&&Math.floor(chapter/layouts.length)%2===1);
 const rows=practice&&'practiceRows' in design?design.practiceRows:design.rows,width=9,height=rows.length;
 const cells=rows.flatMap(row=>mirror?[...row].reverse():[...row]);
 const obstacles:Obstacle[]=[],colors=[...COLORS.slice(0,5)];
 const initial=cells.map((glyph,at):Tile|null=>{
  const opener=openers[glyph];
  if(opener){
   obstacles.push({id:openerId(glyph),kind:opener,anchor:at,footprint:[at],hp:1,maxHp:1,
    ...(opener==='rotating-shelf'?{storedRocket:'wind-column' as const}:{})});
   return null;
  }
  const coveredBy=glyph.toUpperCase(),kind=openers[coveredBy];
  if(kind){
   const row=Math.floor(at/width),column=at%width;
   const hp=(practice||chapter>=layouts.length)&&(column+row)%3===0?2:1;
   obstacles.push({id:`planter-${at}`,kind:'garden-planter',anchor:at,footprint:[at],hp,maxHp:hp,cover:{source:openerId(coveredBy),kind}});
   return null;
  }
  const power=powers[glyph];
  return power?{id:at+1,kind:power}:{id:at+1,kind:'normal',color:colors[(at%width+2*Math.floor(at/width)+layout)%colors.length]!};
 });
 const count=obstacles.filter(o=>o.kind==='garden-planter').length;
 const beat=practice?'practice':chapter<3?'introduction':'normal';
 return {id:source.id,width,height,shape:cells.map(()=>true),colors,seed:82177+layout*23911+position*12421,
  initial,obstacles,goals:[{kind:'garden-planter',count,remaining:count}],moves:Math.max(source.moves,practice?17:14),
  version:PLANTER_GARDEN_VERSION,engineVersion:source.engineVersion,approved:true,difficulty:'normal',
  strategy:{id:`planter-garden/${layout}`,name,hint},campaign:{...campaignPosition(source.id),beat}};
}
