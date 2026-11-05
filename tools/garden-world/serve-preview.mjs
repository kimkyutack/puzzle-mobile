import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('output/garden-world-preview');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(request,response)=>{
 if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
 try{
  const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/garden-world.html':path));
  if(!file.startsWith(root+sep))throw new Error('Outside root');
  const info=await stat(file);if(!info.isFile())throw new Error('Not a file');
  response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  response.end(request.method==='HEAD'?undefined:await readFile(file));
 }catch{response.writeHead(404);response.end('Not found');}
});
server.listen(5192,'127.0.0.1',()=>console.log('Garden preview: http://127.0.0.1:5192/ (sample garden only; no API routes)'));
