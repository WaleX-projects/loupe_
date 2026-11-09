"use client"

import * as React from "react"

import { hasSession } from "@/lib/session"

/**
 * null = not known yet (server render and first client render), then true/false.
 * Reading localStorage during render makes the server and client HTML differ (hydration error),
 * so the real value is read in an effect.
 */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null)
  React.useEffect(() => setSignedIn(hasSession()), [])
  return signedIn
}