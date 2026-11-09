"use client"

import * as React from "react"
import { useWebSocket } from "@/lib/websocket"
import {api} from "@/lib/api";

export type JobStatus = "idle" | "running" | "interrupted" | "completed" | "failed"
export type AgentStatus = "working" | "done"

export type Step = {
  id: string
  tool: string
  input?: unknown
  output?: string
  done: boolean
  failed?: boolean
}


type responsed= {
  response:string
}
type interruption={
status: string
 message: string
}

// A message is an ordered list of parts, so text and tool calls keep the order they happened in
export type Part = { kind: "text"; text: string } | { kind: "tool"; step: Step }
export type ChatMsg = {
  id: string
  role: "user" | "agent" | "system"
  agent?: string
  parts: Part[]
  streaming?: boolean
}
export type Interrupt = { interruptId: string; name: string; reason: unknown }
export type LogEntry = { id: number; type: string; text: string }

export type StreamState = {
  status: JobStatus
  containerId: string | null
  messages: ChatMsg[]
  agents: Record<string, AgentStatus>
  agentOrder: string[]
  agentDetail: Record<string, { text: string; tools: string[] }>
  activeMsg: Record<string, string> // node_id -> message id currently streaming
  interrupts: Interrupt[]
  logs: LogEntry[]
  terminal: string[]
  seq: number
}

const initial: StreamState = {
  status: "idle",
  containerId: null,
  messages: [],
  agents: {},
  agentOrder: [],
  agentDetail: {},
  activeMsg: {},
  interrupts: [],
  logs: [],
  terminal: [],
  seq: 0,
}

/** Interrupt reasons can be a string, a JSON string, or an object like { question, options }. */
export function parseInterrupt(reason: unknown): { question?: string; options: string[]; raw: unknown } {
  let r: any = reason
  if (typeof r === "string") {
    try {
      r = JSON.parse(r)
    } catch {
      return { question: r, options: [], raw: reason }
    }
  }
  if (r && typeof r === "object") {
    const question = r.question ?? r.prompt ?? r.message
    const options = Array.isArray(r.options) ? r.options.map(String) : []
    return { question: typeof question === "string" ? question : undefined, options, raw: r }
  }
  return { options: [], raw: reason }
}

type ServerEvent = { type: string; message?: string; data?: Record<string, any> }
type Action =
  | { kind: "server"; ev: ServerEvent }
  | { kind: "batch"; evs: ServerEvent[] }
  | { kind: "user"; text: string }
  | { kind: "answer"; interrupt?: Interrupt; text: string }

/* ───────── helpers ───────── */
const patchMsg = (msgs: ChatMsg[], id: string, fn: (m: ChatMsg) => ChatMsg) =>
  msgs.map((m) => (m.id === id ? fn(m) : m))

function appendText(parts: Part[], chunk: string): Part[] {
  const last = parts[parts.length - 1]
  if (last?.kind === "text") {
    return [...parts.slice(0, -1), { kind: "text", text: last.text + chunk }]
  }
  return [...parts, { kind: "text", text: chunk }]
}

/** Create or update a tool step by id, keeping its position in the message. */
function upsertTool(parts: Part[], id: string, fn: (prev?: Step) => Step): Part[] {
  const i = parts.findIndex((p) => p.kind === "tool" && p.step.id === id)
  if (i === -1) return [...parts, { kind: "tool", step: fn(undefined) }]
  const prev = (parts[i] as Extract<Part, { kind: "tool" }>).step
  return parts.map((p, j) => (j === i ? { kind: "tool", step: fn(prev) } : p))
}

const finishSteps = (parts: Part[], failed = false): Part[] =>
  parts.map((p) =>
    p.kind === "tool" && !p.step.done
      ? { kind: "tool", step: failed ? { ...p.step, failed: true } : { ...p.step, done: true } }
      : p
  )

