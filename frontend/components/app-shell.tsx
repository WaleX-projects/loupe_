"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
  Boxes,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  FolderKanban,
  Home,
  LayoutTemplate,
  LogOut,
  Menu,
  PanelLeft,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react"

import { AuthGuard } from "@/components/auth-guard"
import { getCurrentUser, signOut } from "@/lib/auth"

export const APP_NAME = "Buildly" // change me

const nav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Projects", href: "/project", icon: FolderKanban },
  { label: "Artifacts", href: "/artifacts", icon: Boxes },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
]

const secondary = [
  { label: "Docs", href: "/docs", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
]

// replace with GET /projects/ (latest 4)
const recent = [
  { id: "p_brewline", name: "Brewline", dot: "bg-indigo-400 animate-pulse" },
  { id: "p_gradeflow", name: "GradeFlow", dot: "bg-emerald-400" },
  { id: "p_trackr", name: "Trackr", dot: "bg-emerald-400" },
  { id: "p_snapdrive", name: "SnapDrive", dot: "bg-red-400" },
]

export const dotGrid = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
}

type Crumb = { label: string; href?: string }

export function AppShell({
  crumbs,
  actions,
  children,
}: {
  crumbs: Crumb[]
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [user, setUser] = React.useState({ name: "Account", email: "" })

  // signed-in user for the account row
  React.useEffect(() => {
    getCurrentUser()
      .then((u) => setUser({ name: u.email.split("@")[0] ?? "Account", email: u.email }))
      .catch(() => {})
  }, [])

  // restore collapsed state
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar:collapsed") === "1")
    } catch {}
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar:collapsed", c ? "0" : "1")
      } catch {}
      return !c
    })
  }, [])

  // Cmd/Ctrl + B
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleCollapsed])

  // close mobile drawer on navigation
  React.useEffect(() => setMobileOpen(false), [pathname])

  // close user menu on outside click / Escape
  React.useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  // "New project" focuses the composer on the dashboard, or goes there first
  const newProject = () => {
    setMobileOpen(false)
    if (pathname === "/project") window.dispatchEvent(new Event("composer:focus"))
    else router.push("/project#new")
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  // labels hide only in the desktop collapsed state
  const label = collapsed ? "lg:sr-only" : ""
  const itemBase =
    "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
  const itemCls = (active: boolean) =>
    `${itemBase} ${collapsed ? "lg:justify-center lg:px-0" : ""} ${
      active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`

  return (
    <AuthGuard>
    <div className="dark flex h-screen bg-[#0b0b0c] text-zinc-100">
      {/* mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* ───────── Sidebar ───────── */}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#0e0e10] transition-[transform,width] duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-16" : "lg:w-64"}`}
      >
        {/* brand */}
        <div className={`flex h-14 shrink-0 items-center justify-between px-3 ${collapsed ? "lg:justify-center" : ""}`}>
          <Link href="/" className="flex items-center gap-2 px-1.5 text-base font-semibold tracking-tight">
            <span className="size-6 shrink-0 rounded-t-full rounded-bl-full bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500" />
            <span className={label}>{APP_NAME}</span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* new project */}
        <div className="px-3 pb-2">
          <button
            type="button"
            title="New project"
            onClick={newProject}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-medium text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            <Plus size={16} />
            <span className={label}>New project</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {/* platform */}
          <p className={`px-2.5 pb-1.5 text-xs font-medium text-zinc-500 ${collapsed ? "lg:hidden" : ""}`}>Platform</p>
          <nav>
            <ul className="space-y-0.5">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    title={n.label}
                    aria-current={isActive(n.href) ? "page" : undefined}
                    className={itemCls(isActive(n.href))}
                  >
                    <n.icon size={16} className="shrink-0" />
                    <span className={label}>{n.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* recent */}
          <div className={`mt-6 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="px-2.5 pb-1.5 text-xs font-medium text-zinc-500">Recent</p>
            <ul className="space-y-0.5">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/project/${r.id}`}
                    aria-current={pathname === `/project/${r.id}` ? "page" : undefined}
                    className={itemCls(pathname === `/project/${r.id}`)}
                  >
                    <span className={`ml-1 size-1.5 shrink-0 rounded-full ${r.dot}`} />
                    <span className="truncate">{r.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* secondary */}
          <ul className="mt-6 space-y-0.5">
            {secondary.map((n) => (
              <li key={n.href}>
                <Link href={n.href} title={n.label} className={itemCls(isActive(n.href))}>
                  <n.icon size={16} className="shrink-0" />
                  <span className={label}>{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* plan card */}
        <div className={`px-3 pb-2 ${collapsed ? "lg:hidden" : ""}`}>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-200">Free plan</span>
              <span className="text-zinc-500">3 / 5 builds</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={60} aria-valuemin={0} aria-valuemax={100} aria-label="Builds used">
              <div className="h-full w-3/5 rounded-full bg-indigo-400" />
            </div>
            <button
              type="button"
              className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs text-zinc-200 transition-colors hover:bg-white/10"
            >
              <Sparkles size={13} />
              Upgrade
            </button>
          </div>
        </div>

        {/* user */}
        <div ref={menuRef} className="relative border-t border-white/10 p-3">
          {menuOpen && (
            <div
              role="menu"
              className="absolute inset-x-3 bottom-full mb-2 min-w-[14rem] rounded-xl border border-white/10 bg-[#121214] p-1 shadow-xl lg:left-3 lg:right-auto"
            >
              {[
                { l: "Settings", i: Settings },
                { l: "Billing", i: CreditCard },
              ].map(({ l, i: Icon }) => (
                <button
                  key={l}
                  role="menuitem"
                  type="button"
                  className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  <Icon size={15} />
                  {l}
                </button>
              ))}
              <div className="my-1 h-px bg-white/10" />
              <button
                role="menuitem"
                type="button"
                onClick={signOut}
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          )}
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className={`flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white/60 ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/10 text-sm font-medium">
              {user.name[0]?.toUpperCase()}
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-zinc-500">{user.email}</span>
            </span>
            <ChevronsUpDown size={14} className={`shrink-0 text-zinc-500 ${collapsed ? "lg:hidden" : ""}`} />
          </button>
        </div>
      </aside>

      {/* ───────── Content ───────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            aria-label="Toggle sidebar (Ctrl+B)"
            title="Toggle sidebar (Ctrl+B)"
            onClick={toggleCollapsed}
            className="hidden size-9 place-items-center rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white lg:grid"
          >
            <PanelLeft size={18} />
          </button>
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-sm">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1
                return (
                  <li key={c.label} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && <ChevronRight size={13} className="shrink-0 text-zinc-600" />}
                    {c.href && !last ? (
                      <Link href={c.href} className="truncate text-zinc-400 hover:text-white">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? "page" : undefined} className="truncate text-zinc-100">
                        {c.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto" style={dotGrid}>
          {children}
        </main>
      </div>
    </div>
    </AuthGuard>
  )
}