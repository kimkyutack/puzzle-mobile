import { Capacitor } from '@capacitor/core';
import {apiBase,sessionStorageKey} from '../api-endpoint';
export interface Tokens {accessToken:string;refreshToken:string}
const KEY=sessionStorageKey(apiBase);
let writes:Promise<unknown>=Promise.resolve();
function write<T>(work:()=>Promise<T>){const result=writes.then(work,work);writes=result.catch(()=>{});return result;}
function parse(value:string|null):Tokens|null {
  if(!value) return null;
  try {const data:unknown=JSON.parse(value); if(data&&typeof data==='object'&&'accessToken'in data&&'refreshToken'in data&&typeof data.accessToken==='string'&&typeof data.refreshToken==='string') return {accessToken:data.accessToken,refreshToken:data.refreshToken};}catch{/* invalid local cache */}
  return null;
}
export const tokenStorage = {
  async get():Promise<Tokens|null> {
    await writes;
    if(!Capacitor.isNativePlatform()) return parse(localStorage.getItem(KEY));
    const {SecureStoragePlugin}=await import('capacitor-secure-storage-plugin');
    // Check keys so missing entries are distinct from keystore failures.
    const keys=await SecureStoragePlugin.keys();
    if(!keys.value.includes(KEY)) return null;
    return parse((await SecureStoragePlugin.get({key:KEY})).value);
  },
  set(tokens:Tokens):Promise<void> {return write(async()=>{
    const value=JSON.stringify({accessToken:tokens.accessToken,refreshToken:tokens.refreshToken});
    if(!Capacitor.isNativePlatform()){localStorage.setItem(KEY,value);return;}
    const {SecureStoragePlugin}=await import('capacitor-secure-storage-plugin');
    await SecureStoragePlugin.set({key:KEY,value});
  });},
  clear():Promise<void> {return write(async()=>{
    if(!Capacitor.isNativePlatform()){localStorage.removeItem(KEY);return;}
    const {SecureStoragePlugin}=await import('capacitor-secure-storage-plugin');
    const keys=await SecureStoragePlugin.keys();
    if(keys.value.includes(KEY)) await SecureStoragePlugin.remove({key:KEY});
  });},
};
