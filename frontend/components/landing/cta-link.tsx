"use client"

import Link from "next/link"

import { useSignedIn } from "./use-signed-in"

/** Goes to the dashboard when signed in, otherwise to login. */
export function CtaLink({ children, className }: { children: React.ReactNode; className?: string }) {
  const signedIn = useSignedIn()
  return (
    <Link href={signedIn ? "/project" : "/login"} className={className}>
      {children}
    </Link>
  )
}