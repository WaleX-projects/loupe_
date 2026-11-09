"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { AuthCallbackScreen } from "@/components/auth-callback-screen"
import { APP_NAME, hasSession } from "@/lib/auth"

/**
 * "/" is where Supabase can land after Google or a magic link.
 * - Came back with an auth code, tokens or an error: show the sign-in screen, which sends the
 *   code to FastAPI /auth/callback, saves the session, then moves on to the dashboard.
 * - Otherwise: signed-in users go to the dashboard, everyone else to /login.
 */
export default function RootPage() {
  const router = useRouter()
  const [mode, setMode] = React.useState<"checking" | "callback">("checking")
  const [target, setTarget] = React.useState<string | null>(null)

  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""))

    const isAuthReturn =
      query.has("code") ||
      query.has("error") ||
      query.has("error_description") ||
      fragment.has("access_token") ||
      fragment.has("error") ||
      fragment.has("error_description")

    if (isAuthReturn) {
      setMode("callback")
      return
    }

    const to = hasSession() ? "/project" : "/auth"
    setTarget(to)
    router.replace(to)
  }, [router])

  if (mode === "callback") return <AuthCallbackScreen />

  return (
    <main className="dark grid min-h-screen place-items-center bg-[#0b0b0c] px-4 text-zinc-100">
      <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
        <span className="size-9 rounded-t-full rounded-bl-full bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500" />
        <p className="mt-4 text-lg font-semibold tracking-tight">{APP_NAME}</p>
        <Loader2 size={20} className="mt-6 animate-spin text-zinc-500" />
        {target && (
          <Link href={target} className="mt-6 text-sm text-zinc-400 underline-offset-2 hover:text-white hover:underline">
            Not redirected? Continue
          </Link>
        )}
      </div>
    </main>
  )
}