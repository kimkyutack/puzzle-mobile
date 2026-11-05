/** Source-pixel edge dimensions are scaled independently of the stretchable face. */
export function frameScale(id:string,height:number,explicit?:string){
 if(Number(explicit)>0)return Number(explicit);
 if(id.startsWith('button_'))return Math.max(.1,Math.min(.24,height/320));
 return id.startsWith('button_')?.18:id==='bubble'?.24:id==='title_ribbon'?.25:id.startsWith('panel_')?.38:id==='modal_panel'?.38:.24;
}
export function frameBleed(value?:string){return Math.max(0,Number(value)||0)}

/** Closed disclosure bodies can report a positive rect while the DOM hides them. */
export function frameIsVisible(element:Element,root:Element){
 for(let ancestor:Element|null=element;ancestor;ancestor=ancestor.parentElement){
  if(ancestor.hasAttribute('hidden'))return false;
  if(ancestor.tagName==='DETAILS'&&!ancestor.hasAttribute('open')){
   const summary=Array.from(ancestor.children).find(child=>child.tagName==='SUMMARY');
   if(!summary?.contains(element))return false;
  }
  if(ancestor===root)break;
 }
 return true;
}
