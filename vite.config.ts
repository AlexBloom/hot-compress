import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({root:'web',plugins:[react(),tailwindcss()],resolve:{alias:{'@':path.resolve('web/src')}},build:{outDir:'../web-dist',emptyOutDir:true}});
