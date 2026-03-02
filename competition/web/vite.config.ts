import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const basePath = '/chess-competition/competition/';

// Base path for GitHub Pages: /<repo-name>/competition/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-bots-with-base-path',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const botsPrefix = basePath + 'bots/';
          if (req.url?.startsWith(botsPrefix)) {
            const file = req.url.slice(botsPrefix.length).split('?')[0];
            const botPath = path.join(process.cwd(), 'public', 'bots', file);
            if (fs.existsSync(botPath)) {
              const ext = path.extname(file);
              if (ext === '.js') res.setHeader('Content-Type', 'application/javascript');
              else if (ext === '.wasm') res.setHeader('Content-Type', 'application/wasm');
              res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
              return res.end(fs.readFileSync(botPath));
            }
          }
          next();
        });
      },
      writeBundle(_, bundle) {
        const outDir = path.join(process.cwd(), 'dist');
        const botsSrc = path.join(process.cwd(), 'public', 'bots');
        const botsDest = path.join(outDir, 'chess-competition', 'competition', 'bots');
        if (fs.existsSync(botsSrc)) {
          fs.mkdirSync(botsDest, { recursive: true });
          for (const name of fs.readdirSync(botsSrc)) {
            fs.copyFileSync(path.join(botsSrc, name), path.join(botsDest, name));
          }
        }
      },
    },
  ],
  base: basePath,
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
