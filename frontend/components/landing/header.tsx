"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

import { Logo, btnOutline, btnPrimary } from "./brand"
import { useSignedIn } from "./use-signed-in"

const solutions = [
  { title: "Founders", desc: "Launch a product without a team.", href: "#features" },
  { title: "Designers", desc: "Turn mockups into working apps.", href: "#features" },
  { title: "Internal tools", desc: "Dashboards and admin panels in minutes.", href: "#features" },
]

const resources = [
  { title: "How it works", desc: "Watch a build happen.", href: "#demo" },
  { title: "Features", desc: "Everything in the workspace.", href: "#features" },
]

const trigger =
  "bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white data-[state=open]:bg-white/5"

function AuthActions() {
  const signedIn = useSignedIn()

  // reserve the space so the header does not jump when the session is read
  if (signedIn === null) return <div aria-hidden className="h-9 w-44" />

  return signedIn ? (
    <Link href="/project" className={btnPrimary}>
      Dashboard
    </Link>
  ) : (
    <>
      <Link href="/auth" className={btnOutline}>
        Log in
      </Link>
      <Link href="/auth" className={btnPrimary}>
        Get started
      </Link>
    </>
  )
}

export function Header() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className={trigger}>Solutions</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-72 gap-1 p-2">
                    {solutions.map((l) => (
                      <li key={l.title}>
                        <NavigationMenuLink href={l.href} className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{l.title}</span>
                          <span className="text-xs text-zinc-400">{l.desc}</span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className={trigger}>Resources</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-72 gap-1 p-2">
                    {resources.map((l) => (
                      <li key={l.title}>
                        <NavigationMenuLink href={l.href} className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{l.title}</span>
                          <span className="text-xs text-zinc-400">{l.desc}</span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              {[
                { l: "Demo", href: "#demo" },
                { l: "Features", href: "#features" },
              ].map(({ l, href }) => (
                <NavigationMenuItem key={l}>
                  <NavigationMenuLink href={href} className="px-3 py-2 text-sm text-zinc-200 hover:text-white">
                    {l}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <AuthActions />
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center rounded-lg text-zinc-200 hover:bg-white/10 lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="absolute inset-x-0 top-20 border-y border-white/10 bg-[#0b0b0c]/95 px-6 py-5 backdrop-blur-xl lg:hidden"
        >
          <ul className="space-y-1 text-base">
            {[
              { l: "Demo", href: "#demo" },
              { l: "Features", href: "#features" },
              ...solutions.map((s) => ({ l: s.title, href: s.href })),
            ].map(({ l, href }) => (
              <li key={l}>
                <a
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-zinc-200 hover:bg-white/5"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2 sm:hidden">
            <AuthActions />
          </div>
        </nav>
      )}
    </header>
  )
}