import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function appsScriptDevProxy(scriptUrl) {
  return {
    name: 'apps-script-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/apps-script', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.end('Method not allowed');
          return;
        }

        if (!scriptUrl) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'VITE_APPS_SCRIPT_URL is not set.' }));
          return;
        }

        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }

          const upstream = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body,
          });
          const responseBody = await upstream.text();

          res.statusCode = upstream.status;
          res.setHeader(
            'Content-Type',
            upstream.headers.get('content-type') || 'application/json; charset=utf-8',
          );
          res.end(responseBody);
        } catch (error) {
          console.error('Apps Script proxy request failed:', error);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unable to reach Google Apps Script.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), appsScriptDevProxy(env.VITE_APPS_SCRIPT_URL?.trim())],
    server: {
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', 'masculine-carnivore-untidy.ngrok-free.dev'],
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.{js,ts,jsx,tsx}', '__tests__/unit/**/*.test.{js,ts}'],
    },
  };
});
