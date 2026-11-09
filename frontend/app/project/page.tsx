"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  ArrowUpRight,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { AppShell, dotGrid } from "@/components/app-shell"
import { useCreateProject, useStartProject } from "@/hooks/projects"
import { projectTraceSource } from "next/dist/build/swc/generated-native"

/* ───────── types + mock data (replace with GET /projects/) ───────── */
type Status = "building" | "live" | "failed" | "draft"

type Project = {
  id: string
  name: string
  prompt: string
  status: Status
  updated: string // ISO date
}

const projects: Project[] = [
  { id: "p_brewline", name: "Brewline", prompt: "Online store for a coffee roaster with subscriptions", status: "building", updated: "2026-11-05T09:12:00Z" },
  { id: "p_gradeflow", name: "GradeFlow", prompt: "Scan exam scripts and mark them with a vision model", status: "live", updated: "2026-11-04T17:40:00Z" },
  { id: "p_trackr", name: "Trackr", prompt: "Delivery tracking with scan-to-confirm on arrival", status: "live", updated: "2026-11-03T11:05:00Z" },
  { id: "p_shopfront", name: "Shopfront", prompt: "Website, Google setup and social media for small shops", status: "draft", updated: "2026-11-01T08:30:00Z" },
  { id: "p_snapdrive", name: "SnapDrive", prompt: "Snap documents and back them up to Google Drive", status: "failed", updated: "2026-10-28T19:22:00Z" },
  { id: "p_commit", name: "CommitDev", prompt: "Auto-share progress on social media after a GitHub push", status: "live", updated: "2026-10-14T13:00:00Z" },
]

