import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {serveOfficialSite} from '../apps/api/src/official-site';

// Local preview of the same renderer as production. This never calls game or admin APIs.
const port=Number(process.argv[2]??5351);
const host=`http://127.0.0.1:${port}`;
const assets={async fetch(input:RequestInfo|URL){
 const request=input instanceof Request?input:new Request(input);
 const path=new URL(request.url).pathname;
 if(!/^\/official\/media\/[a-z0-9-]+\.(?:webp|mp4)$/.test(path))return new Response(null,{status:404});
 try{
  const content=await readFile(new URL('../apps/admin/public'+path,import.meta.url));
  return new Response(request.method==='HEAD'?null:content,{headers:{'Content-Length':String(content.byteLength)}});
 }catch{return new Response(null,{status:404});}
}};
createServer(async(req,res)=>{
 try{
  const headers=new Headers();
  for(const name of ['range','if-range','if-none-match']){
   const value=req.headers[name];
   if(typeof value==='string')headers.set(name,value);
  }
  const request=new Request(host+(req.url??'/'),{method:req.method,headers});
  const response=await serveOfficialSite(request,assets);
  if(!response){res.writeHead(404).end('Not Found');return;}
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500).end('Preview unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(host+'/official/'));
