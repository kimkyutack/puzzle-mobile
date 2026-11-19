import type {Color,LevelDefinition,PreBooster,Tile} from '@garden/contracts';
import {createGame} from '@garden/core';
import {layeredCampaignOpening} from '../../../packages/content/src/layered-campaign';

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

export function prepareRunInitial(template:LevelDefinition,preBoosters:PreBooster[],randomStart:boolean,seed:number){
 if(!randomStart||hasAuthoredOpening(template))return {level:template,state:createGame(template,preBoosters)};
 // Bounded validation covers automatic matches, deadlocks, fixed special/seed
 // cells and booster placement. No solver or extra database round trip at start.
 for(let attempt=0;attempt<16;attempt++){
  const attemptSeed=(seed+attempt*104729)>>>0;
  const level=(attempt<2?layeredCampaignOpening(template,attemptSeed):undefined)??randomAttemptLevel(template,attemptSeed);
  try{return {level,state:createGame(level,preBoosters)};}catch(error){
   if(!(error instanceof Error)||!['INITIAL_AUTO_MATCH','INITIAL_DEADLOCK','PREBOOSTER_PLACEMENT_UNAVAILABLE'].includes(error.message))throw error;
  }
 }
 throw new Error('INITIAL_RANDOMIZATION_UNAVAILABLE');
}
