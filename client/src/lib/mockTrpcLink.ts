import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../../server/routers";
import { handleMockTrpcCall } from "./mockBackend";

/**
 * Link tRPC client-side que intercepta TODAS as operações
 * (queries e mutations) e despacha para `handleMockTrpcCall`
 * em vez de fazer requisição HTTP.
 *
 * Útil pra rodar em produção sem backend ativo: tudo persiste
 * em localStorage, login validado contra credenciais hardcoded.
 */
export function createMockTrpcLink(): TRPCLink<AppRouter> {
  return () => {
    return ({ op }) => {
      return observable(observer => {
        // Microtask pra simular async natural
        Promise.resolve()
          .then(() => handleMockTrpcCall(op.path, op.input))
          .then(data => {
            observer.next({ result: { data } });
            observer.complete();
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            const code = (err as { code?: string }).code ?? "INTERNAL_SERVER_ERROR";
            const httpStatus =
              code === "UNAUTHORIZED"
                ? 401
                : code === "FORBIDDEN"
                ? 403
                : code === "NOT_FOUND"
                ? 404
                : 500;

            // Construímos um TRPCClientError compatível com o que o cliente
            // espera ao consumir uma resposta de erro do servidor.
            const tpcError = TRPCClientError.from(
              {
                error: {
                  message,
                  code: -32000,
                  data: {
                    code,
                    httpStatus,
                    path: op.path,
                  },
                },
              } as never,
            );
            observer.error(tpcError);
          });

        return () => {
          /* nada para limpar */
        };
      });
    };
  };
}
