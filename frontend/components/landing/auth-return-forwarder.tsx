"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * Supabase can land on "/" after Google or a magic link (when the redirect URL is not on its
 * allowlist). Forward the code, tokens or error untouched to /auth/callback, which finishes the sign-in.
 */
export function AuthReturnForwarder() {
  const router = useRouter()

  React.useEffect(() => {
    const { search, hash } = window.location
    const query = new URLSearchParams(search)
    const fragment = new URLSearchParams(hash.replace(/^#/, ""))
    const isAuthReturn =
      query.has("code") ||
      query.has("error") ||
      query.has("error_description") ||
      fragment.has("access_token") ||
      fragment.has("error") ||
      fragment.has("error_description")

    if (isAuthReturn) router.replace(`/auth/callback${search}${hash}`)
  }, [router])

  return null
}