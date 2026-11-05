import {tr} from "./i18n";
/** Retain a command ID through an ambiguous network result, including a page reload. */
export function pendingMutation(userId:string,path:string,body:Record<string,unknown>,method='POST'){
 const storageKey=`garden-pending-mutations-${userId}`;
 const signature=JSON.stringify([method,path,body]);
 const read=():Record<string,string>=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{return {}}};
 const pending=read();
 if(!pending[signature]){if(Object.keys(pending).length>=32)throw new Error(tr("확인 중인 요청이 많아요. 연결을 복구한 뒤 다시 시도해 주세요."));pending[signature]=crypto.randomUUID();localStorage.setItem(storageKey,JSON.stringify(pending));}
 const id=pending[signature]!;
 return {id,complete(){const latest=read();if(latest[signature]===id){delete latest[signature];localStorage.setItem(storageKey,JSON.stringify(latest));}}};
}
