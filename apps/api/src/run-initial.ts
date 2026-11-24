import type {Color,LevelDefinition,PreBooster,Tile} from '@garden/contracts';
import {createGame,findMatches} from '@garden/core';
import {layeredCampaignOpening} from '../../../packages/content/src/layered-campaign';
import type {StartGiftPower} from '../../../packages/contracts/src/start-gift';

const hasAuthoredOpening=(level:LevelDefinition)=>!!level.tutorial||
 level.campaign?.beat==='introduction'&&(level.strategy?.id.startsWith('layered-campaign/intro/')||
  level.obstacles.some(obstacle=>obstacle.rule!==undefined||obstacle.chapter!==undefined));

/** New-attempt data, not new simulation rules. The exact resulting definition
 * is saved on Run and sent to the client for identical local/server replay. */
export function randomAttemptLevel(template:LevelDefinition,seed:number):LevelDefinition{
 if(hasAuthoredOpening(template))return structuredClone(template);
 const original=createGame(template),initial=original.cells.map(cell=>structuredClone(cell.tile)),fixed=new Set(template.protectedCells??[]);
 let rng=(seed>>>0)||1;
 const next=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return rng>>>0;};
 const colorAt=(at:number,changed:number,color:Color)=>at===changed?color:initial[at]?.kind==='normal'?(initial[at] as Extract<Tile,{kind:'normal'}>).color:undefined;
 const makesMatch=(at:number,color:Color)=>{
  const x=at%template.width,y=Math.floor(at/template.width),same=(indices:number[])=>indices.every(i=>colorAt(i,at,color)===color);
  for(let dx=-2;dx<=0;dx++)if(x+dx>=0&&x+dx+2<template.width&&same([at+dx,at+dx+1,at+dx+2]))return true;
  for(let dy=-2;dy<=0;dy++)if(y+dy>=0&&y+dy+2<template.height&&same([at+dy*template.width,at+(dy+1)*template.width,at+(dy+2)*template.width]))return true;
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++)if(x+dx>=0&&x+dx+1<template.width&&y+dy>=0&&y+dy+1<template.height){const a=at+dy*template.width+dx;if(same([a,a+1,a+template.width,a+template.width+1]))return true;}
  return false;
 };
 for(let at=0;at<initial.length;at++){
  const tile=initial[at];if(tile?.kind!=='normal'||fixed.has(at))continue;
  const choices=[...template.colors];for(let i=choices.length-1;i>0;i--){const j=next()%(i+1);[choices[i],choices[j]]=[choices[j]!,choices[i]!];}
  const color=choices.find(color=>!makesMatch(at,color));if(color)initial[at]={...tile,color};
 }
 return {...structuredClone(template),seed:(seed>>>0)||1,initial};
}

function withStartingGift(level:LevelDefinition,preBoosters:PreBooster[],powers:readonly StartGiftPower[]){
 const purchased=createGame(level,preBoosters),giftPlacements:{at:number;kind:StartGiftPower}[]=[];
 if(!powers.length)return {level,state:purchased,giftPlacements};
 const base=preBoosters.length?createGame(level):purchased,protectedCells=new Set(level.protectedCells??[]);
 if(level.tutorial){
  const {from,to}=level.tutorial;protectedCells.add(from);protectedCells.add(to);
  const demonstration=structuredClone(base);
  [demonstration.cells[from]!.tile,demonstration.cells[to]!.tile]=[demonstration.cells[to]!.tile,demonstration.cells[from]!.tile];
  for(const match of findMatches(demonstration))for(const at of match.cells)protectedCells.add(at);
 }
 if(level.startBoosterGuide)protectedCells.add(level.startBoosterGuide.cell);
 const colorGoals=new Set(level.goals.map(goal=>goal.kind));
 // Reserve every purchased placement before adding gifts. Leave authored
 // specials, obstacles, seeds, ice, exits and tutorial swaps untouched.
 const eligible=base.cells.flatMap((cell,at)=>cell.exists&&cell.tile?.kind==='normal'&&purchased.cells[at]?.tile?.kind==='normal'&&!cell.obstacleId&&!cell.frost&&!cell.exit&&!protectedCells.has(at)?[at]:[]);
 const hash=(at:number)=>{let n=(level.seed^Math.imul(at+1,0x9e3779b1))>>>0;n^=n>>>16;return Math.imul(n,0x85ebca6b)>>>0;};
 eligible.sort((a,b)=>Number(colorGoals.has((base.cells[a]!.tile as Extract<Tile,{kind:'normal'}>).color))-Number(colorGoals.has((base.cells[b]!.tile as Extract<Tile,{kind:'normal'}>).color))||hash(a)-hash(b));
 const initial=base.cells.map(cell=>structuredClone(cell.tile));
 for(const kind of powers){
  const at=eligible.shift();if(at===undefined)break;
  // Keep the normal tile's ID so replay allocates the same IDs to purchased
  // boosters. Never bake already purchased boosters into level.initial twice.
  initial[at]={id:initial[at]!.id,kind};giftPlacements.push({at,kind});
 }
 if(!giftPlacements.length)return {level,state:purchased,giftPlacements};
 const gifted={...structuredClone(level),initial};
 return {level:gifted,state:createGame(gifted,preBoosters),giftPlacements};
}

export function prepareRunInitial(template:LevelDefinition,preBoosters:PreBooster[],randomStart:boolean,seed:number,powers:readonly StartGiftPower[]=[]){
 if(!randomStart||hasAuthoredOpening(template))return withStartingGift(template,preBoosters,powers);
 // Bounded validation covers automatic matches, deadlocks, fixed special/seed
 // cells and booster placement. No solver or extra database round trip at start.
 for(let attempt=0;attempt<16;attempt++){
  const attemptSeed=(seed+attempt*104729)>>>0;
  const level=(attempt<2?layeredCampaignOpening(template,attemptSeed):undefined)??randomAttemptLevel(template,attemptSeed);
  try{return withStartingGift(level,preBoosters,powers);}catch(error){
   if(!(error instanceof Error)||!['INITIAL_AUTO_MATCH','INITIAL_DEADLOCK','PREBOOSTER_PLACEMENT_UNAVAILABLE'].includes(error.message))throw error;
  }
 }
 throw new Error('INITIAL_RANDOMIZATION_UNAVAILABLE');
}
