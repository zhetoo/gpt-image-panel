import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:9090';

export default defineConfig({
  plugins: [
    sveltekit(),
    ...(process.env.ANALYZE ? [visualizer({ filename: 'stats.html', gzipSize: true, open: false })] : [])
  ],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true
      },
      '/health': {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true
      }
    }
  }
});
