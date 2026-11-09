"use client"

import * as React from "react"
import { Check, Loader2 } from "lucide-react"

const PROMPT = "Add a dark mode toggle to the settings page."
const STEPS = [
  "Reading app/settings/page.tsx",
  "Creating components/mode-toggle.tsx",
  "Running the build",
]

/**
 * A scripted, looping product demo: a prompt types out, the agent works through its steps,
 * and the preview flips to dark. Pure React state + timers, no extra dependencies.
 * Respects prefers-reduced-motion by showing the finished state.
 */
export function Demo() {
  const [typed, setTyped] = React.useState(0)
  const [done, setDone] = React.useState(0)
  const [finished, setFinished] = React.useState(false)

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(PROMPT.length)
      setDone(STEPS.length)
      setFinished(true)
      return
    }

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)))

    async function loop() {
      while (!cancelled) {
        setTyped(0)
        setDone(0)
        setFinished(false)
        await wait(700)
        for (let i = 1; i <= PROMPT.length && !cancelled; i++) {
          setTyped(i)
          await wait(32)
        }
        await wait(500)
        for (let s = 1; s <= STEPS.length && !cancelled; s++) {
          await wait(900)
          setDone(s)
        }
        await wait(500)
        setFinished(true)
        await wait(4500)
      }
    }
    void loop()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [])

  const started = typed > 0
  const typing = typed < PROMPT.length

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e10] shadow-2xl shadow-indigo-500/10">
      {/* window bar */}
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-4">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 text-xs text-zinc-500">Project / settings-app</span>
      </div>

      <div aria-hidden className="grid min-h-[360px] sm:grid-cols-[1fr_1fr]">
        {/* chat */}
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:border-b-0 sm:border-r">
          <div className="ml-auto min-h-[44px] max-w-[90%] rounded-2xl rounded-br-sm bg-white/10 px-4 py-2.5 text-sm">
            {PROMPT.slice(0, typed)}
            {typing && started && <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-white" />}
          </div>

          {!typing && (
            <div className="space-y-3">
              <ul className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[13px] text-zinc-400">
                {STEPS.map((step, i) => {
                  const complete = done > i
                  const running = done === i
                  return (
                    <li key={step} className={`flex items-center gap-2 transition-opacity ${done < i ? "opacity-30" : ""}`}>
                      {complete ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : running ? (
                        <Loader2 size={13} className="animate-spin text-zinc-400" />
                      ) : (
                        <span className="size-[13px]" />
                      )}
                      {step}
                    </li>
                  )
                })}
              </ul>
              {finished && <p className="text-sm text-zinc-300">Done. 3 files changed, build passes.</p>}
            </div>
          )}
        </div>

        {/* preview */}
        <div className="grid place-items-center p-5">
          <div
            className={`w-full max-w-[260px] rounded-xl border p-4 text-sm transition-colors duration-700 ${
              finished ? "border-white/10 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-900"
            }`}
          >
            <p className="font-semibold">Settings</p>
            <div className="mt-4 flex items-center justify-between">
              <span className={finished ? "text-neutral-400" : "text-neutral-500"}>Dark mode</span>
              <span
                className={`relative h-5 w-9 rounded-full transition-colors duration-500 ${
                  finished ? "bg-indigo-500" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-4 rounded-full bg-white transition-all duration-500 ${
                    finished ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </div>
            <div className={`mt-4 h-2 w-3/4 rounded ${finished ? "bg-white/10" : "bg-neutral-100"}`} />
            <div className={`mt-2 h-2 w-1/2 rounded ${finished ? "bg-white/10" : "bg-neutral-100"}`} />
          </div>
        </div>
      </div>

      <p className="sr-only">
        An animated example: a prompt asks for a dark mode toggle, the agent reads the settings page, creates the
        toggle and runs the build, and the preview switches to dark.
      </p>
    </div>
  )
}