"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import {  hasSession } from "@/lib/auth"

/**
 * Wrap any signed-in page. Redirects to /login?next=... when there is no session.
 * (Tokens live in localStorage, so this has to run in the browser; Next middleware cannot see it.)
 
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ok, setOk] = React.useState<boolean>()

  React.useEffect(() => {
    
    if (hasSession()) setOk(true)
    else router.replace(`/auth?next=${encodeURIComponent(pathname)}`)
  }, [router, pathname])

  if (!ok) {
    return (
      <div role="status" aria-label="Loading" className="dark grid min-h-screen place-items-center bg-[#0b0b0c] text-zinc-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }
  return <>{children}</>
}