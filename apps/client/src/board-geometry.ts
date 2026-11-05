/** Geometry and clipping only: frame pixels remain the authored game artwork. */
export interface Insets {left:number;right:number;top:number;bottom:number}
export interface FrameAperture {width:number;height:number;inside:Uint8Array;insets:Insets}
export interface BoardGeometry {width:number;height:number;cell:number;face:{x:number;y:number;width:number;height:number};columns:number;rows:number}
export const BOARD_FRAME_SCALE=.18;
export const BOARD_REFERENCE_COLUMNS=9;
const FACE_GAP=2;

/** Select the enclosed transparent opening, excluding the transparent exterior. */
export function enclosedAperture(rgba:ArrayLike<number>,width:number,height:number,threshold=24):FrameAperture{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<3||height<3||rgba.length!==width*height*4)throw new Error('Invalid board frame pixels');
 const start=Math.floor(height/2)*width+Math.floor(width/2),inside=new Uint8Array(width*height),queue=new Uint32Array(width*height);
 if(rgba[start*4+3]!>threshold)throw new Error('Board frame center must be transparent');
 let head=0,tail=1;queue[0]=start;inside[start]=1;
 while(head<tail){const at=queue[head++]!,x=at%width,y=Math.floor(at/width);if(x===0||y===0||x===width-1||y===height-1)throw new Error('Board frame opening is not enclosed');
  for(const next of [at-1,at+1,at-width,at+width])if(!inside[next]&&rgba[next*4+3]!<=threshold){inside[next]=1;queue[tail++]=next;}
 }
 const middleX=Math.floor(width/2),middleY=Math.floor(height/2);let left=middleX,right=middleX,top=middleY,bottom=middleY;
 while(left>0&&inside[middleY*width+left-1])left--;while(right<width-1&&inside[middleY*width+right+1])right++;
 while(top>0&&inside[(top-1)*width+middleX])top--;while(bottom<height-1&&inside[(bottom+1)*width+middleX])bottom++;
 return {width,height,inside,insets:{left,right:width-1-right,top,bottom:height-1-bottom}};
}
export function boardGeometry(width:number,columns:number,rows:number,insets:Insets,scale=BOARD_FRAME_SCALE):BoardGeometry{
 if(!(width>0)||!Number.isSafeInteger(columns)||!Number.isSafeInteger(rows)||columns<1||rows<1)throw new Error('Invalid board geometry');
 const x=insets.left*scale+FACE_GAP,y=insets.top*scale+FACE_GAP,right=insets.right*scale+FACE_GAP,bottom=insets.bottom*scale+FACE_GAP,cell=(width-x-right)/columns;
 if(!(cell>0))throw new Error('Board frame is wider than its board');
 return {width,height:y+rows*cell+bottom,cell,face:{x,y,width:columns*cell,height:rows*cell},columns,rows};
}
/** A seven-column level keeps the same cell pitch as a full nine-column level.
 * Only the rendered board narrows; the canvas is centered by its host. */
export function fittedBoardGeometry(availableWidth:number,columns:number,rows:number,insets:Insets,scale=BOARD_FRAME_SCALE):BoardGeometry{
 const reference=boardGeometry(availableWidth,Math.max(BOARD_REFERENCE_COLUMNS,columns),rows,insets,scale);
 const edges=reference.width-reference.face.width;
 return boardGeometry(edges+columns*reference.cell,columns,rows,insets,scale);
}
export function cellPosition(index:number,geometry:BoardGeometry){return {x:geometry.face.x+(index%geometry.columns+.5)*geometry.cell,y:geometry.face.y+(Math.floor(index/geometry.columns)+.5)*geometry.cell};}
export function cellIndex(point:{x:number;y:number},geometry:BoardGeometry):number|null{
 const {face,cell,columns}=geometry;if(point.x<face.x||point.y<face.y||point.x>=face.x+face.width||point.y>=face.y+face.height)return null;
 return Math.floor((point.y-face.y)/cell)*columns+Math.floor((point.x-face.x)/cell);
}
/** Inverse of the exact edge scale used by Pixi's authored nine-slice frame. */
export function sliceCoordinate(at:number,target:number,source:number,leading:number,trailing:number,scale=BOARD_FRAME_SCALE){
 const first=leading*scale,last=trailing*scale;
 if(first+last>=target)return Math.max(0,Math.min(source-1,at/target*source));
 if(at<first)return at/scale;if(at>=target-last)return source-(target-at)/scale;
 return leading+(at-first)/(target-first-last)*(source-leading-trailing);
}
/** One alpha mask intersects the real frame opening with the level's cell shape.
 * It is an invisible clip, never artwork, and is rebuilt only on geometry changes. */
export function boardClip(geometry:BoardGeometry,exists:readonly boolean[],aperture:FrameAperture|null,slices:Insets,resolution=2){
 if(exists.length!==geometry.columns*geometry.rows)throw new Error('Invalid board cell mask');
 const width=Math.ceil(geometry.width*resolution),height=Math.ceil(geometry.height*resolution),pixels=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const point={x:(x+.5)/resolution,y:(y+.5)/resolution},index=cellIndex(point,geometry);if(index===null||!exists[index])continue;
  if(aperture){const sx=Math.max(0,Math.min(aperture.width-1,Math.floor(sliceCoordinate(point.x,geometry.width,aperture.width,slices.left,slices.right)))),sy=Math.max(0,Math.min(aperture.height-1,Math.floor(sliceCoordinate(point.y,geometry.height,aperture.height,slices.top,slices.bottom))));if(!aperture.inside[sy*aperture.width+sx])continue;}
  const offset=(y*width+x)*4;pixels[offset]=pixels[offset+1]=pixels[offset+2]=pixels[offset+3]=255;
 }
 return {width,height,pixels};
}
