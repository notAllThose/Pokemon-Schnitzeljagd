import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Der relative Buildpfad hält die PWA auch in Unterordnern lauffähig.
  // Vite braucht im Entwicklungsmodus dagegen einen Root-Pfad für /.
  base: command === 'serve' ? '/' : './',
  server: {
    host: '0.0.0.0',
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  plugins: [{
    name: 'serve-app-at-root',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/') request.url = '/index.html';
        next();
      });
    },
  }],
}));
