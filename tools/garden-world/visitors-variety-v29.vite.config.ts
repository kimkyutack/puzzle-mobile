import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),publicDir:fileURLToPath(new URL('../../apps/client/public',import.meta.url)),plugins:[react()],build:{outDir:fileURLToPath(new URL('../../output/verification/residents-variety-v29/review-build',import.meta.url)),emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('./visitors-variety-v29-static.html',import.meta.url))},chunkSizeWarningLimit:8000}});
