"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import {
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  File as FileIcon,
  Folder,
  ListChecks,
  Maximize2,
  Mic,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
  Rocket,
  Smartphone,
  Table2,
  Network,
  Tablet,
  Terminal as TerminalIcon,
  X,
  ZoomIn,
  ZoomOut,
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Badge } from "@/components/ui/badge"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { useProjectStream, parseInterrupt, type Interrupt, type Part, type Step } from "@/lib/use-project-stream"

const APP_NAME = "Buildly"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const WS_URL = (id: string) => `ws://localhost:8000/ws/projects/${id}?token=secret-test-token`

type Tab = "preview" | "code" | "graph"
type Overlay = null | "activity" | "detail"
type Pane = "chat" | "main"

const starters = [
  "Build an online store for a coffee roaster with subscriptions",
  "Create a task manager with login and a dashboard",
]

/* ───────── mock project data (replace with backend events later) ───────── */
const files: Record<string, string> = {
  "app/page.tsx": `export default function Shop() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold">Brewline</h1>
      <p className="mt-2 text-neutral-600">
        Freshly roasted coffee, delivered every few weeks.
      </p>
      <GiftSubscriptionCard />
    </main>
  )
}`,
  "api/main.py": `from fastapi import FastAPI
from .orders import router as orders

app = FastAPI()
app.include_router(orders, prefix="/orders")

@app.get("/health")
def health():
    return {"ok": True}`,
  "api/orders.py": `from fastapi import APIRouter

router = APIRouter()

@router.post("/gift")
def create_gift_subscription(payload: dict):
    # TODO: send the recipient an email via SendGrid
    return {"status": "created"}`,
  "package.json": `{
  "name": "brewline",
  "private": true,
  "scripts": { "dev": "next dev" }
}`,
}

const fileTree = [
  { name: "app", children: ["app/page.tsx"] },
  { name: "api", children: ["api/main.py", "api/orders.py"] },
  { name: "package.json", children: [] as string[] },
]

type GNode = {
  id: string
  title: string
  desc: string
  x: number
  y: number
  w: number
  h: number
  file: string
  what: string
  inputs: string[]
  outputs: string[]
  changed?: string
}

const W = 800
const H = 420

const nodes: GNode[] = [
  { id: "shop", title: "Online shop", desc: "The website customers use to browse...", x: 20, y: 40, w: 170, h: 64, file: "app/page.tsx", changed: "4 changed", what: "The storefront where customers browse coffee and buy bags or subscriptions.", inputs: ["Product list", "Customer session"], outputs: ["Orders sent to the main server"] },
  { id: "staff", title: "Staff app", desc: "Where staff work through the packing...", x: 20, y: 150, w: 170, h: 64, file: "app/page.tsx", what: "The screen staff use to pack and ship orders.", inputs: ["Open orders"], outputs: ["Order status updates"] },
  { id: "jobs", title: "Background jobs", desc: "Nightly tasks that keep things in sync...", x: 20, y: 270, w: 170, h: 64, file: "api/main.py", what: "Nightly tasks that renew subscriptions and sync stock.", inputs: ["Subscription schedule"], outputs: ["Renewal orders"] },
  { id: "server", title: "Main server", desc: "The heart of the app: the shop, the staff...", x: 320, y: 130, w: 190, h: 84, file: "api/orders.py", changed: "6 changed", what: "Keeps orders, stock and subscriptions in step and talks to every service.", inputs: ["Orders", "Webhooks"], outputs: ["Payments", "Emails", "Shipping labels"] },
  { id: "db", title: "Database", desc: "Postgres, where every order, user...", x: 610, y: 20, w: 170, h: 64, file: "api/main.py", what: "Stores every order, user and subscription.", inputs: ["Writes from the server"], outputs: ["Records"] },
  { id: "stripe", title: "Stripe", desc: "Takes card payments, runs checkout...", x: 610, y: 120, w: 170, h: 64, file: "api/orders.py", what: "Takes card payments and runs checkout.", inputs: ["Payment requests"], outputs: ["Payment results"] },
  { id: "sendgrid", title: "SendGrid", desc: "Sends customer emails: receipts...", x: 610, y: 220, w: 170, h: 64, file: "api/orders.py", what: "Sends receipts and gift emails.", inputs: ["Email requests"], outputs: ["Delivery status"] },
  { id: "shippo", title: "Shippo", desc: "Sells the shipping labels and provides...", x: 610, y: 320, w: 170, h: 64, file: "api/orders.py", what: "Buys shipping labels and tracks parcels.", inputs: ["Address and weight"], outputs: ["Label, tracking number"] },
]

