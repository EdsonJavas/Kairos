import { trpc } from "@/lib/trpc";
import { createMockTrpcLink } from "@/lib/mockTrpcLink";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.message === UNAUTHED_ERR_MSG ||
    (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED";

  if (!isUnauthorized) return;
  if (window.location.pathname === getLoginUrl()) return;
  if (window.location.pathname === "/") return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Em vez de fazer requisição HTTP para /api/trpc, usamos um link em memória
// que despacha cada operação para o mock backend client-side (localStorage).
// Resultado: app funciona em produção sem backend ativo.
const trpcClient = trpc.createClient({
  links: [createMockTrpcLink()],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
