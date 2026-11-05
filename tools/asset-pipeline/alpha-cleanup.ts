import sharp from 'sharp';
/** Remove tiny detached generation specks, retaining the object, meaningful
 * detached details and their antialiasing. Sources remain untouched. */
export async function cleanAlphaIslands(input:Buffer,options:{singleObject?:boolean}={}){
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,n=w*h,visited=new Uint8Array(n),queue=new Int32Array(n),parts:Int32Array[]=[];let largest=0;
 for(let start=0;start<n;start++){
  if(visited[start]||data[start*4+3]!<16)continue;
  let head=0,tail=1;queue[0]=start;visited[start]=1;
  while(head<tail){const at=queue[head++]!,x=at%w;for(const next of [x?at-1:-1,x<w-1?at+1:-1,at-w,at+w]){if(next<0||next>=n||visited[next]||data[next*4+3]!<16)continue;visited[next]=1;queue[tail++]=next;}}
  parts.push(queue.slice(0,tail));largest=Math.max(largest,tail);
 }
 const keep=new Uint8Array(n),minimum=Math.max(64,Math.floor(largest*.003));
 for(const part of parts){if(part.length<(options.singleObject?largest:minimum))continue;for(const at of part){const x=at%w,y=Math.floor(at/w);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h)keep[ny*w+nx]=1;}}}
 let removed=0;for(let at=0;at<n;at++){if(!keep[at]&&data[at*4+3]){data[at*4+3]=0;removed++;}}
 return {buffer:await sharp(data,{raw:info}).png().toBuffer(),removed};
}
