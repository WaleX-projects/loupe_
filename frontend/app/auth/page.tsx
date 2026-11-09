"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react"

import { APP_NAME, AuthError, hasSession, safeNext, sendMagicLink, startGoogle } from "@/lib/auth"

const RESEND_SECONDS = 30

const dotGrid = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get("next"))

  const [email, setEmail] = React.useState("")
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [seconds, setSeconds] = React.useState(0)

  // already signed in
  React.useEffect(() => {
    if (hasSession()) router.replace(next)
  }, [router, next])

  // resend countdown
  React.useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  async function submit(address: string) {
    const value = address.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.")
      return
    }
    setError(null)
    setSending(true)
    try {
      await sendMagicLink(value)
      setSentTo(value)
      setSeconds(RESEND_SECONDS)
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Something went wrong. Try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#0e0e10]/90 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
      {/* brand */}
      <div className="flex items-center gap-2.5">
        <span className="size-7 rounded-t-full rounded-bl-full bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500" />
        <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      {sentTo ? (
        /* ───────── Check your email ───────── */
        <div className="mt-8">
          <div className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/5">
            <Mail size={20} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            We sent a sign-in link to <span className="text-zinc-100">{sentTo}</span>. Open it on this device to continue.
          </p>

          <p role="alert" className={`mt-4 flex items-start gap-2 text-sm text-red-400 ${error ? "" : "hidden"}`}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>

          <button
            type="button"
            disabled={seconds > 0 || sending}
            onClick={() => void submit(sentTo)}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending && <Loader2 size={16} className="animate-spin" />}
            {seconds > 0 ? `Resend link in ${seconds}s` : "Resend link"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null)
              setError(null)
            }}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} />
            Use a different email
          </button>
        </div>
      ) : (
        /* ───────── Sign in / sign up ───────── */
        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          <p className="mt-2 text-sm text-zinc-400">Log in or create an account to start building.</p>

          <button
            type="button"
            disabled={googleLoading}
            onClick={() => {
              setGoogleLoading(true)
              startGoogle()
            }}
            className="mt-7 flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-70"
          >
            {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void submit(email)
            }}
          >
            <label htmlFor="email" className="text-sm font-medium text-zinc-200">
              Email
            </label>
            <div
              className={`mt-2 flex h-11 items-center gap-2.5 rounded-xl border bg-[#121214] px-3.5 transition-colors focus-within:border-white/30 ${
                error ? "border-red-500/60" : "border-white/10"
              }`}
            >
              <Mail size={16} className="shrink-0 text-zinc-500" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                disabled={sending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "email-error" : undefined}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
              />
            </div>
            <p id="email-error" role="alert" className={`mt-2 flex items-start gap-1.5 text-sm text-red-400 ${error ? "" : "hidden"}`}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-medium text-white transition-colors hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  Send magic link
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
            By continuing you agree to the{" "}
            <a href="/terms" className="text-zinc-300 underline-offset-2 hover:underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-zinc-300 underline-offset-2 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="dark relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#0b0b0c] px-4 py-10 text-zinc-100">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={dotGrid} />
     </div>
      <React.Suspense fallback={null}>
        <LoginForm />
      </React.Suspense>
    </main>
  )
}