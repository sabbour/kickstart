import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

function getShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GITHUB_SHA?.substring(0, 7) || 'dev';
  }
}

function getFullSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GITHUB_SHA || 'dev';
  }
}

const shortSha = getShortSha();
const fullSha = getFullSha();

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_VERSION__: JSON.stringify(`${rootPkg.version}-${shortSha}`),
    __BUILD_SHA__: JSON.stringify(shortSha),
    __BUILD_SHA_FULL__: JSON.stringify(fullSha),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  json: {
    stringify: true,
  },
});
