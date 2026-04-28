import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { LogOut, Menu, PanelLeft, Sparkles, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type DashboardMenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: string;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
  menuItems: DashboardMenuItem[];
  title: string;
  subtitle: string;
  headerActions?: React.ReactNode;
};

const COLLAPSED_KEY = "sidebar-collapsed";
const SIDEBAR_EXPANDED_W = 216;
const SIDEBAR_COLLAPSED_W = 64;

const roleLabelMap = {
  student: "Aluno",
  professor: "Professor",
  admin: "Coordenação",
} as const;

export default function DashboardLayout({
  children,
  menuItems,
  title,
  subtitle,
  headerActions,
}: DashboardLayoutProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    window.location.href = "/login";
    return <DashboardLayoutSkeleton />;
  }

  return (
    <DashboardLayoutContent
      menuItems={menuItems}
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
    >
      {children}
    </DashboardLayoutContent>
  );
}

function DashboardLayoutContent({
  children,
  menuItems,
  title,
  subtitle,
  headerActions,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, isCollapsed ? "true" : "false"); } catch {}
  }, [isCollapsed]);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const activeMenuItem = useMemo(
    () => menuItems.find(item => item.path === location) ?? menuItems[0],
    [location, menuItems],
  );

  const sidebarW = isCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;
  const NAV_H = 78;

  const textCls = isCollapsed
    ? "max-w-0 opacity-0 overflow-hidden"
    : "max-w-[160px] opacity-100";
  const textTransition = "transition-[max-width,opacity] duration-150 ease-out whitespace-nowrap";

  return (
    <div className="flex min-h-screen flex-col">

      {/* ── GLOBAL NAVBAR ── */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-[78px] items-center border-b border-white/[0.06] bg-[#060c17]/85 backdrop-blur-2xl">
        <div
          className="flex h-full shrink-0 items-center px-5 transition-[width] duration-150 ease-out"
          style={{ width: isMobile ? "auto" : sidebarW }}
        >
          {isMobile && (
            <button type="button" onClick={() => setMobileOpen(o => !o)} className="mr-3 text-white/50 hover:text-white/80">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/14 ring-1 ring-amber-300/25">
            <Sparkles className="h-[18px] w-[18px] text-amber-300" strokeWidth={2.2} />
          </div>
          <span className={cn("ml-3 text-[15px] font-semibold tracking-tight text-white/85", textCls, textTransition)}>
            Kairos
          </span>
        </div>
        <div className="flex flex-1 items-center justify-between gap-4 px-5">
          <h1 className="truncate text-[15px] font-semibold text-white/85">{activeMenuItem?.label ?? title}</h1>
          <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1" style={{ paddingTop: NAV_H }}>

        {/* ── SIDEBAR ── */}
        {!isMobile && (
          <aside
            className="fixed bottom-0 left-0 z-30 border-r border-white/[0.06] bg-[#060c17]/90 backdrop-blur-2xl transition-[width] duration-150 ease-out"
            style={{ top: NAV_H, width: sidebarW }}
          >
            <div className="flex h-full flex-col">

              {/* Toggle */}
              <div className="shrink-0 border-b border-white/[0.06] px-2 py-2">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(c => !c)}
                  title={isCollapsed ? "Expandir navegação" : "Recolher navegação"}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70"
                >
                  <PanelLeft className={cn("h-5 w-5 shrink-0 transition-transform duration-150", isCollapsed && "rotate-180")} strokeWidth={1.8} />
                  <span className={cn("text-[13px] font-medium", textCls, textTransition)}>Recolher</span>
                </button>
              </div>

              {/* Nav */}
              <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3">
                <div className="flex flex-col gap-1">
                  {menuItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        title={isCollapsed ? item.label : undefined}
                        onClick={() => setLocation(item.path)}
                        className={cn(
                          "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-3 transition-colors duration-100",
                          isActive
                            ? "bg-amber-400/12 text-white"
                            : "text-white/50 hover:bg-white/[0.05] hover:text-white/85",
                        )}
                      >
                        <item.icon
                          className={cn("h-5 w-5 shrink-0", isActive ? "text-amber-300" : "text-white/48 group-hover:text-white/72")}
                          strokeWidth={isActive ? 2.4 : 1.8}
                        />
                        <span className={cn(
                          "text-[14px]",
                          isActive ? "font-semibold" : "font-medium",
                          textCls, textTransition,
                        )}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold tabular-nums leading-none text-white shadow-[0_2px_6px_rgba(14,165,233,0.4)]",
                            textCls, textTransition,
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Footer */}
              <div className="shrink-0 border-t border-white/[0.06] px-2 py-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title={isCollapsed ? (user?.name ?? "Utilizador") : undefined}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
                    >
                      <Avatar className="h-8 w-8 shrink-0 border border-white/15 bg-gradient-to-br from-sky-700 to-sky-950">
                        <AvatarFallback className="bg-transparent text-[11px] font-bold text-white">
                          {user?.name?.charAt(0).toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("min-w-0 text-left", textCls, textTransition)}>
                        <p className="truncate text-[12px] font-semibold text-white/80">{user?.name || "Utilizador"}</p>
                        <p className="truncate text-[10px] text-white/35">{roleLabelMap[user?.role ?? "student"]}</p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side={isCollapsed ? "right" : "top"}
                    align={isCollapsed ? "start" : "end"}
                    className="w-44 border-white/8 bg-[#0a1120] text-white"
                  >
                    <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-white/70 focus:bg-white/8 focus:text-white">
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="text-[13px]">Terminar sessão</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </aside>
        )}

        {/* Mobile drawer */}
        {isMobile && mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" style={{ top: NAV_H }} onClick={() => setMobileOpen(false)} />
            <aside className="fixed bottom-0 left-0 z-50 w-52 border-r border-white/[0.06] bg-[#060c17]/98 backdrop-blur-2xl" style={{ top: NAV_H }}>
              <nav className="flex flex-col gap-1 p-2">
                {menuItems.map(item => {
                  const isActive = location === item.path;
                  return (
                    <button key={item.path} type="button" onClick={() => setLocation(item.path)}
                      className={cn("flex items-center gap-2.5 rounded-xl px-3 py-3 transition-colors", isActive ? "bg-amber-400/12 text-white" : "text-white/50 hover:bg-white/[0.05]")}>
                      <item.icon className={cn("h-5 w-5", isActive ? "text-amber-300" : "text-white/48")} strokeWidth={isActive ? 2.4 : 1.8} />
                      <span className={cn("text-[14px]", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main content */}
        <main
          className="flex-1 bg-[radial-gradient(circle_at_top_left,_rgba(0,114,188,0.15),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(244,197,66,0.12),_transparent_24%),linear-gradient(180deg,rgba(8,16,28,0.96),rgba(7,17,31,1))] p-4 transition-[margin] duration-150 ease-out md:p-5"
          style={{ marginLeft: isMobile ? 0 : sidebarW }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
