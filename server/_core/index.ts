import "dotenv/config";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

type DevAccount = {
  email: string;
  password: string;
  openId: string;
  name: string;
  role: "professor" | "student";
};

const DEV_ACCOUNTS: DevAccount[] = [
  {
    email: "professor@unimar.br",
    password: "professor123",
    openId: "dev-professor-unimar-001",
    name: "Prof. Demo",
    role: "professor",
  },
  {
    email: "aluno@unimar.br",
    password: "aluno123",
    openId: "dev-aluno-unimar-001",
    name: "Aluno Demo",
    role: "student",
  },
];

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Constrói o app Express com todas as rotas comuns:
 * OAuth, tRPC API, login por credenciais.
 *
 * Isolado em função para que possa ser reutilizado tanto pelo
 * servidor local (`startServer`) quanto pelo entrypoint serverless
 * da Vercel (`api/index.ts`).
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Credential-based login (pre-registered demo accounts)
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    const account = DEV_ACCOUNTS.find(
      a => a.email === email && a.password === password,
    );

    if (!account) {
      res.status(401).json({ error: "Credenciais inválidas. Verifique os dados e tente novamente." });
      return;
    }

    try {
      await upsertUser({
        openId: account.openId,
        name: account.name,
        email: account.email,
        role: account.role,
        loginMethod: "credentials",
        lastSignedIn: new Date(),
      });

      const token = await sdk.createSessionToken(account.openId, { name: account.name });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (err) {
      console.error("[Login] Error:", err);
      res.status(500).json({
        error: "Não foi possível criar a sessão. Verifique se DATABASE_URL e JWT_SECRET estão configurados no ficheiro .env.",
      });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const server: Server = createServer(app);

  // Em desenvolvimento usa Vite middleware; em produção (build local com `npm start`)
  // serve estáticos. No deploy Vercel, esta função NÃO roda — o app é servido por
  // `api/index.ts` e os estáticos pela CDN.
  const { setupVite, serveStatic } = await import("./vite");
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// Só inicia o servidor quando executado diretamente (dev/start), nunca em ambiente serverless.
if (!process.env.VERCEL) {
  startServer().catch(console.error);
}
