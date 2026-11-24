/** Let the browser present the current frame before doing synchronous disk work. */
export function deferredWrite(write:()=>void){
 let frame:number|undefined,timer:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,pending=false;
 function cancel(){
  if(frame!==undefined)cancelAnimationFrame(frame);
  if(timer!==undefined)clearTimeout(timer);
  if(deadline!==undefined)clearTimeout(deadline);
  frame=undefined;timer=undefined;deadline=undefined;pending=false;
 }
 function flush(){const needed=pending;cancel();if(needed)write();}
 return {
  schedule(){
   if(pending)return;
   pending=true;
   frame=requestAnimationFrame(()=>{frame=undefined;timer=setTimeout(flush,0);});
   // A hidden WebView may stop animation frames before delivering its lifecycle event.
   deadline=setTimeout(flush,100);
  },
  flush,cancel,
 };
}
