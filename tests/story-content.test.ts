import {describe,it,expect} from 'vitest';
import {RESTORATIONS,STORY_VERSION,STORY_SCENES,STORY_CHAPTERS,STORY_SPEAKERS,getUnlockedStories,storyForTask} from '@garden/content';

describe('cloud letters story content',()=>{
 it('maps every existing restoration to exactly one authored scene without changing the costs',()=>{
  expect(STORY_VERSION).toBe('cloud-letters-2');
  expect(STORY_SCENES).toHaveLength(64);
  expect(new Set(STORY_SCENES.map(scene=>scene.id)).size).toBe(STORY_SCENES.length);
  const taskScenes=STORY_SCENES.filter(scene=>scene.taskId);
  expect(taskScenes).toHaveLength(RESTORATIONS.length);
  expect(new Set(taskScenes.map(scene=>scene.taskId)).size).toBe(RESTORATIONS.length);
  expect(taskScenes.map(scene=>scene.taskId)).toEqual(RESTORATIONS.map(task=>task.id));
  expect(RESTORATIONS.slice(0,18).reduce((sum,task)=>sum+task.cost,0)).toBe(34);
  expect(RESTORATIONS.reduce((sum,task)=>sum+task.cost,0)).toBe(193);
  expect(RESTORATIONS.slice(18)).toHaveLength(45);
  for(const task of RESTORATIONS){
   const scene=storyForTask(task.id);
   expect(scene?.id).toBe('letters-'+task.id);
   expect(scene?.chapterId).toBe(task.area);
  }
  expect(storyForTask('not-a-task')).toBeUndefined();
 });

 it('provides complete readable beats and all three real speaker assets',()=>{
  expect(STORY_SPEAKERS).toEqual({lumi:{name:'루미',art:'lumi'},tori:{name:'토리',art:'tori_v8'},naru:{name:'나루',art:'naru_v8'}});
  const speakers=new Set<string>();
  for(const scene of STORY_SCENES){
   expect(scene.title.trim().length,scene.id).toBeGreaterThan(3);
   expect(scene.beats.length,scene.id).toBeGreaterThanOrEqual(2);
   expect(scene.beats.length,scene.id).toBeLessThanOrEqual(5);
   expect(scene.art).toBe('story_'+scene.chapterId+(['sky','workshop','terrace'].includes(scene.chapterId)?'_v8':'_v30'));
   for(const beat of scene.beats){
    expect(STORY_SPEAKERS[beat.speaker],scene.id).toBeDefined();
    expect(beat.text.trim().length,scene.id).toBeGreaterThan(8);
    expect(beat.text.length,scene.id).toBeLessThanOrEqual(74);
    speakers.add(beat.speaker);
   }
  }
  expect([...speakers].sort()).toEqual(['lumi','naru','tori']);
 });

 it('catalogs every scene once in its existing chapter and does not expose future areas',()=>{
  expect(STORY_CHAPTERS.map(chapter=>chapter.id)).toEqual(['sky','workshop','terrace','postal','firefly','station']);
  expect(STORY_CHAPTERS.map(chapter=>chapter.sceneIds.length)).toEqual([7,6,6,15,15,15]);
  expect(STORY_CHAPTERS.flatMap(chapter=>chapter.sceneIds)).toEqual(STORY_SCENES.map(scene=>scene.id));
  for(const chapter of STORY_CHAPTERS){
   for(const id of chapter.sceneIds)expect(STORY_SCENES.find(scene=>scene.id===id)?.chapterId).toBe(chapter.id);
  }
 });

 it('waits for first clear before the prologue and never unlocks a restoration scene from level alone',()=>{
  expect(getUnlockedStories({level:1,restored:[]})).toEqual([]);
  expect(getUnlockedStories({level:2,restored:[]})).toEqual(['letters-prologue']);
  expect(getUnlockedStories({level:10000,restored:[]})).toEqual(['letters-prologue']);
 });

 it('derives replay availability from legacy tasks in canonical order without mutating progress',()=>{
  const player={level:14,restored:RESTORATIONS.slice(0,6).map(task=>task.id)};
  const before=structuredClone(player);
  expect(getUnlockedStories(player)).toEqual(STORY_CHAPTERS[0]!.sceneIds);
  expect(player).toEqual(before);
  expect(getUnlockedStories({level:1,restored:['terrace-fountain','sky-path','sky-path','unknown']})).toEqual(['letters-prologue','letters-sky-path','letters-terrace-fountain']);
  expect(getUnlockedStories({level:200,restored:RESTORATIONS.map(task=>task.id)})).toEqual(STORY_SCENES.map(scene=>scene.id));
 });
});
