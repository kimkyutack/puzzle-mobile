/** Bounded on-device input history. No network, player identifiers or board contents. */
export const INPUT_REVISION='touch-v54';
export const INPUT_HISTORY_KEY='cloud-garden-input-history-v1';
export interface DragSample {dx:number;dy:number;axis:'x'|'y'|null;to:number|null}
export interface InputTrace {
 at:number;pointer:string;turn:number;state:string;from:number;tile:string;cell:number;
 viewport:{width:number;height:number;dpr:number};samples:DragSample[];
 release?:DragSample;decision:'swap'|'tap'|'select'|'cancel';reason:string;to:number|null;
 action?:{type:'swap';from:number;to:number}|{type:'tap';at:number}|{type:'booster';item:string;at?:number};
}
type Store=Pick<Storage,'getItem'|'setItem'>;
const storage=()=>{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}};
const round=(n:number)=>Math.round(n*100)/100;
const numeric=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
const safeSample=(value:unknown):DragSample|null=>{
 if(!value||typeof value!=='object')return null;const s=value as DragSample;
 if(!numeric(s.dx)||!numeric(s.dy)||!['x','y',null].includes(s.axis)||s.to!==null&&(!Number.isInteger(s.to)||s.to<0||s.to>1024))return null;
 return {dx:round(Math.max(-100,Math.min(100,s.dx))),dy:round(Math.max(-100,Math.min(100,s.dy))),axis:s.axis,to:s.to};
};
function clean(value:unknown):InputTrace|null {
 if(!value||typeof value!=='object')return null;const t=value as InputTrace;
 if(!numeric(t.at)||!Number.isInteger(t.turn)||!Number.isInteger(t.from)||!numeric(t.cell)||!t.viewport||![t.viewport.width,t.viewport.height,t.viewport.dpr].every(numeric)||!Array.isArray(t.samples)||!['swap','tap','select','cancel'].includes(t.decision))return null;
 if(!['touch','mouse','pen','unknown'].includes(t.pointer)||!['normal','wind-row','wind-column','bomb','glider','rainbow','beehive','seed','empty'].includes(t.tile)||!/^[-a-z]{1,40}$/.test(t.reason)||!/^[a-f0-9]{1,32}$/i.test(t.state))return null;
 if(t.to!==null&&(!Number.isInteger(t.to)||t.to<0||t.to>1024))return null;
 const release=safeSample(t.release),a=t.action,index=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=1024;
 const action:InputTrace['action']=a?.type==='swap'&&index(a.from)&&index(a.to)?{type:'swap',from:a.from,to:a.to}:a?.type==='tap'&&index(a.at)?{type:'tap',at:a.at}:a?.type==='booster'&&/^[-a-z]{1,40}$/.test(a.item)&&(a.at===undefined||index(a.at))?{type:'booster',item:a.item,...(a.at!==undefined?{at:a.at}:{})}:undefined;
 return {at:t.at,pointer:t.pointer,turn:t.turn,state:t.state,from:t.from,tile:t.tile,cell:round(t.cell),viewport:{width:round(t.viewport.width),height:round(t.viewport.height),dpr:round(t.viewport.dpr)},samples:t.samples.slice(-12).map(safeSample).filter((s):s is DragSample=>s!==null),...(release?{release}:{}),decision:t.decision,reason:t.reason,to:t.to,...(action?{action}:{})};
}
export function readInputTraces(store:Store|null=storage()):InputTrace[]{
 try{const raw=store?.getItem(INPUT_HISTORY_KEY);if(!raw||raw.length>65536)return [];const data=JSON.parse(raw);if(data.revision!==INPUT_REVISION||!Array.isArray(data.traces))return [];return data.traces.slice(-24).map(clean).filter((t:InputTrace|null):t is InputTrace=>!!t&&Date.now()-t.at<86400000&&t.at<=Date.now()+60000);}catch{return [];}
}
export function recordInputTrace(trace:InputTrace,store:Store|null=storage()){
 try{const safe=clean(trace);if(safe)store?.setItem(INPUT_HISTORY_KEY,JSON.stringify({revision:INPUT_REVISION,traces:[...readInputTraces(store),safe].slice(-24)}));}catch{/* Storage restrictions must never affect a move. */}
}
export function recordInputAction(at:number,action:InputTrace['action'],store:Store|null=storage()){
 try{const traces=readInputTraces(store),index=traces.map(t=>t.at).lastIndexOf(at);if(index<0)return;const updated=clean({...traces[index],action});if(!updated)return;traces[index]=updated;store?.setItem(INPUT_HISTORY_KEY,JSON.stringify({revision:INPUT_REVISION,traces}));}catch{/* Diagnostics never own the input path. */}
}
/** Keep the first movement and recent direction changes, without per-frame writes. */
export function addDragSample(trace:InputTrace,sample:DragSample){
 const safe=safeSample(sample);if(!safe)return;
 if(trace.samples.length>=12)trace.samples.splice(1,1);trace.samples.push(safe);
}
/** The player explicitly adds this text to a draft and reviews it before sending. */
export function appendInputReport(body:string,release:{platform:string;version:string;build?:string},traces=readInputTraces(),limit=6000):string|null{
 if(body.includes('[Puzzle input '))return body;
 const header=`[Puzzle input ${INPUT_REVISION} / ${release.platform.slice(0,12)} ${release.version.slice(0,40)}${release.build?' ('+release.build.slice(0,20)+')':''}]`;
 const lines:string[]=[];let length=header.length+2;
 for(const value of traces.slice(-6).reverse()){
  const trace=clean(value);if(!trace)continue;const line=JSON.stringify(trace);
  if(length+line.length+1>Math.min(3200,limit-body.length-2))break;
  lines.unshift(line);length+=line.length+1;
 }
 return lines.length?body+'\n\n'+header+'\n'+lines.join('\n'):null;
}
