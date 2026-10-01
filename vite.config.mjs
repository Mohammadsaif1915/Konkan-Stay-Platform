import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(rootDir, 'index.html'),
        search: resolve(rootDir, 'pages/search.html'),
        login: resolve(rootDir, 'pages/login.html'),
        register: resolve(rootDir, 'pages/register.html'),
        customerDashboard: resolve(rootDir, 'pages/dashboard-customer.html'),
        hostDashboard: resolve(rootDir, 'pages/dashboard-host.html')
      }
    }
  }
});