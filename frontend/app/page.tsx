import type { Metadata } from "next"
import Link from "next/link"

import { AuthReturnForwarder } from "@/components/landing/auth-return-forwarder"
import { BRAND, Logo, btnLarge, dotGrid } from "@/components/landing/brand"
import { CtaLink } from "@/components/landing/cta-link"
import { Demo } from "@/components/landing/demo"
import { Header } from "@/components/landing/header"
import { HeroPrompt } from "@/components/landing/hero"

export const metadata: Metadata = {
  title: `${BRAND}: build apps by chatting with AI`,
  description: "Describe what you want. A team of AI agents plans, builds and tests it while you watch.",
}

const points = [
  { t: "It reads your code first", d: "The agent looks before it edits, so changes fit what is already there." },
  { t: "It shows its work", d: "Every command it runs is listed, and you can open the output." },
  { t: "It checks itself", d: "Ask it to build or test before you ship." },
]

const features = [
  {
    t: "Chat your way to a working app",
    d: "Ask for a page, a feature or a fix. A team of agents plans, builds, reviews and tests it.",
    wide: true,
  },
  { t: "See how it fits together", d: "Every screen, server and service as a map you can click through.", wide: false },
  { t: "Own your code", d: "Real, readable code you can open, edit and take anywhere.", wide: false },
  {
    t: "Preview and ship",
    d: "Watch the app run as it is built, then deploy it when it feels right.",
    wide: true,
  },
]

const works = ["GitHub", "Stripe", "Supabase", "Postgres", "Vercel"]

const footerCols = [
  { h: "Product", items: [{ l: "Demo", href: "#demo" }, { l: "Features", href: "#features" }] },
  { h: "Account", items: [{ l: "Log in", href: "/auth" }, { l: "Dashboard", href: "/project" }] },
]

export default function HomePage() {
  return (
    <div className="dark flex min-h-screen flex-col bg-[#0b0b0c] text-zinc-100">
      <AuthReturnForwarder />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" className="flex-1">
        {/* ───────── Hero ───────── */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            {/* dots fade out toward the edges */}
            <div
              className="absolute inset-0"
              style={{
                ...dotGrid,
                maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
                WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
              }}
            />
            {/* one soft glow behind the prompt (delete this line for a flat look) */}
            <div className="absolute left-1/2 top-[38%] h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
          </div>

          <div className="mx-auto flex min-h-[760px] max-w-4xl flex-col items-center justify-center px-6 pb-28 pt-36 text-center">
            <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
              Build something people love
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg text-zinc-400">
              Describe your idea. A team of AI agents plans it, builds it and tests it while you watch.
            </p>
            <HeroPrompt />
          </div>
        </section>

        {/* ───────── Works with ───────── */}
        <section aria-label="Integrations" className="border-y border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 py-9 md:flex-row md:justify-between">
            <p className="text-sm text-zinc-500">Works with the tools you already use</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-base font-medium text-zinc-500">
              {works.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── Demo ───────── */}
        <section id="demo" className="mx-auto max-w-7xl scroll-mt-8 px-6 py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_560px]">
            <div>
              <h2 className="max-w-lg text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Ask for a change. Watch it get done.
              </h2>
              <p className="mt-4 max-w-md text-zinc-400">
                Every step the agents take is visible, so you always know what changed and why.
              </p>
              <ul className="mt-10 space-y-6">
                {points.map((p) => (
                  <li key={p.t} className="border-l border-white/10 pl-5">
                    <h3 className="font-medium">{p.t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <Demo />
          </div>
        </section>

        {/* ───────── Features ───────── */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-28">
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need from idea to live app
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-6">
            {features.map((f) => (
              <div
                key={f.t}
                className={`rounded-3xl border border-white/10 bg-[#0e0e10] p-8 ${
                  f.wide ? "md:col-span-4" : "md:col-span-2"
                }`}
              >
                <h3 className="text-xl font-semibold">{f.t}</h3>
                <p className="mt-2 max-w-md text-zinc-400">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── Closing CTA ───────── */}
        <section id="start" className="mx-auto max-w-7xl px-6 pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e10] px-6 py-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-40 left-1/2 h-72 w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600/40 via-fuchsia-500/40 to-pink-500/40 blur-[100px]"
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Start building for free</h2>
              <p className="mx-auto mt-3 max-w-md text-zinc-400">No credit card needed. Your first app can be live today.</p>
              <CtaLink className={`${btnLarge} mt-8`}>Get started →</CtaLink>
            </div>
          </div>
        </section>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-zinc-500">Turn ideas into apps by chatting with AI.</p>
          </div>
          {footerCols.map((col) => (
            <div key={col.h}>
              <h4 className="text-sm font-medium">{col.h}</h4>
              <ul className="mt-3 space-y-2 text-sm text-zinc-500">
                {col.items.map((i) => (
                  <li key={i.l}>
                    {i.href.startsWith("#") ? (
                      <a href={i.href} className="transition-colors hover:text-zinc-200">
                        {i.l}
                      </a>
                    ) : (
                      <Link href={i.href} className="transition-colors hover:text-zinc-200">
                        {i.l}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 py-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} {BRAND}. All rights reserved.
        </div>
      </footer>
    </div>
  )
}