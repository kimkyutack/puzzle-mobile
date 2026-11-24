import type {LoadedArt} from './assets';
interface Rect {x:number;y:number;width:number;height:number}
/** Small authored raster glints stay within the exclusive pavilion's silhouette. */
export function paintInvitationStarlight(ctx:CanvasRenderingContext2D,art:LoadedArt|undefined,rect:Rect,time:number,reducedMotion=false){
 if(!art)return;
 const anchors=[[.5,.12],[.32,.32],[.69,.36],[.5,.57],[.49,.79]] as const;
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const [index,[x,y]]of anchors.entries()){
  const phase=reducedMotion ? .5 : (Math.sin(time*.0017+index*1.8)+1)/2;
  const size=rect.width*(.055+phase*.045);
  ctx.globalAlpha=.24+phase*.5;
  ctx.drawImage(art.image,rect.x+rect.width*x-size/2,rect.y+rect.height*y-size/2,size,size);
 }
 ctx.restore();
}
