import {describe,it,expect,vi} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import sharp from 'sharp';
import {OBSTACLE_FRAGMENT_KINDS,OBSTACLE_IMAGE_KINDS,mobileObstacleArt} from '../apps/client/src/mobile-obstacle-art';
import {magnetRailPath} from '../apps/client/src/magnet-rail-visual';
import {pipeRibbon} from '../apps/client/src/pipe-ribbon';
import type {Obstacle} from '@garden/contracts';
vi.mock('../apps/client/src/assets',()=>({assetImage:(id:string)=>id.startsWith('mobile-')?{naturalWidth:128,naturalHeight:128}:undefined}));
import {createObstacleDebris,type DebrisPose} from '../apps/client/src/obstacle-debris';

describe('complete obstacle visual and material sets',()=>{
 it('ships three physical stages and three matching debris images for every obstacle, ice and gate',()=>{
  const manifest=JSON.parse(readFileSync('packages/assets/obstacle-redesign/manifest.json','utf8'));
  expect(manifest.missing).toEqual([]);expect(manifest.version).toBe('open-silhouette-2026.11.20');
  expect(manifest.diagnostics).toHaveLength(67);for(const source of manifest.diagnostics){expect(source.cornerAlpha,source.family+' backdrop haze').toBeLessThanOrEqual(8);expect(source.gutterAlpha,source.family+' gutter').toBeLessThanOrEqual(8);expect(source.clearGutter,source.family+' uncut sprite rows').toBeGreaterThanOrEqual(4);}const ids=new Set(manifest.frames.map((f:{id:string})=>f.id));
  for(const kind of OBSTACLE_FRAGMENT_KINDS)for(let stage=0;stage<3;stage++){
   expect(ids.has(`mobile-${kind}-${stage}`),kind+' body').toBe(true);
   expect(ids.has(`mobile-${kind}-debris-${stage}`),kind+' fragment').toBe(true);
  }
  for(const frame of manifest.frames)expect(existsSync(frame.path),frame.path).toBe(true);
 });
 it('keeps transparent cell margins and bounded texture sizes, including see-through overlays',async()=>{
  const manifest=JSON.parse(readFileSync('packages/assets/obstacle-redesign/manifest.json','utf8'));
  for(const f of manifest.frames){const image=sharp(f.path),meta=await image.metadata();expect(meta.width,f.id).toBe(f.role==='debris'?128:256);expect(meta.height).toBe(meta.width);expect(meta.hasAlpha).toBe(true);
   const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});expect(data[3],f.id+' margin').toBe(0);expect(data[(info.width*info.height-1)*4+3],f.id+' margin').toBe(0);
  }
  for(const kind of ['vine','frost'])for(let stage=0;stage<3;stage++){const{data,info}=await sharp(`packages/assets/obstacle-redesign/runtime/mobile-${kind}-${stage}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect(data[((info.height/2)*info.width+info.width/2)*4+3],kind+' tile visibility').toBeLessThan(60);}
 });
 it('requires a separate form and official reference decision for every obstacle instead of a blanket frame template',()=>{
  const rules=JSON.parse(readFileSync('packages/assets/obstacle-redesign/form-rules.json','utf8'));
  expect(Object.keys(rules).sort()).toEqual([...OBSTACLE_IMAGE_KINDS].sort());
  for(const rule of Object.values(rules)as {form:string;extraDecorativeFrame:boolean;references:{url:string}[]}[]){expect(rule.extraDecorativeFrame).toBe(false);expect(rule.form.length).toBeGreaterThan(4);expect(rule.references.length).toBeGreaterThan(0);expect(rule.references.every(r=>r.url.startsWith('https://dreamgames.helpshift.com/'))).toBe(true);}
  expect(new Set(Object.values(rules).map((r:any)=>r.form)).size).toBeGreaterThan(10);
  expect(rules['shelf-vase'].form).toContain('shared group shelf');
  expect(rules['rail-pot'].form).toBe('standalone flowerpot');
 });
 it('preserves charged, guarded, covered and wire states in the chosen artwork',()=>{
  const o=(kind:Obstacle['kind'],extra:Partial<Obstacle>={})=>({id:'visual',kind,anchor:0,footprint:[0],hp:3,maxHp:3,...extra});
  expect(mobileObstacleArt(o('garden-beacon',{charge:2,siege:{capacity:3}}))).toBe('mobile-garden-beacon-0');
  expect(mobileObstacleArt(o('garden-beacon',{charge:3,siege:{capacity:3}}))).toBe('mobile-beacon-lit-0');
  expect(mobileObstacleArt(o('bloom-bud',{siege:{shielded:true}}))).toBe('mobile-bloom-shield-0');
  expect(mobileObstacleArt(o('thorn-barricade',{siege:{guard:'beacon'}}))).toBe('mobile-thorn-guard-0');
  expect(mobileObstacleArt(o('shadow-bud'),true)).toBe('mobile-shadow-covered-0');
  for(const [wire,stage]of [[3,0],[1,1],[2,2]]as const)expect(mobileObstacleArt(o('wire-planter',{wire}))).toBe(`mobile-wire-planter-${stage}`);
  expect(mobileObstacleArt(o('wire-planter',{wire:0}))).toBe('mobile-garden-planter-0');
 });
 it('launches its own newly authored material on every hit and clears all particles afterwards',()=>{
  for(const kind of OBSTACLE_FRAGMENT_KINDS){const shown:DebrisPose[]=[];const fx=createObstacleDebris({bounds:()=>({x:0,y:0,width:390,height:844}),paint:p=>{shown.push(...p);},destroy:()=>{}});
   fx.burst(kind,{x:190,y:420},40,100,300,false,4);fx.update(160);expect(shown.length,kind).toBeGreaterThan(0);expect(shown.every(p=>p.art.startsWith(`mobile-${kind}-debris-`)),kind).toBe(true);
   fx.burst(kind,{x:190,y:420},40,200,400,true,7);fx.update(300);expect(shown.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),kind).toBe(true);fx.update(2500);fx.destroy();
  }
  expect(new Set(OBSTACLE_IMAGE_KINDS).size).toBe(57);
 });
 it('wraps one continuous textured ribbon around every rail turn without separated joints',()=>{
  const at=(i:number)=>({x:i%9*40+20,y:Math.floor(i/9)*40+20});
  for(const footprint of [[0,1,2,11,20,19,18,27,36],[8,17,26,25,24,23,22,31,40]]){
   const o:Obstacle={id:'r',kind:'pipe',anchor:footprint[0]!,footprint,hp:footprint.length,maxHp:footprint.length,endOnly:true},path=magnetRailPath(o,at,40)!,mesh=pipeRibbon(path,40);
   expect(mesh.points[0]).toEqual(path.ends[0].tip);expect(mesh.points.at(-1)).toEqual(path.ends[1].tip);
   for(let i=0;i<mesh.points.length;i++){const x=(mesh.positions[i*4]!+mesh.positions[i*4+2]!)/2,y=(mesh.positions[i*4+1]!+mesh.positions[i*4+3]!)/2;expect(x).toBeCloseTo(mesh.points[i]!.x,4);expect(y).toBeCloseTo(mesh.points[i]!.y,4);if(i)expect(Math.hypot(mesh.points[i]!.x-mesh.points[i-1]!.x,mesh.points[i]!.y-mesh.points[i-1]!.y)).toBeLessThanOrEqual(8);}
   expect([...mesh.positions,...mesh.uvs].every(Number.isFinite)).toBe(true);expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length/2);
  }
 });
});