const edges: [string, string][] = [
  ["shop", "server"],
  ["staff", "server"],
  ["jobs", "server"],
  ["server", "db"],
  ["server", "stripe"],
  ["server", "sendgrid"],
  ["server", "shippo"],
]

const byId = Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, GNode>

function edgePath(a: GNode, b: GNode) {
  const x1 = a.x + a.w
  const y1 = a.y + a.h / 2
  const x2 = b.x
  const y2 = b.y + b.h / 2
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

const dotGrid = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
}

/* ───────── small pieces ───────── */
function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
      <span className="size-5 rounded-t-full rounded-bl-full bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500" />
      {APP_NAME}
    </a>
  )
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick?: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-lg border text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 ${
        active ? "border-white/25 bg-white/10 text-white" : "border-white/10 bg-transparent"
      }`}
    >
      {children}
    </button>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; icon?: React.ReactNode }[]
}) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          type="button"
          onClick={() => onChange(i.value)}
          className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white/60 ${
            value === i.value ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          {i.icon}
          {i.label}
        </button>
      ))}
    </div>
  )
}

/* ───────── chain of thought (chat) ───────── */
function StatusIcon({ status }: { status?: "running" | "error" }) {
  if (status === "running") return <LoaderCircleIcon className="animate-spin" />
  return status === "error" ? <CircleAlertIcon /> : <CircleCheckIcon />
}

function toolTitle(tool: string, status?: "running" | "error") {
  const name = tool.replace(/[_-]+/g, " ")
  return status === "running" ? `Running ${name}` : status === "error" ? `Failed: ${name}` : `Ran ${name}`
}

/** Pull the most useful one-liner out of a tool's input (path, command, query...). */
function toolSummary(input: unknown): string | undefined {
  if (typeof input === "string") return input.slice(0, 120)
  if (!input || typeof input !== "object") return undefined
  const o = input as Record<string, unknown>
  for (const k of ["path", "file_path", "filename", "file", "command", "cmd", "query", "url", "name"]) {
    if (typeof o[k] === "string") return (o[k] as string).split("\n")[0]!.slice(0, 120)
  }
  return undefined
}

function stepStatus(x: Step): "running" | "error" | undefined {
  return x.failed ? "error" : x.done ? undefined : "running"
}

function StepRow({ step }: { step: Step }) {
  const st = stepStatus(step)
  const summary = toolSummary(step.input)
  const hasInput = step.input !== undefined && step.input !== null
  const line = (
    <TraceLine status={st}>
      <TraceIcon>
        <StatusIcon status={st} />
      </TraceIcon>
      <TraceTitle>{toolTitle(step.tool, st)}</TraceTitle>
      {summary && <TraceDescription className="truncate font-mono">{summary}</TraceDescription>}
    </TraceLine>
  )
  if (!hasInput && !step.output) return line

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="space-y-2">
          {hasInput && (
            <CodeBlock size="sm">
              <CodeBlockContent wrap className="max-h-48">
                {typeof step.input === "string" ? step.input : JSON.stringify(step.input, null, 2)}
              </CodeBlockContent>
            </CodeBlock>
          )}
          {step.output && (
            <CodeBlock size="sm" variant={step.failed ? "destructive" : undefined}>
              <CodeBlockContent wrap className="max-h-48">
                {step.output}
              </CodeBlockContent>
            </CodeBlock>
          )}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

/** A run of consecutive tool calls, collapsed into one summary line. */
function StepGroup({ steps, live }: { steps: Step[]; live: boolean }) {
  const [open, setOpen] = React.useState<boolean>()
  const current = steps.find((x) => !x.done && !x.failed)
  const running = live && !!current
  const failed = steps.filter((x) => x.failed).length
  const status = running ? "running" : failed > 0 ? "error" : undefined

  return (
    <Trace>
      <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={status}>
            <TraceIcon>
              <StatusIcon status={status} />
            </TraceIcon>
            <TraceTitle>
              {running
                ? toolTitle(current!.tool, "running")
                : `Ran ${steps.length} step${steps.length === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted>
          <Trace>
            {steps.map((x) => (
              <StepRow key={x.id} step={x} />
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

/* ───────── markdown ───────── */
const mdComponents = {
  p: (p: any) => <p className="leading-relaxed" {...p} />,
  h1: (p: any) => <h3 className="mt-2 text-base font-semibold" {...p} />,
  h2: (p: any) => <h3 className="mt-2 text-base font-semibold" {...p} />,
  h3: (p: any) => <h4 className="mt-1 text-sm font-semibold" {...p} />,
  ul: (p: any) => <ul className="list-disc space-y-1 pl-5" {...p} />,
  ol: (p: any) => <ol className="list-decimal space-y-1 pl-5" {...p} />,
  a: (p: any) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-zinc-100" {...p} />,
  blockquote: (p: any) => <blockquote className="border-l-2 border-white/20 pl-3 text-zinc-400" {...p} />,
  hr: () => <hr className="border-white/10" />,
  pre: (p: any) => (
    <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[12px] leading-5" {...p} />
  ),
  code: ({ className, children, ...p }: any) => {
    const block = /language-/.test(className ?? "") || String(children).includes("\n")
    return block ? (
      <code className="font-mono" {...p}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[12px]" {...p}>
        {children}
      </code>
    )
  },
  table: (p: any) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]" {...p} />
    </div>
  ),
  th: (p: any) => <th className="border-b border-white/10 px-2 py-1 font-medium" {...p} />,
  td: (p: any) => <td className="border-b border-white/5 px-2 py-1" {...p} />,
}

function Md({ children }: { children: string }) {
  return (
    <div className="space-y-3 break-words text-sm text-zinc-300">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** Render a message's parts in order: text as markdown, tool runs as collapsed traces. */
function AgentParts({ parts, streaming }: { parts: Part[]; streaming: boolean }) {
  const groups: ({ kind: "text"; text: string } | { kind: "steps"; steps: Step[] })[] = []
  for (const p of parts) {
    if (p.kind === "text") {
      if (!p.text.trim()) continue
      groups.push({ kind: "text", text: p.text })
    } else {
      const last = groups[groups.length - 1]
      if (last?.kind === "steps") last.steps.push(p.step)
      else groups.push({ kind: "steps", steps: [p.step] })
    }
  }

  return (
    <>
      {groups.map((g, i) => {
        const isLast = i === groups.length - 1
        return g.kind === "text" ? (
          <div key={i}>
            <Md>{g.text}</Md>
            {streaming && isLast && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-zinc-400 align-middle" />
            )}
          </div>
        ) : (
          <StepGroup key={i} steps={g.steps} live={streaming && isLast} />
        )
      })}
      {streaming && groups.length === 0 && (
        <span className="inline-block h-4 w-1.5 animate-pulse bg-zinc-400 align-middle" />
      )}
    </>
  )
}

/* ───────── interrupts (questions / approvals) ───────── */
function InterruptCard({ item, onRespond }: { item: Interrupt; onRespond: (answer: string) => void }) {
  const { question, options, raw } = parseInterrupt(item.reason)
  const [custom, setCustom] = React.useState("")
  const isQuestion = !!question && options.length > 0

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-300">
        {isQuestion || question ? "The agent has a question" : `Approval needed: ${item.name}`}
      </div>

      {question ? (
        <Md>{question}</Md>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap text-[13px] text-zinc-300">
          {typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)}
        </pre>
      )}

      {options.length > 0 ? (
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onRespond(o)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              {o}
            </button>
          ))}
        </div>
      ) : !question ? (
        <div className="flex gap-2">
          <Button size="sm" className="rounded-lg bg-white text-black hover:bg-zinc-200" onClick={() => onRespond("approve")}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg border-white/10 bg-transparent text-zinc-200 hover:bg-white/5"
            onClick={() => onRespond("reject")}
          >
            Reject
          </Button>
        </div>
      ) : null}

      {(question || options.length > 0) && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (custom.trim()) onRespond(custom.trim())
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={options.length ? "Or type your own answer…" : "Type your answer…"}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121214] px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-white/25"
          />
          <Button type="submit" size="sm" disabled={!custom.trim()} className="rounded-lg bg-white text-black hover:bg-zinc-200">
            Send
          </Button>
        </form>
      )}
    </div>
  )
}

