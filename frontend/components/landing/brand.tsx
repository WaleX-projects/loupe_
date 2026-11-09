import Link from "next/link"

export const BRAND = "Buildly" // change me

export const dotGrid = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
}

// shared button styles (plain <Link>s, so no dependency on the Button component's asChild/render API)
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 transition-colors"
export const btnPrimary = `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-black hover:bg-zinc-200 ${focus}`
export const btnOutline = `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-transparent px-4 text-sm font-medium text-zinc-100 hover:bg-white/10 ${focus}`
export const btnLarge = `inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-medium text-black hover:bg-zinc-200 ${focus}`

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
      <span className="size-6 rounded-t-full rounded-bl-full bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500" />
      {BRAND}
    </Link>
  )
}