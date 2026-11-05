import {mergeConfig} from 'vite';
import base from '../apps/client/vite.config';
export default mergeConfig(base,{define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:5178,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8796',ws:true}}}});
