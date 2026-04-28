import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, GraduationCap, Lock, Mail, Users2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { loginWithCredentials } from "@/lib/mockBackend";
import { trpc } from "@/lib/trpc";

type DemoAccount = {
  label: string;
  role: string;
  email: string;
  password: string;
  icon: typeof Users2;
  description: string;
  accentBg: string;
  accentBorder: string;
  badgeClass: string;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Professor",
    role: "Docente",
    email: "professor@unimar.br",
    password: "professor123",
    icon: Users2,
    description: "Cria e gere eventos no calendário académico. Publica provas, atividades, trabalhos e avisos.",
    accentBg: "rgba(0,114,188,0.22)",
    accentBorder: "rgba(58,190,255,0.30)",
    badgeClass: "bg-sky-700/30 text-sky-200 border-sky-400/25",
  },
  {
    label: "Aluno",
    role: "Estudante",
    email: "aluno@unimar.br",
    password: "aluno123",
    icon: GraduationCap,
    description: "Acompanha o calendário, agenda futura, prioridades e notificações em tempo real.",
    accentBg: "rgba(244,197,66,0.18)",
    accentBorder: "rgba(244,197,66,0.32)",
    badgeClass: "bg-amber-400/18 text-amber-200 border-amber-400/28",
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/app");
    }
  }, [loading, isAuthenticated, setLocation]);

  const doLogin = async (emailVal: string, passwordVal: string) => {
    if (!emailVal.trim() || !passwordVal.trim()) {
      setError("Preencha o e-mail e a palavra-passe.");
      return;
    }

    setSubmitting(true);
    setError("");

    // Login 100% client-side: valida contra credenciais hardcoded e
    // persiste o usuário em localStorage via mockBackend.
    const result = loginWithCredentials(emailVal, passwordVal);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      setActiveCard(null);
      return;
    }

    try {
      // Atualiza imediatamente o cache do auth.me com o user logado para que
      // a navegação subsequente já encontre a sessão sem refetch.
      utils.auth.me.setData(undefined, result.user);
      await utils.auth.me.invalidate();
    } catch {
      /* invalidate é best-effort */
    }

    // Pequeno delay pra dar tempo do estado propagar antes de navegar
    window.setTimeout(() => {
      window.location.href = "/app";
    }, 60);
  };

  const handleSubmit = () => doLogin(email, password);

  const handleQuickAccess = (account: DemoAccount) => {
    setActiveCard(account.label);
    setEmail(account.email);
    setPassword(account.password);
    doLogin(account.email, account.password);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-300/30 border-t-amber-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(0,114,188,0.28),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(244,197,66,0.14),_transparent_30%),linear-gradient(180deg,#050b16,#081324_44%,#07111F)] px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-lg">
        {/* Brand header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-white/10 bg-white/8 text-amber-300 shadow-[0_12px_36px_rgba(244,197,66,0.18)]">
            <BookOpen className="h-7 w-7" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-amber-300/75">Calendário académico inteligente</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Kairos</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/52">
            Calendário académico moderno para professores e alunos
          </p>
        </div>

        {/* Login card */}
        <Card className="overflow-hidden border-white/10 bg-white/6 shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <CardContent className="p-7">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Aceder à plataforma</h2>
              <p className="mt-1 text-sm text-white/52">
                Use as credenciais da sua conta académica institucional.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-400/22 bg-red-500/8 px-4 py-3 text-sm leading-relaxed text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-white/62">E-mail institucional</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="nome@unimar.br"
                    className="h-12 rounded-2xl border-white/10 bg-white/6 pl-11 text-white placeholder:text-white/28 focus-visible:ring-sky-400/40"
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-white/62">Palavra-passe</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="••••••••••••"
                    className="h-12 rounded-2xl border-white/10 bg-white/6 pl-11 text-white placeholder:text-white/28 focus-visible:ring-sky-400/40"
                  />
                </div>
              </label>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-1 h-12 w-full rounded-2xl bg-amber-300 font-semibold text-slate-950 hover:bg-amber-200 disabled:opacity-55"
              >
                {submitting && !activeCard ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                    A autenticar...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Entrar na plataforma
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick access section */}
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/8" />
            <p className="text-xs uppercase tracking-[0.32em] text-white/34">Acesso rápido</p>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map(account => {
              const isLoading = submitting && activeCard === account.label;
              return (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => handleQuickAccess(account)}
                  disabled={submitting}
                  className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-left transition-all hover:border-white/18 hover:bg-white/8 disabled:opacity-55"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${account.accentBorder}`,
                    background: `linear-gradient(145deg, ${account.accentBg}, rgba(255,255,255,0.03))`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/12"
                        style={{ background: account.accentBg }}
                      >
                        {isLoading ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        ) : (
                          <account.icon className="h-5 w-5 text-white/90" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{account.label}</p>
                        <span
                          className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${account.badgeClass}`}
                        >
                          {account.role}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-white/28 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50" />
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-white/52">{account.description}</p>

                  <div className="mt-4 space-y-1.5 rounded-[1.1rem] border border-white/8 bg-black/18 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-white/36">E-mail</span>
                      <span className="font-mono text-xs text-white/72">{account.email}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-white/36">Senha</span>
                      <span className="font-mono text-xs text-white/72">{account.password}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-white/30">
            Estas credenciais são para demonstração local. Não partilhe em ambientes de produção.
          </p>
        </div>
      </div>
    </div>
  );
}