/* ───────── page ───────── */
export default function ProjectPage() {
  const params = useParams<{ id: string }>()
  const projectId = params?.id 

  // Live backend stream
  const { isConnected, state, sendPrompt, respondToInterrupt } = useProjectStream(WS_URL(projectId), {
    projectId: `${projectId}`, // match your router prefix
  })
  const { messages, status, agents, agentOrder, agentDetail, logs, terminal, interrupts } = state
  const busy = status === "running"

  // UI state
  const [draft, setDraft] = React.useState("")
  const [chatOpen, setChatOpen] = React.useState(true)
  const [pane, setPane] = React.useState<Pane>("chat")
  const [tab, setTab] = React.useState<Tab>("preview")
  const [overlay, setOverlay] = React.useState<Overlay>(null)
  const [terminalOpen, setTerminalOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [openFile, setOpenFile] = React.useState("app/page.tsx")
  const [openTabs, setOpenTabs] = React.useState<string[]>(["app/page.tsx", "api/orders.py"])
  const [device, setDevice] = React.useState<"desktop" | "tablet" | "mobile">("desktop")
  const [graphView, setGraphView] = React.useState<"graph" | "table">("graph")
  const [live, setLive] = React.useState<"static" | "live">("live")
  const [zoom, setZoom] = React.useState(1)
  const [tested, setTested] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const termEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, interrupts])

  React.useEffect(() => {
    termEndRef.current?.scrollIntoView({ block: "end" })
  }, [terminal, terminalOpen])

  const node = selected ? byId[selected] : null
  const connectedIds = React.useMemo(() => {
    if (!selected) return null
    const ids = new Set<string>([selected])
    edges.forEach(([a, b]) => {
      if (a === selected || b === selected) {
        ids.add(a)
        ids.add(b)
      }
    })
    return ids
  }, [selected])

  function send(text: string) {
    const value = text.trim()
    if (!value || busy || !isConnected) return
    sendPrompt(value)
    setDraft("")
  }

  function selectNode(id: string) {
    setSelected(id)
    setTested(null)
    setOverlay("detail")
  }

  function openInCode(path: string) {
    setOpenFile(path)
    setOpenTabs((t) => (t.includes(path) ? t : [...t, path]))
    setTab("code")
    setOverlay(null)
    setPane("main")
  }

  function toggleOverlay(next: Exclude<Overlay, null>) {
    setOverlay((o) => (o === next ? null : next))
  }

  const deviceWidth = device === "desktop" ? "w-full" : device === "tablet" ? "w-[640px]" : "w-[375px]"

  const badge = !isConnected
    ? { label: "Offline", cls: "bg-red-500/10 text-red-300 ring-red-500/20" }
    : status === "running"
      ? { label: "Working", cls: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20" }
      : status === "interrupted"
        ? { label: "Needs approval", cls: "bg-amber-500/10 text-amber-300 ring-amber-500/20" }
        : status === "failed"
          ? { label: "Failed", cls: "bg-red-500/10 text-red-300 ring-red-500/20" }
          : status === "completed"
            ? { label: "Done", cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" }
            : { label: "Connected", cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" }

  return (
    <div className="dark flex h-screen flex-col bg-[#0b0b0c] text-zinc-100">
      {/* ───────── Top bar ───────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <Logo />
        <span className="hidden text-zinc-600 sm:inline">/</span>
        <span className="hidden truncate text-sm text-zinc-300 sm:inline">Brewline</span>
        <span className={`hidden items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 md:inline-flex ${badge.cls}`}>
          <span className={`size-1.5 rounded-full bg-current ${busy ? "animate-pulse" : ""}`} />
          {badge.label}
        </span>
        <span className="hidden text-xs text-zinc-600 lg:inline">#{projectId}</span>

        <div className="ml-auto flex items-center gap-2">
          <IconButton label="Activity" active={overlay === "activity"} onClick={() => toggleOverlay("activity")}>
            <ListChecks size={16} />
          </IconButton>
          <IconButton label="Terminal" active={terminalOpen} onClick={() => setTerminalOpen((v) => !v)}>
            <TerminalIcon size={16} />
          </IconButton>
          <Button size="sm" className="ml-1 rounded-lg bg-white text-black hover:bg-zinc-200">
            <Rocket size={14} />
            Deploy
          </Button>
        </div>
      </header>

      {/* mobile pane switch */}
      <div className="flex shrink-0 justify-center border-b border-white/10 p-2 lg:hidden">
        <Segmented<Pane>
          value={pane}
          onChange={setPane}
          items={[
            { value: "chat", label: "Chat" },
            { value: "main", label: "Project" },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ───────── Chat panel ───────── */}
        <aside
          className={`${pane === "chat" ? "flex" : "hidden"} ${
            chatOpen ? "lg:flex" : "lg:hidden"
          } w-full shrink-0 flex-col border-r border-white/10 bg-[#0e0e10] lg:w-[380px]`}
        >
          <div className="flex h-12 shrink-0 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Assistant</span>
              <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-zinc-400">Swarm</span>
            </div>
            <IconButton label="Collapse chat" onClick={() => setChatOpen(false)}>
              <PanelLeftClose size={16} />
            </IconButton>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 px-4 pb-4">
              {messages.length === 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-zinc-500">Describe what you want built. The agents will plan, code and test it here.</p>
                  <div className="flex flex-wrap gap-2">
                    {starters.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => send(c)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left text-[13px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const userText = m.parts.map((p) => (p.kind === "text" ? p.text : "")).join("")
                if (m.role === "user") {
                  return (
                    <Message key={m.id} align="end">
                      <MessageContent>
                        <Bubble align="end" variant="muted">
                          <BubbleContent>{userText}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )
                }
                if (m.role === "system") {
                  return (
                    <div key={m.id} className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-300">
                      {userText}
                    </div>
                  )
                }
                return (
                  <Message key={m.id}>
                    <MessageContent className="gap-3">
                      <Badge variant="secondary" className="w-fit capitalize">
                        {m.agent}
                      </Badge>
                      <AgentParts parts={m.parts} streaming={!!m.streaming} />
                    </MessageContent>
                  </Message>
                )
              })}

              {interrupts.map((i) => (
                <InterruptCard key={i.interruptId} item={i} onRespond={(ans) => respondToInterrupt(i.interruptId, ans)} />
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <form
            className="shrink-0 border-t border-white/10 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              send(draft)
            }}
          >
            <div className="rounded-2xl border border-white/10 bg-[#121214] p-2 focus-within:border-white/25">
              <label htmlFor="chat-input" className="sr-only">
                Message the agents
              </label>
              <textarea
                id="chat-input"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(draft)
                  }
                }}
                placeholder={
                  !isConnected ? "Reconnecting…" : busy ? "Agents are working…" : "Ask the agents to change something…"
                }
                className="w-full resize-none bg-transparent px-2 pt-1 text-sm outline-none placeholder:text-zinc-500"
              />
              <div className="flex items-center justify-between pt-1">
                <IconButton label="Add files">
                  <Plus size={16} />
                </IconButton>
                <div className="flex items-center gap-2">
                  <IconButton label="Voice">
                    <Mic size={16} />
                  </IconButton>
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={!draft.trim() || busy || !isConnected}
                    className="grid size-9 place-items-center rounded-full bg-white text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            </div>
          </form>
        </aside>

        {/* ───────── Main panel ───────── */}
        <section className={`${pane === "main" ? "flex" : "hidden"} min-w-0 flex-1 flex-col lg:flex`} style={dotGrid}>
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0b0b0c]/80 px-4 backdrop-blur">
            {!chatOpen && (
              <IconButton label="Open chat" onClick={() => setChatOpen(true)}>
                <PanelLeftOpen size={16} />
              </IconButton>
            )}
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              items={[
                { value: "preview", label: "Preview" },
                { value: "code", label: "Code" },
                { value: "graph", label: "Graph" },
              ]}
            />
          </div>

          <div className="relative flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-auto">
                {/* ── Preview ── */}
                {tab === "preview" && (
                  <div className="flex h-full flex-col p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-400">
                        <span className="truncate">localhost:3000</span>
                      </div>
                      <IconButton label="Reload">
                        <RotateCw size={16} />
                      </IconButton>
                      <IconButton label="Open in new tab">
                        <ExternalLink size={16} />
                      </IconButton>
                      <div className="hidden sm:flex">
                        <Segmented<"desktop" | "tablet" | "mobile">
                          value={device}
                          onChange={setDevice}
                          items={[
                            { value: "desktop", label: "", icon: <Monitor size={14} /> },
                            { value: "tablet", label: "", icon: <Tablet size={14} /> },
                            { value: "mobile", label: "", icon: <Smartphone size={14} /> },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-xl border border-white/10 bg-[#0e0e10] p-4">
                      {/* Replace this mock with <iframe src={previewUrl} /> */}
                      <div className={`${deviceWidth} max-w-full overflow-hidden rounded-lg bg-white text-neutral-900`}>
                        <div className="flex items-center justify-between border-b px-6 py-4">
                          <span className="font-semibold">Brewline</span>
                          <span className="text-sm text-neutral-500">Shop · Subscriptions · Cart</span>
                        </div>
                        <div className="px-6 py-14 text-center">
                          <h2 className="text-3xl font-semibold tracking-tight">Freshly roasted, delivered.</h2>
                          <p className="mx-auto mt-3 max-w-md text-neutral-500">
                            Bags, subscriptions and gift boxes from our roastery.
                          </p>
                          <div className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white">
                            Shop coffee
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 px-6 pb-8">
                          {["Ethiopia", "Colombia", "Gift box"].map((n) => (
                            <div key={n} className="rounded-lg border p-4 text-sm">
                              <div className="mb-3 h-16 rounded-md bg-neutral-100" />
                              {n}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Code ── */}
                {tab === "code" && (
                  <div className="flex h-full">
                    <nav aria-label="Files" className="hidden w-56 shrink-0 overflow-auto border-r border-white/10 bg-[#0e0e10] p-3 text-sm sm:block">
                      {fileTree.map((g) => (
                        <div key={g.name} className="mb-2">
                          {g.children.length > 0 ? (
                            <>
                              <div className="flex items-center gap-1.5 px-2 py-1 text-zinc-400">
                                <Folder size={14} /> {g.name}
                              </div>
                              {g.children.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => openInCode(p)}
                                  className={`flex w-full items-center gap-1.5 rounded-md py-1 pl-7 pr-2 text-left transition-colors hover:bg-white/5 ${
                                    openFile === p ? "bg-white/10 text-white" : "text-zinc-400"
                                  }`}
                                >
                                  <FileIcon size={13} />
                                  {p.split("/").pop()}
                                  {(p === "api/orders.py" || p === "app/page.tsx") && (
                                    <span className="ml-auto size-1.5 rounded-full bg-emerald-400" />
                                  )}
                                </button>
                              ))}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openInCode(g.name)}
                              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-white/5 ${
                                openFile === g.name ? "bg-white/10 text-white" : "text-zinc-400"
                              }`}
                            >
                              <FileIcon size={13} />
                              {g.name}
                            </button>
                          )}
                        </div>
                      ))}
                    </nav>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex shrink-0 overflow-x-auto border-b border-white/10 bg-[#0e0e10]">
                        {openTabs.map((p) => (
                          <div
                            key={p}
                            className={`flex items-center gap-2 border-r border-white/10 px-3 py-2 text-sm ${
                              openFile === p ? "bg-[#0b0b0c] text-white" : "text-zinc-400"
                            }`}
                          >
                            <button type="button" onClick={() => setOpenFile(p)}>
                              {p.split("/").pop()}
                            </button>
                            <button
                              type="button"
                              aria-label={`Close ${p}`}
                              onClick={() => {
                                const next = openTabs.filter((t) => t !== p)
                                setOpenTabs(next)
                                if (openFile === p && next.length) setOpenFile(next[0]!)
                              }}
                              className="text-zinc-600 hover:text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <pre className="min-h-0 flex-1 overflow-auto bg-[#0b0b0c] p-4 font-mono text-[13px] leading-6 text-zinc-300">
                        {(files[openFile] ?? "").split("\n").map((line, i) => (
                          <div key={i} className="flex">
                            <span className="w-10 shrink-0 select-none pr-4 text-right text-zinc-600">{i + 1}</span>
                            <span className="whitespace-pre">{line}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                )}

                {/* ── Graph ── */}
                {tab === "graph" && (
                  <div className="relative h-full min-h-[480px]">
                    {graphView === "graph" ? (
                      <div className="h-full overflow-auto p-6 pb-24">
                        <div
                          className="relative min-w-[720px] origin-top-left"
                          style={{ aspectRatio: `${W} / ${H}`, transform: `scale(${zoom})`, width: "100%" }}
                        >
                          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" fill="none" aria-hidden>
                            {edges.map(([a, b]) => {
                              const active = !connectedIds || (connectedIds.has(a) && connectedIds.has(b))
                              return (
                                <path
                                  key={`${a}-${b}`}
                                  d={edgePath(byId[a]!, byId[b]!)}
                                  stroke={active && connectedIds ? "rgba(129,140,248,0.9)" : "rgba(129,140,248,0.45)"}
                                  strokeWidth={active && connectedIds ? 1.8 : 1.2}
                                  opacity={active ? 1 : 0.2}
                                />
                              )
                            })}
                          </svg>
                          {nodes.map((n) => {
                            const dim = connectedIds && !connectedIds.has(n.id)
                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => selectNode(n.id)}
                                aria-pressed={selected === n.id}
                                className={`absolute rounded-xl border bg-[#151517] p-3 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 ${
                                  selected === n.id
                                    ? "border-white/60"
                                    : n.changed
                                      ? "border-emerald-500/50"
                                      : "border-white/10 hover:border-white/30"
                                } ${dim ? "opacity-25" : "opacity-100"}`}
                                style={{
                                  left: `${(n.x / W) * 100}%`,
                                  top: `${(n.y / H) * 100}%`,
                                  width: `${(n.w / W) * 100}%`,
                                  height: `${(n.h / H) * 100}%`,
                                }}
                              >
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-100">
                                  <span className="size-2 rounded-sm bg-indigo-400/70" />
                                  {n.title}
                                </div>
                                <p className="mt-1 truncate text-[10px] text-zinc-500">{n.desc}</p>
                                {n.changed && live === "live" && (
                                  <span className="absolute bottom-2 right-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-300 ring-1 ring-emerald-500/30">
                                    {n.changed}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs text-zinc-500">
                            <tr>
                              <th className="pb-2 font-medium">Component</th>
                              <th className="pb-2 font-medium">What it does</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {nodes.map((n) => (
                              <tr
                                key={n.id}
                                onClick={() => selectNode(n.id)}
                                className="cursor-pointer border-t border-white/10 hover:bg-white/5"
                              >
                                <td className="py-3 pr-4 font-medium">{n.title}</td>
                                <td className="py-3 pr-4 text-zinc-400">{n.what}</td>
                                <td className="py-3 text-xs text-zinc-400">{n.changed ?? "Unchanged"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* floating toolbar */}
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#121214] p-1.5 shadow-lg">
                      <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}>
                        <ZoomOut size={16} />
                      </IconButton>
                      <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(1)))}>
                        <ZoomIn size={16} />
                      </IconButton>
                      <IconButton label="Fit" onClick={() => setZoom(1)}>
                        <Maximize2 size={16} />
                      </IconButton>
                      <span className="mx-1 h-5 w-px bg-white/10" />
                      <Segmented<"graph" | "table">
                        value={graphView}
                        onChange={setGraphView}
                        items={[
                          { value: "graph", label: "", icon: <Network size={14} /> },
                          { value: "table", label: "", icon: <Table2 size={14} /> },
                        ]}
                      />
                      <Segmented<"static" | "live">
                        value={live}
                        onChange={setLive}
                        items={[
                          { value: "static", label: "Static" },
                          { value: "live", label: "Live" },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Terminal drawer ── */}
              {terminalOpen && (
                <div className="h-56 shrink-0 border-t border-white/10 bg-[#0e0e10]">
                  <div className="flex h-9 items-center justify-between border-b border-white/10 px-4 text-xs text-zinc-400">
                    <span className="flex items-center gap-2">
                      <TerminalIcon size={13} /> Terminal
                    </span>
                    <button type="button" aria-label="Close terminal" onClick={() => setTerminalOpen(false)} className="hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="h-[calc(100%-2.25rem)] overflow-auto p-4 font-mono text-[13px] leading-6 text-zinc-300">
                    {terminal.map((l, i) => (
                      <div key={i} className={l.startsWith("FAILED") ? "text-red-400" : ""}>
                        {l}
                      </div>
                    ))}
                    <div ref={termEndRef} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Right overlay: Activity or Node detail ── */}
            {overlay && (
              <aside
                aria-label={overlay === "activity" ? "Activity" : "Component details"}
                className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#0e0e10] shadow-2xl lg:static lg:shadow-none"
              >
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
                  <span className="text-sm font-semibold">{overlay === "activity" ? "Activity" : node?.title}</span>
                  <button type="button" aria-label="Close panel" onClick={() => setOverlay(null)} className="text-zinc-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                {overlay === "activity" && (
                  <div className="min-h-0 flex-1 space-y-6 overflow-auto p-4">
                    <div>
                      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Agents</h3>
                      {agentOrder.length === 0 ? (
                        <p className="text-sm text-zinc-600">No agents have run yet</p>
                      ) : (
                        <ul className="space-y-2 text-sm text-zinc-300">
                          {agentOrder.map((a) => (
                            <li key={a} className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between capitalize">
                                {a}
                                <span
                                  className={`flex items-center gap-1.5 text-xs ${
                                    agents[a] === "working" ? "text-indigo-300" : "text-zinc-500"
                                  }`}
                                >
                                  {agents[a] === "working" ? (
                                    <RotateCw size={11} className="animate-spin" />
                                  ) : (
                                    <Check size={11} className="text-emerald-400" />
                                  )}
                                  {agents[a] === "working" ? "Working" : "Done"}
                                </span>
                              </div>
                              {!!agentDetail[a]?.tools.length && (
                                <div className="flex flex-wrap gap-1.5">
                                  {agentDetail[a]!.tools.slice(-6).map((t, i) => (
                                    <span key={i} className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {agentDetail[a]?.text && (
                                <p className="max-h-24 overflow-hidden whitespace-pre-wrap text-[12px] leading-snug text-zinc-500">
                                  {agentDetail[a]!.text.slice(-280)}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Timeline</h3>
                      {logs.length === 0 ? (
                        <p className="text-sm text-zinc-600">Nothing yet</p>
                      ) : (
                        <ul className="space-y-1.5 text-[13px] text-zinc-400">
                          {logs
                            .slice()
                            .reverse()
                            .map((l) => (
                              <li key={l.id}>{l.text}</li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {overlay === "detail" && node && (
                  <div className="min-h-0 flex-1 space-y-6 overflow-auto p-4 text-sm">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-zinc-400">
                          {node.id === "stripe" || node.id === "sendgrid" || node.id === "shippo"
                            ? "Service"
                            : node.id === "db"
                              ? "Database"
                              : "Component"}
                        </span>
                        {node.changed && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 ring-1 ring-emerald-500/30">
                            {node.changed}
                          </span>
                        )}
                      </div>
                      <p className="leading-relaxed text-zinc-300">{node.what}</p>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(node.file)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 1200)
                        }}
                        className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-zinc-300 hover:bg-white/10"
                      >
                        {node.file}
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>

                    {(
                      [
                        ["Inputs", node.inputs],
                        ["Outputs", node.outputs],
                      ] as const
                    ).map(([h, list]) => (
                      <div key={h}>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{h}</h3>
                        <ul className="space-y-1 text-zinc-300">
                          {list.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {(
                      [
                        ["Depends on", edges.filter(([a]) => a === node.id).map(([, b]) => b)],
                        ["Used by", edges.filter(([, b]) => b === node.id).map(([a]) => a)],
                      ] as const
                    ).map(([h, ids]) => (
                      <div key={h}>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{h}</h3>
                        {ids.length === 0 ? (
                          <p className="text-zinc-600">Nothing</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {ids.map((id) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => selectNode(id)}
                                className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10"
                              >
                                {byId[id]!.title}
                                <ChevronRight size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-lg bg-white text-black hover:bg-zinc-200" onClick={() => setTested(node.id)}>
                          Test component
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg border-white/10 bg-transparent text-zinc-200 hover:bg-white/5"
                          onClick={() => openInCode(node.file)}
                        >
                          Open code
                        </Button>
                      </div>

                      {tested === node.id && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-zinc-300">
                              <Check size={14} className="text-emerald-400" /> Renders without errors
                            </li>
                            <li className="flex items-center gap-2 text-zinc-300">
                              {node.changed ? <X size={14} className="text-red-400" /> : <Check size={14} className="text-emerald-400" />}
                              Handles the empty state
                            </li>
                          </ul>
                          {node.changed && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="rounded-lg bg-white text-black hover:bg-zinc-200"
                                onClick={() => {
                                  send(`Fix the empty state in ${node.title}`)
                                  setPane("chat")
                                }}
                              >
                                Fix with AI
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-white/10 bg-transparent text-zinc-200 hover:bg-white/5"
                                onClick={() => openInCode(node.file)}
                              >
                                Fix by hand
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}