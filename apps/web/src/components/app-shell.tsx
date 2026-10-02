"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useMe, useLogout } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/project-templates", label: "Templates", icon: LayoutTemplate },
  { href: "/forms", label: "Forms", icon: FileText },
  { href: "/team", label: "Team", icon: Users },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("clientos-theme")) as
      | "light"
      | "dark"
      | null;
    if (saved) setTheme(saved);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("clientos-theme", next);
  }

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
      aria-label="Toggle color theme"
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}

function SidebarContents({
  orgName,
  fullName,
  role,
  onNavigate,
  onSignOut,
}: {
  orgName: string;
  fullName: string;
  role: string;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-semibold text-accent-foreground">
          C
        </div>
        <span className="truncate text-sm font-semibold text-text-primary">{orgName}</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <Avatar name={fullName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-primary">{fullName}</p>
            <p className="truncate text-[11px] text-text-muted">{role.replace(/_/g, " ")}</p>
          </div>
          <ThemeToggle />
          <button
            onClick={onSignOut}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError } = useMe();
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && isError) router.replace("/login");
  }, [isLoading, isError, router]);

  // Close the mobile drawer on every navigation.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background" />;
  }

  if (isError || !me) return null;

  const org = me.memberships[0];
  const signOut = () => logout.mutate(undefined, { onSuccess: () => router.replace("/login") });

  return (
    <div className="flex min-h-screen bg-background md:flex-row">
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <SidebarContents
          orgName={org?.organizationName ?? "ClientOS"}
          fullName={me.fullName}
          role={org?.role ?? ""}
          onSignOut={signOut}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-semibold text-accent-foreground">
            C
          </div>
          <span className="truncate text-sm font-semibold text-text-primary">
            {org?.organizationName ?? "ClientOS"}
          </span>
        </div>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-elevated">
            <div className="flex h-14 items-center justify-end border-b border-border px-3">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary"
                aria-label="Close navigation menu"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <SidebarContents
              orgName={org?.organizationName ?? "ClientOS"}
              fullName={me.fullName}
              role={org?.role ?? ""}
              onNavigate={() => setMobileNavOpen(false)}
              onSignOut={signOut}
            />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
