type HelpStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const seenKey=(id:string)=>`garden-seen-help-${id}`;
const pendingKey=(id:string)=>`garden-pending-help-${id}`;
function read(storage:HelpStorage,key:string):string[]{
 try{const value:unknown=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(value)?value.filter((entry):entry is string=>typeof entry==='string'&&entry.length>0):[];}catch{return [];}
}
export function pendingHelp(id:string,storage:HelpStorage=localStorage):string[]{return read(storage,pendingKey(id));}
/** Keep the durable local record after acknowledgement; delayed profile responses cannot unlearn a discovery. */
export function knownHelp(id:string,server:readonly string[],storage:HelpStorage=localStorage):string[]{
 return [...new Set([...server,...read(storage,seenKey(id)),...pendingHelp(id,storage)])];
}
export function cacheHelp(id:string,server:readonly string[],storage:HelpStorage=localStorage){storage.setItem(seenKey(id),JSON.stringify(knownHelp(id,server,storage)));}
export function rememberHelp(id:string,features:readonly string[],storage:HelpStorage=localStorage){
 cacheHelp(id,features,storage);storage.setItem(pendingKey(id),JSON.stringify([...new Set([...pendingHelp(id,storage),...features])]));
}
export function completeHelpSync(id:string,sent:readonly string[],storage:HelpStorage=localStorage){
 storage.setItem(pendingKey(id),JSON.stringify(pendingHelp(id,storage).filter(feature=>!sent.includes(feature))));
}
export function resetHelpHistory(id:string,storage:HelpStorage=localStorage){storage.removeItem(seenKey(id));storage.removeItem(pendingKey(id));}
