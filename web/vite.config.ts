import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const coverage = process.env.COCKPIT_COVERAGE === '1';
const rawCoverage = resolve(import.meta.dirname, '../.cache/coverage/frontend/raw');

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  plugins: [tailwindcss(), ...(coverage ? [istanbul({ include: 'src/**/*', extension: ['.ts', '.tsx'], forceBuildInstrument: true,
    onCover(filename, data) { mkdirSync(rawCoverage, { recursive: true }); writeFileSync(resolve(rawCoverage, 'seed-' + basename(filename) + '.json'), JSON.stringify({ [filename]: data })); }
  })] : [])],
  build: { outDir: '../src/Cockpit.Web/wwwroot', emptyOutDir: true, sourcemap: coverage },
  server: { proxy: {
    '/api': 'http://127.0.0.1:5080',
    '/hubs': { target: 'http://127.0.0.1:5080', ws: true },
    '/health': 'http://127.0.0.1:5080'
  } }
});