/* ───────── reducer ───────── */
function reducer(s: StreamState, a: Action): StreamState {
  if (a.kind === "batch") {
    return a.evs.reduce<StreamState>((acc, ev) => reducer(acc, { kind: "server", ev }), s)
  }
  if (a.kind === "user") {
    return {
      ...s,
      seq: s.seq + 1,
      status: "running",
      messages: [...s.messages, { id: `u${s.seq}`, role: "user", parts: [{ kind: "text", text: a.text }] }],
    }
  }
  if (a.kind === "answer") {
    // Keep the question and the answer in the transcript, then resume
    const seq = s.seq + 1
    const q = a.interrupt ? parseInterrupt(a.interrupt.reason).question : undefined
    const added: ChatMsg[] = []
    if (q && a.interrupt) {
      added.push({ id: `q${seq}`, role: "agent", agent: a.interrupt.name, parts: [{ kind: "text", text: q }] })
    }
    added.push({ id: `u${seq}`, role: "user", parts: [{ kind: "text", text: a.text }] })
    return {
      ...s,
      seq,
      status: "running",
      interrupts: s.interrupts.filter((i) => i.interruptId !== a.interrupt?.interruptId),
      messages: [...s.messages, ...added],
    }
  }

  const { type, message = "", data = {} } = a.ev
  const node: string | undefined = data.node_id
  const seq = s.seq + 1
  const log = (text: string): LogEntry[] => [...s.logs, { id: seq, type, text }].slice(-200)
  const base = { ...s, seq }

  // Make sure a node has a message to write into
  const ensureMsg = (st: StreamState, n: string) => {
    if (st.activeMsg[n]) return st
    const id = `a${seq}-${n}`
    return {
      ...st,
      activeMsg: { ...st.activeMsg, [n]: id },
      agentOrder: st.agentOrder.includes(n) ? st.agentOrder : [...st.agentOrder, n],
      agents: { ...st.agents, [n]: "working" as AgentStatus },
      messages: [...st.messages, { id, role: "agent" as const, agent: n, parts: [], streaming: true }],
    }
  }

  switch (type) {
    case "job_started":
      return { ...base, status: "running", interrupts: [], logs: log(message) }

    case "sandbox_ready":
      return { ...base, containerId: data.container_id ?? null, logs: log(message) }

    case "agents_active":
    case "execution_running":
      return { ...base, logs: log(message) }

    case "job_resumed":
      return { ...base, status: "running", interrupts: [], logs: log(message) }

    case "node_start": {
      if (!node) return base
      return { ...ensureMsg({ ...base, activeMsg: { ...s.activeMsg, [node]: "" } }, node), logs: log(message) }
    }

    case "agent_stream": {
      if (!node) return base
      const st = ensureMsg(base, node)
      const id = st.activeMsg[node]!
      return {
        ...st,
        messages: patchMsg(st.messages, id, (m) => ({ ...m, parts: appendText(m.parts, message) })),
        agentDetail: {
          ...st.agentDetail,
          [node]: {
            tools: st.agentDetail[node]?.tools ?? [],
            text: ((st.agentDetail[node]?.text ?? "") + message).slice(-1500),
          },
        },
      }
    }

    // First sight of a tool call (name only), and again later with its full input
    case "tool_activity": {
      if (!node) return base
      const st = ensureMsg(base, node)
      const id = st.activeMsg[node]!
      const stepId: string = data.tool_use_id ?? `t${seq}`
      const isNew = !st.messages.some(
        (m) => m.id === id && m.parts.some((p) => p.kind === "tool" && p.step.id === stepId)
      )
      return {
        ...st,
        messages: patchMsg(st.messages, id, (m) => ({
          ...m,
          parts: upsertTool(m.parts, stepId, (prev) => ({
            id: stepId,
            tool: String(data.tool_name ?? prev?.tool ?? "tool"),
            input: data.tool_input ?? prev?.input,
            output: prev?.output,
            done: prev?.done ?? false,
            failed: prev?.failed,
          })),
        })),
        agentDetail:
          isNew && data.tool_name
            ? {
                ...st.agentDetail,
                [node]: {
                  text: st.agentDetail[node]?.text ?? "",
                  tools: [...(st.agentDetail[node]?.tools ?? []), String(data.tool_name)].slice(-20),
                },
              }
            : st.agentDetail,
        logs: isNew ? log(message || `Tool: ${data.tool_name}`) : st.logs,
      }
    }

    case "tool_result": {
      if (!node) return base
      const id = s.activeMsg[node]
      const stepId: string | undefined = data.tool_use_id
      if (!id || !stepId) return base
      return {
        ...base,
        messages: patchMsg(s.messages, id, (m) => ({
          ...m,
          parts: upsertTool(m.parts, stepId, (prev) => ({
            id: stepId,
            tool: prev?.tool ?? "tool",
            input: prev?.input,
            output: data.output ? String(data.output) : prev?.output,
            done: true,
            failed: !!data.is_error,
          })),
        })),
      }
    }

    case "node_complete": {
      if (!node) return base
      const id = s.activeMsg[node]
      const { [node]: _drop, ...rest } = s.activeMsg
      return {
        ...base,
        agents: { ...s.agents, [node]: "done" },
        activeMsg: rest,
        messages: id
          ? patchMsg(s.messages, id, (m) => ({ ...m, streaming: false, parts: finishSteps(m.parts) }))
          : s.messages,
        logs: log(message),
      }
    }

    case "terminal_output":
      return { ...base, terminal: [...s.terminal, ...String(message).split("\n")].slice(-500) }

    case "agent_handoff": {
      const from = (data.from_nodes ?? []).join(", ")
      const to = (data.to_nodes ?? []).join(", ")
      return { ...base, logs: log(`Handoff: ${from} → ${to}`) }
    }

    case "job_interrupted":
      return { ...base, status: "interrupted", interrupts: data.interrupts ?? [], logs: log(message) }

    case "job_completed":
      return { ...base, status: "completed", interrupts: [], logs: log(message) }

    case "job_failed":
      return {
        ...base,
        status: "failed",
        activeMsg: {},
        messages: [
          ...s.messages.map((m) => ({ ...m, streaming: false, parts: finishSteps(m.parts, true) })),
          { id: `e${seq}`, role: "system" as const, parts: [{ kind: "text" as const, text: message }] },
        ],
        logs: log(message),
      }

    default:
      return base
  }
}

