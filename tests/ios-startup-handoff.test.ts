import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect} from 'vitest';

// Execute the exact script injected by the native controller, not a test copy.
const swift=readFileSync(new URL('../ios/App/App/SceneDelegate.swift',import.meta.url),'utf8');
const script=swift.match(/private static let firstFrameScript = """\n([\s\S]*?)\n    """/)![1]!;
type Visual={complete?:boolean;naturalWidth?:number;decode?:()=>Promise<void>;hidden?:boolean;textContent:string;getBoundingClientRect:()=>{width:number;height:number}};
const visual=(extra:Partial<Visual>={}):Visual=>({textContent:'불러오는 중…',getBoundingClientRect:()=>({width:390,height:844}),...extra});
function fixture(initial:Visual|null,content:Visual|null=null,hidden=false){
 const root={poster:initial,content,querySelector(selector:string){return selector.startsWith('.app-splash')?this.poster:this.content;}};
 const listeners=new Map<string,Set<()=>void>>(),frames:Array<()=>void>=[],messages:string[]=[];
 let changed=()=>{},disconnected=false;
 const document={hidden,documentElement:{},getElementById:(id:string)=>id==='root'?root:null,
  addEventListener:(name:string,fn:()=>void)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(fn);},
  removeEventListener:(name:string,fn:()=>void)=>{listeners.get(name)?.delete(fn);}};
 class Observer {constructor(fn:()=>void){changed=fn;}observe(){}disconnect(){disconnected=true;}}
 runInNewContext(script,{document,window:{webkit:{messageHandlers:{gardenStartupReady:{postMessage:(body:string)=>messages.push(body)}}}},
  MutationObserver:Observer,requestAnimationFrame:(fn:()=>void)=>frames.push(fn),getComputedStyle:(node:Visual)=>({display:node.hidden?'none':'block',visibility:'visible',opacity:'1'})});
 return {root,document,messages,frame:()=>frames.splice(0).forEach(fn=>fn()),
  event:(name:string)=>listeners.get(name)?.forEach(fn=>fn()),mutate:()=>{if(!disconnected)changed();}};
}
async function decoded(){await Promise.resolve();await Promise.resolve();}

describe('iOS launch poster handoff',()=>{
 it('keeps the native poster until image decoding and two rendered frames',async()=>{
  let resolve!:()=>void;
  const image=visual({complete:true,naturalWidth:1080,decode:()=>new Promise<void>(done=>{resolve=done;})});
  const f=fixture(image);f.frame();f.frame();expect(f.messages).toEqual([]);
  resolve();await decoded();f.frame();expect(f.messages).toEqual([]);
  f.frame();expect(f.messages).toEqual(['first-frame-ready']);
 });
 it('waits for a slow local poster load instead of revealing an empty blue frame',async()=>{
  const image=visual({complete:false,naturalWidth:0,decode:()=>Promise.resolve()});
  const f=fixture(image);f.frame();f.frame();expect(f.messages).toEqual([]);
  image.complete=true;image.naturalWidth=1080;f.event('load');await decoded();f.frame();f.frame();
  expect(f.messages).toEqual(['first-frame-ready']);
 });
 it('rechecks the live React screen when the initial HTML poster is replaced between frames',async()=>{
  const f=fixture(visual({complete:true,naturalWidth:1080,decode:()=>Promise.resolve()}));
  await decoded();f.frame();
  const replacement=visual({complete:false,naturalWidth:0,decode:()=>Promise.resolve()});f.root.poster=replacement;f.mutate();
  f.frame();expect(f.messages).toEqual([]);
  replacement.complete=true;replacement.naturalWidth=1080;f.event('load');await decoded();f.frame();f.frame();
  expect(f.messages).toEqual(['first-frame-ready']);
 });
 it('waits while backgrounded and resumes the handoff when the document becomes visible',async()=>{
  const f=fixture(visual({complete:true,naturalWidth:1080,decode:()=>Promise.resolve()}),null,true);
  await decoded();f.frame();f.frame();expect(f.messages).toEqual([]);
  f.document.hidden=false;f.event('visibilitychange');await decoded();f.frame();f.frame();expect(f.messages).toHaveLength(1);
 });
 it('does not hide an actionable retry or admission screen if its poster failed to load',()=>{
  const f=fixture(visual({complete:true,naturalWidth:0}),visual());f.frame();f.frame();expect(f.messages).toHaveLength(1);
 });
 it('also releases an actionable screen after a failed decode',async()=>{
  const f=fixture(visual({complete:true,naturalWidth:1080,decode:()=>Promise.reject(Error('decode failed'))}),visual());
  await decoded();f.frame();f.frame();expect(f.messages).toHaveLength(1);
 });
 it('never announces a blank root and sends the readiness message only once',async()=>{
  const f=fixture(null);f.frame();f.frame();expect(f.messages).toEqual([]);
  f.root.poster=visual({complete:true,naturalWidth:1080,decode:()=>Promise.resolve()});f.mutate();await decoded();f.frame();f.frame();
  f.event('load');f.event('visibilitychange');f.mutate();f.frame();f.frame();expect(f.messages).toEqual(['first-frame-ready']);
 });
});
