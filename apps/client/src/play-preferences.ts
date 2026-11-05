import type {Player} from '@garden/contracts';
export const comfortKeys=['sound','music','haptics'] as const;
type Preferences=Partial<Pick<Player['settings'],typeof comfortKeys[number]>>;
const storageKey=(id:string)=>'cloud-garden-preferences-'+id;
export function pendingPreferences(id:string):Preferences{
 try{const raw=JSON.parse(localStorage.getItem(storageKey(id))||'{}');return Object.fromEntries(comfortKeys.filter(key=>typeof raw[key]==='boolean').map(key=>[key,raw[key]]));}catch{return {};}
}
export function rememberPreferences(id:string,settings:Record<string,unknown>):Preferences{
 const values={...pendingPreferences(id)};
 for(const key of comfortKeys)if(typeof settings[key]==='boolean')values[key]=settings[key];
 localStorage.setItem(storageKey(id),JSON.stringify(values));return values;
}
// Old server profiles and offline preferences may still contain the retired flag.
export function applyPreferences(player:Player):Player{return {...player,settings:{...player.settings,...pendingPreferences(player.id),reducedMotion:false}};}
export function confirmPreferences(id:string,sent:Record<string,unknown>,settings:Player['settings']){
 const current=pendingPreferences(id);
 for(const key of comfortKeys)if(current[key]===sent[key]&&settings[key]===sent[key])delete current[key];
 if(Object.keys(current).length)localStorage.setItem(storageKey(id),JSON.stringify(current));else localStorage.removeItem(storageKey(id));
}
