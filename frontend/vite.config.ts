import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      VitePWA({
        // Let the plugin generate the SW for us (no custom file)
        strategies: 'generateSW',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
        },
        devOptions: { enabled: true },
        manifest: {
          name: 'InvoiceMe',
          short_name: 'InvoiceMe',
          start_url: '/',
          display: 'standalone',
          background_color: '#111827',
          theme_color: '#111827',
          icons: [
            { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:4000',
          changeOrigin: true
        }
      }
    }
  };
});
