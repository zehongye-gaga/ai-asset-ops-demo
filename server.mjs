import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 8080);
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');

app.get('/healthz', (_request, response) => {
  response.json({ status: 'ok', service: 'ai-asset-ops-demo' });
});

app.get('/config.js', (_request, response) => {
  response
    .type('application/javascript')
    .set('Cache-Control', 'no-store')
    .send(
      `window.__APP_CONFIG__=${JSON.stringify({
        insforgeBaseUrl: process.env.INSFORGE_BASE_URL || '',
        insforgeAnonKey: process.env.INSFORGE_ANON_KEY || '',
      })};`,
    );
});

app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('*path', (_request, response) => response.sendFile(path.join(dist, 'index.html')));

app.listen(port, '0.0.0.0', () => {
  console.log(`AI asset operations demo listening on ${port}`);
});
