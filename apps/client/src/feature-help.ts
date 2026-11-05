import type {GameState} from '@garden/contracts';
import {getLocale,type Locale} from './i18n';

const copy={
 ko:{
  pipe:'물관 옆에서 맞추거나 타격하면 한 칸씩 줄어들어요. 열린 칸으로 타일이 내려와요.',
  bud:'꽃봉오리 옆에서 표시된 색을 맞추세요. 꽃이 열리면 나온 씨앗을 출구로 내려보내요.',
  carousel:'화분이 매 이동 후 길을 따라 한 칸 움직여요. 주변에서 맞추거나 특수 타일로 타격하세요.',
  curtain:'표시된 색의 블록을 모으면 차양이 걷히고 새로운 구역이 열려요.',
  combo:'특수 타일 두 개를 서로 바꿔 강력한 조합을 만들어요. 표시된 횟수만큼 조합하면 목표가 완성돼요.',
  special:'줄바람, 꽃폭탄 같은 특수 타일을 탭하거나 바꿔 목표 횟수만큼 사용해요.',
  crate:'옆에서 같은 색을 맞추거나 특수 블록으로 타격해 상자를 열어요. 여러 겹은 한 겹씩 줄어요.',
  vine:'덩굴에 잡힌 타일을 맞추거나 타격하면 풀려요. 풀기 전에는 움직일 수 없어요.',
  frost:'서리 위 타일을 없애면 바닥의 서리가 한 겹 녹아요. 남은 서리를 모두 녹여 주세요.',
  seed:'씨앗 아래 타일을 없애 출구까지 내려 보내요. 씨앗은 직접 터뜨리는 목표가 아니에요.',
  pot:'화분 왼쪽 아래의 타일 아이콘을 확인하세요. 보드 어디서든 그 색을 3개 이상 맞추면 숫자가 1씩 줄어요. 망치나 줄바람만으로는 줄지 않아요.',
  moss:'이끼 옆에서 맞추거나 직접 타격해 없애요. 한 수 동안 이끼를 못 없애면 한 칸 번져요.',
  cabinet:'두 칸짜리 씨앗 저장함이에요. 주변에서 맞추거나 타격해 열면 씨앗이 나와요. 숫자는 남은 내구도이며, 색 조건이 있으면 그 색으로 맞춰요.',
  'wind-row':'탭하거나 옆 타일과 바꾸면 가로 한 줄을 정리해요. 이동 1회를 사용해요.',
  'wind-column':'탭하거나 옆 타일과 바꾸면 세로 한 줄을 정리해요. 이동 1회를 사용해요.',
  bomb:'탭하거나 옆 타일과 바꾸면 주변 넓은 영역을 정리해요. 이동 1회를 사용해요.',
  glider:'출발점 주변을 정리하고 필요한 목표로 날아가요. 탭이나 교환은 이동 1회를 사용해요.',
  rainbow:'일반 타일과 바꾸면 같은 색을 모두 모아요. 탭하면 가장 많은 색을 골라요.',
 },
 en:{
  pipe:'Match next to a pipe or hit it to retract one cell and open space.',
  bud:'Match the shown color next to the bud. When it opens, deliver its seed through an exit.',
  carousel:'The planter moves one step after each move. Match beside it or hit it with a power-up.',
  curtain:'Collect blocks of the shown color to lift the shade and open the area below.',
  combo:'Swap two power-ups with each other to create a combo. Complete the shown number of combos.',
  special:'Tap or swap power-ups to activate the shown number of special pieces.',
  crate:'Match next to a crate or hit it with a special to open it. Each hit removes one layer.',
  vine:'Match or hit the trapped piece to free it. It cannot move while the vine remains.',
  frost:'Remove the piece above frost to melt one floor layer. Melt all remaining frost.',
  seed:'Clear pieces below a seed pouch to drop it through an exit. Direct hits do not collect seeds.',
  pot:'Check the tile icon at the pot’s lower left. Each match of that color anywhere on the board lowers its number by one. Hammers and wind alone do not count.',
  moss:'Match next to moss or hit it directly. If a move clears no moss, it spreads to one adjacent cell.',
  cabinet:'A seed chest occupies two cells. Match next to it or hit it to release seeds. The number is its remaining strength; a colored chest requires that matching color.',
  'wind-row':'Tap or swap with a neighbor to clear a row. Activating it uses one move.',
  'wind-column':'Tap or swap with a neighbor to clear a column. Activating it uses one move.',
  bomb:'Tap or swap with a neighbor to clear a wide area around it. Activating it uses one move.',
  glider:'Clears nearby pieces, then flies to a useful target. Tapping or swapping uses one move.',
  rainbow:'Swap with a normal piece to collect that color. Tap to choose the most common color.',
 },
} as const;
export type HelpFeature=keyof typeof copy.ko;
const boardFeatures=['combo','special','crate','vine','frost','seed','pot','moss','cabinet','pipe','bud','carousel','curtain','wind-row','wind-column','bomb','glider','rainbow'] as const;
export function featureHelp(feature:string,locale:Locale=getLocale()):string{return copy[locale][feature as HelpFeature]??'';}
/** Presentation only: finds first-appearance lessons without changing the puzzle or consuming a move. */
export function unseenBoardFeatures(state:GameState,seen:readonly string[]):HelpFeature[]{
 const present=new Set<string>(state.goals.filter(goal=>goal.remaining>0).map(goal=>goal.kind));
 for(const obstacle of Object.values(state.obstacles))if(obstacle.hp>0)present.add(obstacle.kind);
 if(state.cells.some(cell=>cell.frost>0))present.add('frost');
 for(const cell of state.cells)if(cell.tile&&cell.tile.kind!=='normal')present.add(cell.tile.kind);
 return boardFeatures.filter(feature=>present.has(feature)&&!seen.includes(feature));
}
