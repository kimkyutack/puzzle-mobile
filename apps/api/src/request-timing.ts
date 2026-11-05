/** Request-scoped only: never retain a binding or a player's data between requests. */
export function requestTiming(source:D1Database){
 let calls=0,dbMs=0,region='';const start=performance.now();
 const originals=new WeakMap<D1PreparedStatement,D1PreparedStatement>();
 function metadata(value:unknown){
  if(Array.isArray(value)){value.forEach(metadata);return;}
  if(!value||typeof value!=='object'||!('meta' in value))return;
  const meta=value.meta;if(meta&&typeof meta==='object'&&'served_by_region' in meta&&typeof meta.served_by_region==='string')region=meta.served_by_region;
 }
 async function measured<T>(work:()=>Promise<T>):Promise<T>{
  calls++;const before=performance.now();try{const result=await work();metadata(result);return result;}finally{dbMs+=performance.now()-before;}
 }
 function statement(raw:D1PreparedStatement):D1PreparedStatement{
  const wrapped=new Proxy(raw,{get(target,property){
   if(property==='bind')return (...args:unknown[])=>statement(target.bind(...args));
   const value=Reflect.get(target,property,target);
   if(typeof value!=='function')return value;
   if(['first','all','run','raw'].includes(String(property)))return (...args:unknown[])=>measured(()=>Promise.resolve(Reflect.apply(value,target,args)));
   return value.bind(target);
  }});originals.set(wrapped,raw);return wrapped;
 }
 const db=new Proxy(source,{get(target,property){
  if(property==='prepare')return (query:string)=>statement(target.prepare(query));
  if(property==='batch')return <T>(items:D1PreparedStatement[])=>measured(()=>target.batch<T>(items.map(item=>originals.get(item)??item)));
  if(property==='exec')return (query:string)=>measured(()=>target.exec(query));
  const value=Reflect.get(target,property,target);return typeof value==='function'?value.bind(target):value;
 }});
 return {db,snapshot:()=>({appMs:Math.round((performance.now()-start)*10)/10,dbMs:Math.round(dbMs*10)/10,dbCalls:calls,region})};
}
