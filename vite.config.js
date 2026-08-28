import { defineConfig } from 'vite';

// Vite serves client/ in development and builds it to client/dist for Express to serve in
// production. Socket.IO traffic is proxied through to the Express process on 3001 so the dev
// client talks to exactly the same server it will in production.
export default defineConfig({
    root: 'client',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/socket.io': {
                // Follows PORT so the proxy and the Express process cannot disagree.
                target: `http://localhost:${process.env.PORT ?? 3001}`,
                ws: true,
            },
        },
    },
});
