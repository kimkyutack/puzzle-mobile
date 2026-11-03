import { DurableObject } from 'cloudflare:workers';
import { one, type ApiEnv } from './db';

/** Notification transport only. All chat, inventory and rewards remain in D1. */
export class GuildRoom extends DurableObject<ApiEnv> {
  async fetch(request:Request){
    if(request.headers.get('Upgrade')!=='websocket')return new Response('WebSocket required',{status:426});
    const userId=request.headers.get('x-garden-user');const guildId=request.headers.get('x-garden-guild');
    if(!userId||!guildId||!await one(this.env.DB,'SELECT 1 FROM guild_members WHERE user_id=? AND guild_id=?',userId,guildId))return new Response('Forbidden',{status:403});
    const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],[userId]);pair[1].serializeAttachment({userId,guildId});
    return new Response(null,{status:101,webSocket:pair[0]});
  }
  async broadcast(eventId:string,guildId:string){
    for(const socket of this.ctx.getWebSockets()){
      const a=socket.deserializeAttachment() as {userId:string;guildId:string};
      if(!await one(this.env.DB,'SELECT 1 FROM guild_members WHERE user_id=? AND guild_id=?',a.userId,guildId)){socket.close(1008,'Membership changed');continue;}
      socket.send(JSON.stringify({type:'refresh',eventId}));
    }
    return true;
  }
  webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){if(message==='ping')ws.send('pong');}
  webSocketClose(ws:WebSocket,code:number){ws.close(code);}
  webSocketError(ws:WebSocket){ws.close(1011);}
}
