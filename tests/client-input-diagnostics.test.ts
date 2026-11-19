import {describe,it,expect} from 'vitest';
import {INPUT_HISTORY_KEY,INPUT_REVISION,recordInputTrace,readInputTraces,recordInputAction,addDragSample,appendInputReport,type InputTrace} from '../apps/client/src/input-diagnostics';
function fixture():InputTrace{return {at:Date.now(),pointer:'touch',turn:3,state:'abc123',from:40,tile:'rainbow',cell:40,viewport:{width:390,height:844,dpr:3},samples:[],decision:'swap',reason:'release',to:39};}
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}};}
describe('on-device input diagnosis',()=>{
 it('retains the initial direction and latest samples with a fixed-size history',()=>{
  const store=storage(),trace=fixture();
  for(let i=0;i<100;i++)addDragSample(trace,{dx:i/10,dy:0,axis:'x',to:39});
  expect(trace.samples).toHaveLength(12);expect(trace.samples[0]!.dx).toBe(0);expect(trace.samples.at(-1)!.dx).toBe(9.9);
  for(let turn=0;turn<50;turn++)recordInputTrace({...trace,turn},store);
  const saved=readInputTraces(store);expect(saved).toHaveLength(24);expect(saved[0]!.turn).toBe(26);expect(saved.at(-1)!.turn).toBe(49);
 });
 it('records the actual submitted action separately from the finger preview',()=>{
  const store=storage(),trace=fixture();recordInputTrace(trace,store);recordInputAction(trace.at,{type:'swap',from:40,to:39},store);
  expect(readInputTraces(store)[0]).toMatchObject({to:39,action:{type:'swap',from:40,to:39}});
  recordInputAction(trace.at-100,{type:'tap',at:1},store);expect(readInputTraces(store)).toHaveLength(1);
 });
 it('uses an allow list and excludes unrelated account fields from persisted/exported data',()=>{
  const store=storage(),trace={...fixture(),email:'private@example.invalid',token:'SECRET',board:'FULL BOARD'};
  recordInputTrace(trace,store);const saved=store.getItem(INPUT_HISTORY_KEY)!;
  for(const secret of ['private@','SECRET','FULL BOARD'])expect(saved).not.toContain(secret);
  expect(JSON.parse(saved).revision).toBe(INPUT_REVISION);
 });
 it('does not break input when storage is malformed, unavailable or quota limited',()=>{
  for(const raw of ['invalid','null','{}',JSON.stringify({revision:INPUT_REVISION,traces:[null,{},'bad']})])expect(readInputTraces({getItem:()=>raw,setItem:()=>{}})).toEqual([]);
  expect(()=>recordInputTrace(fixture(),{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('quota')}})).not.toThrow();
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied');}});
  try{expect(()=>recordInputTrace(fixture())).not.toThrow();expect(readInputTraces()).toEqual([]);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
  const store=storage();recordInputTrace({...fixture(),at:Date.now()-86400001},store);expect(readInputTraces(store)).toEqual([]);
 });
 it('adds a reviewable report only when requested, preserving the draft and native build number',()=>{
  const draft='왼쪽으로 옮겼는데 다른 방향으로 갔어요.',trace=fixture(),report=appendInputReport(draft,{platform:'ios',version:'1.11',build:'12'},[trace])!;
  expect(report.startsWith(draft+'\n\n')).toBe(true);expect(report).toContain('ios 1.11 (12)');expect(report).toContain(INPUT_REVISION);expect(report.length).toBeLessThanOrEqual(6000);
  expect(appendInputReport(report,{platform:'ios',version:'1.11'},[trace])).toBe(report);
  expect(appendInputReport('x'.repeat(5999),{platform:'ios',version:'1.11'},[trace])).toBeNull();
  expect(appendInputReport(draft,{platform:'ios',version:'1.11'},[])).toBeNull();
 });
});
