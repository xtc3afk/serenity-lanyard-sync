import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Terminal, LayoutDashboard, Heart, Menu, X, LogIn } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/cmds", label: "Commands", icon: Terminal },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/status", label: "Status", icon: Heart },   // ← Added
] as const;


export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-10 flex min-h-screen w-full">
      {/* Sidebar - desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r hairline bg-sidebar/60 backdrop-blur md:flex">
        <SidebarInner path={path} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b hairline bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark /> <span>whimper</span>
        </Link>
        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border hairline p-2 text-muted-foreground hover:text-foreground"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-30 mt-[57px] md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={() => setOpen(false)} />
          <aside className="relative h-[calc(100vh-57px)] w-64 border-r hairline bg-sidebar">
            <SidebarInner path={path} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex min-h-screen w-full flex-col pt-[57px] md:pt-0">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}

function SidebarInner({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="hidden h-16 items-center gap-2 border-b hairline px-5 md:flex">
        <LogoMark />
        <span className="font-semibold tracking-tight">whimper</span>
        <span className="ml-1 text-xs text-muted-foreground">♡</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Navigation
        </div>
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />}
            </Link>
          );
        })}
      </nav>

      <UserBlock />
    </>
  );
}

function UserBlock() {
  const { data } = useMe();
  const user = data?.user;
  return (
    <div className="border-t hairline p-4 space-y-3">
      {user ? (
        <div className="flex items-center gap-3 rounded-lg border hairline bg-surface px-3 py-2">
          <img
            src={user.avatar}
            alt={user.username}
            className="h-8 w-8 rounded-full object-cover"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {user.globalName || user.username}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">@{user.username}</div>
          </div>
        </div>
      ) : (
        <a
          href={api.loginUrl()}
          className="flex items-center justify-center gap-2 rounded-lg border hairline bg-surface px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
        >
          <LogIn className="h-3.5 w-3.5" />
          Login with Discord
        </a>
      )}
      <p className="px-1 text-[10px] text-muted-foreground/70">
        v1.0 · made with <Heart className="inline h-3 w-3" />
      </p>
    </div>
  );
}


export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Whimper"
      className={cn(
        "h-7 w-7 object-contain",
        className
      )}
    />
  );
}

function SiteFooter() {
  return (
    <footer className="border-t hairline bg-background/50">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-foreground">whimper</span>
          <span className="text-muted-foreground/70">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="https://discord.com/users/1264283141619847171" className="hover:text-foreground">Discord</a>
          <a href="https://x.com/360strafing" className="hover:text-foreground">Twitter</a>
          <span className="text-muted-foreground/60">·</span>
          <span>costumery</span>
        </div>
      </div>
    </footer>
  );
}