/* ───────── parsing ───────── */
function parse(raw: unknown): ServerEvent | null {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : (raw as any)
    if (!obj || typeof obj !== "object") return null
    const type = obj.type ?? obj.event
    if (!type) return null

    // Backend shape: { type, data: { message, details: { node_id, ... } } }
    const d = obj.data ?? obj.payload ?? {}
    const message: string = obj.message || d.message || "" // never trim: stream chunks carry spaces
    const { message: _m, details, ...rest } = d
    return { type, message, data: { ...rest, ...(details ?? {}) } }
  } catch {
    return null
  }
}

/* ───────── hook ───────── */
/**
 * @param url         WebSocket URL for the live event stream
 * @param opts.projectId
 */
export function useProjectStream(url: string, opts: { projectId?: string } = {}) {
  console.log(opts.projectId)
  const [state, dispatch] = React.useReducer(reducer, initial)
  const stateRef = React.useRef(state)
  stateRef.current = state

  // Queue every event (none dropped, order kept), apply once per animation frame
  const queue = React.useRef<ServerEvent[]>([])
  const frame = React.useRef<number | null>(null)

  const flush = React.useCallback(() => {
    frame.current = null
    const evs = queue.current
    if (evs.length === 0) return
    queue.current = []
    dispatch({ kind: "batch", evs })
  }, [])

  const { isConnected, sendMessage } = useWebSocket(url, {
    onMessage: (raw) => {
      const ev = parse(raw)
      if ((globalThis as any).__WS_DEBUG) console.log("[ws]", ev ?? "UNPARSEABLE", raw)
      if (!ev) return
      queue.current.push(ev)
      if (/^job_(completed|failed|interrupted)$/.test(ev.type)) {
        if (frame.current != null) cancelAnimationFrame(frame.current)
        flush()
      } else if (frame.current == null) {
        frame.current = requestAnimationFrame(flush)
      }
    },
  })

  React.useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    },
    []
  )

  const sendPrompt = React.useCallback(
    (text: string) => {
      if (!sendMessage({ type: "user_message", prompt: text })) return
      dispatch({ kind: "user", text })
    },
    [sendMessage]
  )

  const respondToInterrupt = React.useCallback(
    async (interruptId: string, response: string) => {
      const interrupt = stateRef.current.interrupts.find((i) => i.interruptId === interruptId)

      
        try {
          const res = api.response<interruption,responsed>(`/v1/projects/${opts.projectId}/response`)
          return res
        } catch (err) {
          console.warn("Could not send the answer", err)
          return
        }
      
      dispatch({ kind: "answer", interrupt, text: response })
    },
    [sendMessage]
  )

  return { isConnected, state, sendPrompt, respondToInterrupt }
}