const statusStyle: Record<Status, { label: string; cls: string; dot: string }> = {
  building: { label: "Building", cls: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30", dot: "bg-indigo-400 animate-pulse" },
  live: { label: "Live", cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400" },
  failed: { label: "Failed", cls: "bg-red-500/10 text-red-300 ring-red-500/30", dot: "bg-red-400" },
  draft: { label: "Draft", cls: "bg-white/5 text-zinc-300 ring-white/15", dot: "bg-zinc-400" },
}

const filters: { value: "all" | Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "building", label: "Building" },
  { value: "live", label: "Live" },
  { value: "failed", label: "Failed" },
  { value: "draft", label: "Draft" },
]

const starters = [
  { label: "Web app", text: "Build a web app that " },
  { label: "Dashboard", text: "Build a dashboard that shows " },
  { label: "Landing page", text: "Build a landing page for " },
  { label: "Internal tool", text: "Build an internal tool for my team to " },
  { label: "API", text: "Build an API that " },
]

/* ───────── helpers ───────── */
type Recognition = {
  start(): void
  stop(): void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
}

function relativeTime(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

function Thumb({ status }: { status: Status }) {
  const stroke = status === "failed" ? "rgba(248,113,113,0.6)" : "rgba(129,140,248,0.55)"
  const border = status === "live" ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.18)"
  return (
    <svg viewBox="0 0 200 90" className="h-full w-full" fill="none" aria-hidden>
      <path d="M52 20 C 90 20, 90 45, 128 45" stroke={stroke} />
      <path d="M52 70 C 90 70, 90 45, 128 45" stroke={stroke} />
      <path d="M174 45 L 192 45" stroke={stroke} />
      <rect x="10" y="8" width="42" height="24" rx="6" fill="#151517" stroke="rgba(255,255,255,0.18)" />
      <rect x="10" y="58" width="42" height="24" rx="6" fill="#151517" stroke="rgba(255,255,255,0.18)" />
      <rect x="128" y="30" width="46" height="30" rx="6" fill="#151517" stroke={border} />
    </svg>
  )
}

/* ───────── page ───────── */
export default function DashboardPage() {
  const router = useRouter()

  // composer
  const [draft, setDraft] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])
  const [listening, setListening] = React.useState(false)
  const [micSupported, setMicSupported] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const recRef = React.useRef<Recognition | null>(null)
  const baseRef = React.useRef("")

  // create project: `loading` and `error` come from the hook (error is always a string)
  const { createProject, loading: create, error: createError } = useCreateProject()
  const { startProject, loading: starting, error: startError } = useStartProject();
  const [redirecting, setRedirecting] = React.useState(false)

  const loaders = create || starting 
  const busy = loaders || redirecting

  // project list controls
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<"all" | Status>("all")
  const [sort, setSort] = React.useState<"recent" | "name">("recent")

  const resize = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [])

  React.useEffect(resize, [draft, resize])

  const focusComposer = React.useCallback(() => {
    window.scrollTo({ top: 0 })
    textareaRef.current?.focus()
  }, [])

  // "New project" in the sidebar focuses the composer
  React.useEffect(() => {
    if (window.location.hash === "#new") focusComposer()
    window.addEventListener("composer:focus", focusComposer)
    return () => window.removeEventListener("composer:focus", focusComposer)
  }, [focusComposer])

  // "/" focuses project search
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault()
        document.getElementById("project-search")?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // speech support
  React.useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setMicSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition))
    return () => recRef.current?.stop()
  }, [])

  function toggleMic() {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition
      webkitSpeechRecognition?: new () => Recognition
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"
    baseRef.current = draft ? `${draft.trimEnd()} ` : ""
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
      setDraft(baseRef.current + text)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const errorMessage = createError || startError;

async function onCreate() {
  const prompt = draft.trim();
  if (!prompt || busy) return;
  recRef.current?.stop();

  try {
    const project = await createProject({
      name: prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt,
      initial_prompt: prompt,
      description: "",
    });
    console.log(project)

    if (project?.id) {
      const success = await startProject(project.id);
      if (success) {
        setRedirecting(true);
        router.push(`/project/${project.id}`);
      }
    }
  } catch (err: any) {
    // Catch any unexpected errors outside the hook
    console.error("Unexpected error during project creation/start:", err);
  }
}


  
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects
      .filter((p) => (filter === "all" ? true : p.status === filter))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "recent"
          ? new Date(b.updated).getTime() - new Date(a.updated).getTime()
          : a.name.localeCompare(b.name)
      )
  }, [query, filter, sort])

  const stats = [
    { label: "Projects", value: projects.length },
    { label: "Building", value: projects.filter((p) => p.status === "building").length },
    { label: "Live", value: projects.filter((p) => p.status === "live").length },
  ]

  return (
    <AppShell
      crumbs={[{ label: "Dashboard" }]}
      actions={
        <>
          <button
            type="button"
            onClick={() => document.getElementById("project-search")?.focus()}
            className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300 md:flex"
          >
            <Search size={14} />
            Search projects
            <kbd className="ml-auto rounded border border-white/10 px-1.5 text-xs">/</kbd>
          </button>
          <Link
            href="/docs"
            className="hidden h-9 items-center rounded-lg px-3 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            Docs
          </Link>
        </>
      }
    >
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-12">
        {/* ───────── Composer ───────── */}
        <section aria-labelledby="composer-title" className="mx-auto max-w-3xl">
          <h1 id="composer-title" className="text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            What do you want to build?
          </h1>
          <p className="mt-3 text-center text-zinc-400">
            Describe it and press enter. A new project starts right away.
          </p>

          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault()
              void onCreate()
            }}
          >
            <div className="rounded-3xl border border-white/10 bg-[#121214] p-3 shadow-2xl shadow-indigo-500/10 transition-colors focus-within:border-white/25">
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2 px-2 pb-2">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-1.5 text-xs text-zinc-300"
                    >
                      <Paperclip size={12} />
                      <span className="max-w-[160px] truncate">{f.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                        className="grid size-5 place-items-center rounded text-zinc-500 hover:bg-white/10 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label htmlFor="composer" className="sr-only">
                Describe what you want to build
              </label>
              <textarea
                id="composer"
                ref={textareaRef}
                rows={2}
                value={draft}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void onCreate()
                  }
                }}
                placeholder="Ask to build an online store for a coffee roaster…"
                className="w-full resize-none bg-transparent px-3 pt-2 text-base outline-none placeholder:text-zinc-500 disabled:opacity-60"
              />

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? [])
                      setFiles((fs) => [...fs, ...picked])
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Attach files"
                    title="Attach files"
                    onClick={() => fileRef.current?.click()}
                    className="grid size-9 place-items-center rounded-full border border-white/10 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={listening ? "Stop dictation" : "Dictate"}
                    aria-pressed={listening}
                    title={micSupported ? (listening ? "Stop dictation" : "Dictate") : "Dictation isn't supported in this browser"}
                    disabled={!micSupported}
                    onClick={toggleMic}
                    className={`grid size-9 place-items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-40 ${listening
                        ? "border-red-400/50 bg-red-500/10 text-red-300"
                        : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Mic size={16} className={listening ? "animate-pulse" : ""} />
                  </button>
                  <button
                    type="submit"
                    aria-label="Start project"
                    disabled={!draft.trim() || busy}
                    className="grid size-9 place-items-center rounded-full bg-white text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <p role="status" aria-live="polite" className={`mt-3 text-center text-sm ${errorMessage ? "text-red-400" : "text-zinc-500"}`}>
              {errorMessage ?? (busy ? "Creating your project…" : "")}
            </p>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {starters.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraft(s.text)
                  textareaRef.current?.focus()
                }}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* ───────── Stats ───────── */}
        <section aria-label="Summary" className="mt-14 grid grid-cols-3 gap-3 sm:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-[#0e0e10] p-4 sm:p-5">
              <p className="text-xs text-zinc-500 sm:text-sm">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</p>
            </div>
          ))}
        </section>

        {/* ───────── Projects ───────── */}
        <section aria-labelledby="projects-title" className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 id="projects-title" className="text-xl font-semibold tracking-tight">
              Your projects
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 bg-[#121214] px-3 focus-within:border-white/25 sm:w-56">
                <Search size={14} className="shrink-0 text-zinc-500" />
                <label htmlFor="project-search" className="sr-only">
                  Search projects
                </label>
                <input
                  id="project-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
              </div>
              <div role="tablist" aria-label="Filter by status" className="inline-flex flex-wrap rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    role="tab"
                    aria-selected={filter === f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`h-8 rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white/60 ${filter === f.value ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label htmlFor="sort" className="sr-only">
                Sort
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as "recent" | "name")}
                className="h-9 rounded-lg border border-white/10 bg-[#121214] px-3 text-sm text-zinc-300 outline-none focus-visible:border-white/30"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => {
              const s = statusStyle[p.status]
              return (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="group flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e10] transition-colors hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                >
                  <div className="h-28 border-b border-white/10 bg-[#0b0b0c] p-3" style={dotGrid}>
                    <Thumb status={p.status} />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="truncate font-medium">{p.name}</h3>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ring-1 ${s.cls}`}>
                        <span className={`size-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{p.prompt}</p>
                    <div className="mt-auto flex items-center justify-between pt-4 text-xs text-zinc-500">
                      <span>Updated {relativeTime(p.updated)}</span>
                      <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {visible.length === 0 && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0e0e10] px-6 py-14 text-center">
              <p className="font-medium">{projects.length === 0 ? "No projects yet" : "No projects match"}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {projects.length === 0 ? "Describe your first idea above and it will show up here." : "Try a different search or filter."}
              </p>
              {projects.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5 rounded-lg border-white/10 bg-transparent text-zinc-200 hover:bg-white/5"
                  onClick={() => {
                    setQuery("")
                    setFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}