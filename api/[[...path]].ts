import "dotenv/config";
import { createApp } from "../server/_core/index";

/**
 * Vercel serverless function entrypoint (catch-all).
 *
 * O nome `[[...path]]` cria uma rota dinâmica opcional que captura
 * QUALQUER request a `/api/*` (incluindo `/api` puro). Vercel preserva
 * o path completo em `req.url`, então o Express roteia normalmente
 * para `/api/trpc/...`, `/api/auth/login`, `/api/oauth/callback`.
 *
 * Os assets do client (build do Vite em `dist/public`) são servidos
 * diretamente pela CDN da Vercel — esta função não os toca.
 */
const app = createApp();

export default app;
