export interface SliceInsets {left:number;right:number;top:number;bottom:number}
/** One integer pixel grid for all nine pieces: fractional CSS scaling cannot
 * open transparent seams between independently composited border-image parts. */
export function rasterSlices(sourceWidth:number,sourceHeight:number,width:number,height:number,insets:SliceInsets,scale:number,density:number){
 const w=Math.max(1,Math.round(width*density)),h=Math.max(1,Math.round(height*density));
 const safe=Math.min(scale,width/(insets.left+insets.right),height/(insets.top+insets.bottom));
 const x=[0,Math.round(insets.left*safe*density),w-Math.round(insets.right*safe*density),w];
 const y=[0,Math.round(insets.top*safe*density),h-Math.round(insets.bottom*safe*density),h];
 // Opposite rounded edges may otherwise overlap by one pixel on tiny odd sizes.
 x[2]=Math.max(x[1]!,x[2]!);y[2]=Math.max(y[1]!,y[2]!);
 const sx=[0,insets.left,sourceWidth-insets.right,sourceWidth],sy=[0,insets.top,sourceHeight-insets.bottom,sourceHeight];
 const slices=[];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const dw=x[col+1]!-x[col]!,dh=y[row+1]!-y[row]!;
  if(dw>0&&dh>0)slices.push({sx:sx[col]!,sy:sy[row]!,sw:sx[col+1]!-sx[col]!,sh:sy[row+1]!-sy[row]!,dx:x[col]!,dy:y[row]!,dw,dh});
 }
 return {width:w,height:h,slices};
}
