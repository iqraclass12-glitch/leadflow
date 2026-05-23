import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { LayoutDashboard, Users, LogOut, Loader2, Moon, Sun, ShieldCheck, History, GraduationCap, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={
        compact
          ? "text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
          : "w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-accent rounded-md"
      }
    >
      <Icon className={compact ? "size-3.5" : "size-4"} />
      {!compact && (theme === "dark" ? "Light mode" : "Dark mode")}
    </button>
  );
}

function AuthLayout() {
  const { user, loading, signOut, role, profileName, isAdmin } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/leads", label: "Leads", icon: Users },
    { to: "/history", label: "History", icon: History },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r bg-card">
        <div className="px-5 py-5 border-b">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="size-4" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">SAPE Education Fair</div>
              <div className="text-xs text-muted-foreground">Admissions CRM</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((it) => {
            const Icon = it.icon;
            const active = loc.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="size-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-3 py-3 space-y-1">
          <div className="px-2 py-1.5">
            <div className="text-sm font-medium truncate">{profileName ?? user.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{role}</div>
          </div>
          <ThemeToggle />
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-accent rounded-md"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-card border-b flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <GraduationCap className="size-4" />
          </div>
          <span className="font-semibold text-sm">SAPE Education Fair</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          <button onClick={() => signOut()} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </div>

      <main className="flex-1 md:ml-0 pt-14 md:pt-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t flex z-40">
        {navItems.map((it) => {
          const Icon = it.icon;
          const active = loc.pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex-1 py-2.5 flex flex-col items-center text-[11px] gap-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
