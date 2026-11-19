import {Graphics,Text,type Container} from 'pixi.js';
import type {GameState,Obstacle} from '@garden/contracts';
import {chapterCopy} from '../../../packages/contracts/src/chapter-copy';
import type {ChapterObstacleKind} from '../../../packages/contracts/src/chapter-obstacles';
import {chapterGuarded} from '../../../packages/game-core/src/chapter-obstacles';
import {tr} from './i18n';

const symbols:Record<ChapterObstacleKind,readonly [string,number]> = {
 'long-match':['4+',0xffd071],cascade:['↓',0x8bdbff],axis:['↔',0x72dfe7],diagonal:['◇',0xffd98b],
 'two-colors':['◐',0xfac3f0],guard:['□',0xffbb88],cooldown:['◷',0xe0d8ff],window:['◷',0xffcb98],
 slide:['→',0xffd983],landing:['⇣',0x90e4fc],relay:['✧',0xcde9ff],compost:['●',0xb9ed88],
 junction:['┬',0xfcd68e],fusion:['⊕',0xfac2f7],thaw:['✦',0x9de6ff],swap:['⇄',0xd8e4a9],
 'color-wave':['≈',0xf1a8e8],
};

function badge(obstacle:Obstacle,state:GameState):readonly [string,number] {
 const rule=obstacle.chapter!;
 const [symbol,color]=symbols[rule.kind];
 if(rule.kind==='axis')return [rule.axis==='row'?'↔':'↕',color];
 if(rule.kind==='slide')return [obstacle.hp<obstacle.maxHp?'•':rule.side==='left'?'←':'→',color];
 if(rule.kind==='window'&&rule.turn!==undefined)return [String(Math.max(0,rule.turn-state.turn)),0xff976c];
 if(chapterGuarded(state,obstacle))return ['×',0xc5b2af];
 return [symbol,color];
}

export function chapterObstacleLabel(obstacle:Obstacle,state:GameState):string{
 const name=tr(chapterCopy[obstacle.chapter!.kind][0][0]);
 return `${name} ${badge(obstacle,state)[0]}`;
}

export function chapterBadgeChanged(previous:Obstacle,next:Obstacle,before:GameState,after:GameState):boolean{
 if(!previous.chapter||!next.chapter)return false;
 const [oldGlyph,oldColor]=badge(previous,before),[newGlyph,newColor]=badge(next,after);
 return oldGlyph!==newGlyph||oldColor!==newColor;
}

export function drawChapterObstacle(layer:Container,obstacle:Obstacle,state:GameState,at:{x:number;y:number},cell:number):void{
 const [glyph,color]=badge(obstacle,state),x=at.x-cell*.29,y=at.y-cell*.28;
 const mark=new Graphics().circle(x,y,cell*.157).fill(0x293548).stroke({color,width:Math.max(1,cell*.023)});
 mark.label='chapter-obstacle-'+obstacle.chapter!.kind;
 const label=new Text({text:glyph,style:{fontFamily:'system-ui',fontWeight:'bold',fontSize:Math.max(9,cell*(glyph.length>1?.185:.255)),fill:color}});
 label.anchor.set(.5);label.position.set(x,y);
 layer.addChild(mark,label);
}
