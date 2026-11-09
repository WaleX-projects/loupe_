"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, Loader2 } from "lucide-react"

import { APP_NAME, AuthError, completeSignIn, safeNext } from "@/lib/auth"

const dotGrid = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
}

type State = { status: "verifying" } | { status: "success" } | { status: "error"; message: string }

/**
 * The loading screen shown while the sign-in finishes:
 *   verifying: sends the code to FastAPI GET /auth/callback
 *   success:   tokens are saved, "Signed in successfully"
 *   then:      moves to the dashboard (or the ?next= page)
 *   error:     shows the server's message with a link back to /login
 * Used by both "/" and "/auth/callback", so it works whichever URL Supabase returns to.
 */
export function AuthCallbackScreen() {
  const router = useRouter()
  const [state, setState] = React.useState<State>({ status: "verifying" })
  // auth codes are single use, and React strict mode runs effects twice in dev: never run this twice
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    const next = safeNext(new URLSearchParams(window.location.search).get("next"))

    completeSignIn()
      .then(() => {
        setState({ status: "success" })
        setTimeout(() => router.replace(next), 900)
      })
      .catch((e) =>
        setState({
          status: "error",
          message: e instanceof AuthError ? e.message : "Something went wrong. Try again.",
        })
      )
  }, [router])

  return (
    <main className="dark relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#0b0b0c] px-4 py-10 text-zinc-100">
      {/* background loads with the page while the code is being exchanged */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={dotGrid} />
        <div className="absolute left-1/2 top-[20%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/2 h-[380px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600/30 via-fuchsia-500/30 to-pink-500/30 blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#0e0e10]/90 p-8 text-center shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-2.5">
          <span className="size-7 rounded-t-full rounded-bl-full bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500" />
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div role="status" aria-live="polite" className="mt-8">
          {state.status === "verifying" && (
            <>
              <Loader2 size={28} className="mx-auto animate-spin text-zinc-400" />
              <h1 className="mt-5 text-xl font-semibold tracking-tight">Signing you in…</h1>
              <p className="mt-2 text-sm text-zinc-400">Verifying with the server.</p>
            </>
          )}

          {state.status === "success" && (
            <>
              <div className="mx-auto grid size-12 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <Check size={22} />
              </div>
              <h1 className="mt-5 text-xl font-semibold tracking-tight">Signed in successfully</h1>
              <p className="mt-2 text-sm text-zinc-400">Taking you to your projects…</p>
            </>
          )}

          {state.status === "error" && (
            <>
              <div className="mx-auto grid size-12 place-items-center rounded-full border border-red-500/40 bg-red-500/10 text-red-400">
                <AlertCircle size={22} />
              </div>
              <h1 className="mt-5 text-xl font-semibold tracking-tight">We couldn't sign you in</h1>
              <p className="mt-2 text-sm text-zinc-400">{state.message}</p>
              <Link
                href="/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-medium text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                Back to log in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}