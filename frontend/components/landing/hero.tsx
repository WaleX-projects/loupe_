"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowUp } from "lucide-react"

import { hasSession } from "@/lib/session"

import { BRAND } from "./brand"

const starters = [
  { label: "Web app", text: "Build a web app that " },
  { label: "Dashboard", text: "Build a dashboard that shows " },
  { label: "Landing page", text: "Build a landing page for " },
  { label: "Internal tool", text: "Build an internal tool for my team to " },
]

/**
 * The prompt is saved for the dashboard (sessionStorage survives the Google/magic-link redirects
 * in the same tab), then the visitor goes to login, or straight to the dashboard if signed in.
 * The dashboard reads "pending_prompt" and fills its composer with it.
 */
export function HeroPrompt() {
  const router = useRouter()
  const [draft, setDraft] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)

  function start() {
    const prompt = draft.trim()
    if (!prompt) {
      ref.current?.focus()
      return
    }
    try {
      sessionStorage.setItem("pending_prompt", prompt)
    } catch {}
    router.push(hasSession() ? "/project" : "/login")
  }

  return (
    <div className="mt-10 w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          start()
        }}
        className="rounded-3xl border border-white/10 bg-[#121214]/90 p-3 text-left shadow-2xl shadow-indigo-500/20 backdrop-blur-xl transition-colors focus-within:border-white/25"
      >
        <label htmlFor="prompt" className="sr-only">
          What do you want to build?
        </label>
        <textarea
          id="prompt"
          ref={ref}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              start()
            }
          }}
          placeholder={`Ask ${BRAND} to build an online store for a coffee roaster…`}
          className="w-full resize-none bg-transparent px-3 pt-2 text-base outline-none placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="pl-3 text-xs text-zinc-500">Enter to start</p>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white pl-4 pr-3 text-sm font-medium text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            Start building
            <ArrowUp size={15} />
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {starters.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              setDraft(s.text)
              ref.current?.focus()
            }}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}