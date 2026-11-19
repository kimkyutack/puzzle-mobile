import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/admin/',plugins:[react()],server:{host:'127.0.0.1',port:5220,proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:true,headers:{Origin:'http://127.0.0.1:8798'}}}},build:{outDir:'dist',emptyOutDir:true}});
